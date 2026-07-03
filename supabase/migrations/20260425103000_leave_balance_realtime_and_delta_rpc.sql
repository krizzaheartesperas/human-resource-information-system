-- Make leave balance updates durable and visible across open sessions.
--
-- - Enables realtime events for public.leave_balances.
-- - Adds an atomic delta RPC so approvals/finalization update used/pending days
--   in the database without writing a stale whole-row snapshot.

begin;

alter table public.leave_balances replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.leave_balances;
    exception
      when duplicate_object then null;
    end;
  end if;
end
$$;

create or replace function public.adjust_leave_balance(
  p_employee_id uuid,
  p_type text,
  p_year integer,
  p_total_days integer,
  p_pending_delta integer,
  p_used_delta integer
)
returns public.leave_balances
language plpgsql
security definer
set search_path = public
as $$
declare
  next_row public.leave_balances;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if p_employee_id is null then
    raise exception 'employee_id is required'
      using errcode = '22023';
  end if;

  if p_employee_id <> public.current_employee_id()
     and not public.current_user_has_company_leave_access() then
    raise exception 'Not allowed to adjust this leave balance'
      using errcode = '42501';
  end if;

  insert into public.leave_balances (
    employee_id,
    type,
    year,
    total_days,
    used_days,
    pending_days
  )
  values (
    p_employee_id,
    p_type,
    coalesce(p_year, extract(year from now())::integer),
    greatest(0, coalesce(p_total_days, 0)),
    greatest(0, coalesce(p_used_delta, 0)),
    greatest(0, coalesce(p_pending_delta, 0))
  )
  on conflict (employee_id, type, year)
  do update set
    used_days = greatest(0, public.leave_balances.used_days + coalesce(p_used_delta, 0)),
    pending_days = greatest(0, public.leave_balances.pending_days + coalesce(p_pending_delta, 0))
  returning * into next_row;

  return next_row;
end;
$$;

revoke all on function public.adjust_leave_balance(uuid, text, integer, integer, integer, integer) from public;
grant execute on function public.adjust_leave_balance(uuid, text, integer, integer, integer, integer) to authenticated;

commit;
