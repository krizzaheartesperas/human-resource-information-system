-- Reconcile current-year leave balance rows for every employee and leave type.
--
-- This repairs two common problems:
-- - Missing leave_balances rows after employees were added later.
-- - used_days / pending_days not matching leave_requests after workflow changes.

begin;

with leave_type_defaults(type, total_days) as (
  values
    ('VACATION_LEAVE'::text, 15),
    ('SICK_LEAVE'::text, 15),
    ('EMERGENCY_LEAVE'::text, 15),
    ('BEREAVEMENT_LEAVE'::text, 15),
    ('MATERNITY_LEAVE'::text, 15),
    ('PATERNITY_LEAVE'::text, 15),
    ('SOLO_PARENT_LEAVE'::text, 15),
    ('UNPAID_LEAVE'::text, 0)
),
active_employees as (
  select e.id
  from public.employees e
  where coalesce(nullif(lower(to_jsonb(e)->>'is_active'), ''), 'true') not in ('false', '0', 'no')
    and coalesce(nullif(lower(to_jsonb(e)->>'employment_status'), ''), 'active') not in (
      'inactive',
      'terminated',
      'resigned',
      'separated'
    )
),
request_totals as (
  select
    lr.employee_id,
    case lr.type
      when 'ANNUAL_LEAVE' then 'VACATION_LEAVE'
      when 'WORK_FROM_HOME' then 'VACATION_LEAVE'
      when 'MATERNITY' then 'MATERNITY_LEAVE'
      when 'OTHER' then 'UNPAID_LEAVE'
      else lr.type
    end as type,
    coalesce(sum(
      case
        when lr.status in ('FINAL_APPROVED', 'APPLIED') then
          greatest(0, (lr.end_date::date - lr.start_date::date) + 1)
        else 0
      end
    ), 0)::integer as used_days,
    coalesce(sum(
      case
        when lr.status in (
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
          'PENDING_APPROVAL'
        ) then greatest(0, (lr.end_date::date - lr.start_date::date) + 1)
        else 0
      end
    ), 0)::integer as pending_days
  from public.leave_requests lr
  where lr.status not in ('REJECTED', 'CANCELLED')
    and extract(year from lr.start_date::date)::integer = extract(year from now())::integer
  group by
    lr.employee_id,
    case lr.type
      when 'ANNUAL_LEAVE' then 'VACATION_LEAVE'
      when 'WORK_FROM_HOME' then 'VACATION_LEAVE'
      when 'MATERNITY' then 'MATERNITY_LEAVE'
      when 'OTHER' then 'UNPAID_LEAVE'
      else lr.type
    end
),
desired_balances as (
  select
    e.id as employee_id,
    ltd.type,
    extract(year from now())::integer as year,
    ltd.total_days,
    coalesce(rt.used_days, 0) as used_days,
    coalesce(rt.pending_days, 0) as pending_days
  from active_employees e
  cross join leave_type_defaults ltd
  left join request_totals rt
    on rt.employee_id = e.id
   and rt.type = ltd.type
)
insert into public.leave_balances (
  employee_id,
  type,
  year,
  total_days,
  used_days,
  pending_days
)
select
  employee_id,
  type,
  year,
  total_days,
  used_days,
  pending_days
from desired_balances
on conflict (employee_id, type, year)
do update set
  total_days = excluded.total_days,
  used_days = excluded.used_days,
  pending_days = excluded.pending_days;

commit;
