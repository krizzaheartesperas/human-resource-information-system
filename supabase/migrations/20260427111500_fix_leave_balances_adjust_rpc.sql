-- Fix leave_balances insertion/upsert behavior in adjust_leave_balance().
--
-- Why:
-- - Older callers may send aliases (ANNUAL_LEAVE, WORK_FROM_HOME, MATERNITY, OTHER).
-- - Type strings may come with spaces/hyphens/lowercase.
-- - Upserts should not accidentally overwrite total_days when caller omits it.

begin;

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
  normalized_type text;
  target_year integer := coalesce(p_year, extract(year from now())::integer);
  target_total_days integer := coalesce(greatest(0, p_total_days), 0);
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

  normalized_type := upper(
    replace(
      regexp_replace(trim(coalesce(p_type, '')), '[^[:alnum:]]+', '_', 'g'),
      '__',
      '_'
    )
  );

  normalized_type := case normalized_type
    when 'ANNUAL_LEAVE' then 'VACATION_LEAVE'
    when 'WORK_FROM_HOME' then 'VACATION_LEAVE'
    when 'MATERNITY' then 'MATERNITY_LEAVE'
    when 'OTHER' then 'UNPAID_LEAVE'
    else normalized_type
  end;

  if normalized_type not in (
    'VACATION_LEAVE',
    'SICK_LEAVE',
    'EMERGENCY_LEAVE',
    'BEREAVEMENT_LEAVE',
    'MATERNITY_LEAVE',
    'PATERNITY_LEAVE',
    'SOLO_PARENT_LEAVE',
    'UNPAID_LEAVE'
  ) then
    raise exception 'Invalid leave type: %', coalesce(p_type, '<null>')
      using errcode = '22023';
  end if;

  if p_total_days is null then
    target_total_days := case normalized_type
      when 'UNPAID_LEAVE' then 0
      else 15
    end;
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
    normalized_type,
    target_year,
    target_total_days,
    greatest(0, coalesce(p_used_delta, 0)),
    greatest(0, coalesce(p_pending_delta, 0))
  )
  on conflict (employee_id, type, year)
  do update set
    total_days = case
      when p_total_days is null then public.leave_balances.total_days
      else greatest(0, p_total_days)
    end,
    used_days = greatest(0, public.leave_balances.used_days + coalesce(p_used_delta, 0)),
    pending_days = greatest(0, public.leave_balances.pending_days + coalesce(p_pending_delta, 0))
  returning * into next_row;

  return next_row;
end;
$$;

revoke all on function public.adjust_leave_balance(uuid, text, integer, integer, integer, integer) from public;
grant execute on function public.adjust_leave_balance(uuid, text, integer, integer, integer, integer) to authenticated;

commit;
