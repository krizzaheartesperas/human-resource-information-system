-- Leave drafts: status = 'DRAFT' (saved from "Save as draft" in the app).
-- Draft rows stay in public.leave_requests; partial dates may use placeholder DB dates
-- with real values in metadata.draftForm (see app). Drafts must not affect leave_balances.
--
-- Updates trigger helpers from scripts/sync-leave-balances-from-leave-requests-trigger.sql:
-- - recalculate_leave_balance: exclude DRAFT from sums (and from buckets).
-- - sync_leave_balance_from_leave_request: skip recalculation when only draft rows fire the trigger.

begin;

comment on table public.leave_requests is
  'Leave / time-off requests. status may include DRAFT for in-progress saves (not submitted for approval).';

comment on column public.leave_requests.status is
  'Workflow state; includes DRAFT for saved drafts. Drafts do not reserve or consume leave_balances.';

create or replace function public.normalized_leave_type(p_type text)
returns text
language sql
immutable
as $$
  select case upper(replace(regexp_replace(trim(coalesce(p_type, '')), '[^[:alnum:]]+', '_', 'g'), '__', '_'))
    when 'ANNUAL_LEAVE' then 'VACATION_LEAVE'
    when 'WORK_FROM_HOME' then 'VACATION_LEAVE'
    when 'MATERNITY' then 'MATERNITY_LEAVE'
    when 'OTHER' then 'UNPAID_LEAVE'
    else upper(replace(regexp_replace(trim(coalesce(p_type, '')), '[^[:alnum:]]+', '_', 'g'), '__', '_'))
  end
$$;

create or replace function public.default_leave_total_days(p_type text)
returns integer
language sql
immutable
as $$
  select case public.normalized_leave_type(p_type)
    when 'UNPAID_LEAVE' then 0
    else 15
  end
$$;

create or replace function public.recalculate_leave_balance(
  p_employee_id uuid,
  p_type text,
  p_year integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_type text := public.normalized_leave_type(p_type);
  next_used_days integer := 0;
  next_pending_days integer := 0;
begin
  if p_employee_id is null or normalized_type is null or p_year is null then
    return;
  end if;

  select
    coalesce(sum(
      case
        when upper(replace(regexp_replace(trim(coalesce(lr.status, '')), '[^[:alnum:]]+', '_', 'g'), '__', '_')) in ('FINAL_APPROVED', 'APPLIED') then
          greatest(0, (lr.end_date::date - lr.start_date::date) + 1)
        else 0
      end
    ), 0)::integer,
    coalesce(sum(
      case
        when upper(replace(regexp_replace(trim(coalesce(lr.status, '')), '[^[:alnum:]]+', '_', 'g'), '__', '_')) in (
          'APPROVED',
          'PENDING_RECORDING',
          'PENDING_FINALIZATION',
          'PENDING_HR_ADMIN_PROCESSING',
          'PENDING_HR_ADMIN_PROCESSING_HR_MANAGER',
          'PENDING_HR_ADMIN_PROCESSING_EXECUTIVE',
          'PENDING_HR_MANAGER_PROCESSING_HR_ADMIN',
          'PENDING_HR_STAFF_PROCESSING',
          'PENDING_HR_STAFF_PROCESSING_AUDITOR',
          'PENDING_HR_MANAGER_APPROVAL',
          'PENDING_EXECUTIVE_APPROVAL',
          'PENDING_EXECUTIVE_BOARD_APPROVAL',
          'PENDING_APPROVAL',
          'RETURNED_FOR_REVIEW'
        ) then greatest(0, (lr.end_date::date - lr.start_date::date) + 1)
        else 0
      end
    ), 0)::integer
  into next_used_days, next_pending_days
  from public.leave_requests lr
  where lr.employee_id = p_employee_id
    and public.normalized_leave_type(lr.type) = normalized_type
    and extract(year from lr.start_date::date)::integer = p_year
    and upper(replace(regexp_replace(trim(coalesce(lr.status, '')), '[^[:alnum:]]+', '_', 'g'), '__', '_'))
      not in ('REJECTED', 'CANCELLED', 'DRAFT');

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
    p_year,
    public.default_leave_total_days(normalized_type),
    next_used_days,
    next_pending_days
  )
  on conflict (employee_id, type, year)
  do update set
    used_days = excluded.used_days,
    pending_days = excluded.pending_days;
end;
$$;

create or replace function public.sync_leave_balance_from_leave_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if upper(trim(coalesce(old.status, ''))) is distinct from 'DRAFT' then
      perform public.recalculate_leave_balance(
        old.employee_id,
        old.type,
        extract(year from old.start_date::date)::integer
      );
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if upper(trim(coalesce(new.status, ''))) is distinct from 'DRAFT' then
      perform public.recalculate_leave_balance(
        new.employee_id,
        new.type,
        extract(year from new.start_date::date)::integer
      );
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_leave_balance_from_leave_request_trigger on public.leave_requests;

create trigger sync_leave_balance_from_leave_request_trigger
after insert or update or delete on public.leave_requests
for each row
execute function public.sync_leave_balance_from_leave_request();

commit;
