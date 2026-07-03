-- Repair current-year leave_balances rows for EMP-0002 / Junior Software Engineer.
-- Employee UUID: f8180354-9667-439b-8104-0f999bedf4a7

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
      case when lr.status in ('FINAL_APPROVED', 'APPLIED')
        then greatest(0, (lr.end_date::date - lr.start_date::date) + 1)
        else 0
      end
    ), 0)::int as used_days,
    coalesce(sum(
      case when lr.status in (
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
      )
        then greatest(0, (lr.end_date::date - lr.start_date::date) + 1)
        else 0
      end
    ), 0)::int as pending_days
  from public.leave_requests lr
  where lr.employee_id = 'f8180354-9667-439b-8104-0f999bedf4a7'::uuid
    and lr.status not in ('REJECTED', 'CANCELLED')
    and extract(year from lr.start_date) = extract(year from now())
  group by lr.employee_id, 2
)
insert into public.leave_balances (
  employee_id, type, year, total_days, used_days, pending_days
)
select
  'f8180354-9667-439b-8104-0f999bedf4a7'::uuid,
  d.type,
  extract(year from now())::int,
  d.total_days,
  coalesce(r.used_days, 0),
  coalesce(r.pending_days, 0)
from leave_type_defaults d
left join request_totals r
  on r.type = d.type
on conflict (employee_id, type, year)
do update set
  total_days = excluded.total_days,
  used_days = excluded.used_days,
  pending_days = excluded.pending_days;

select
  employee_id,
  type,
  year,
  total_days,
  used_days,
  pending_days,
  total_days - used_days - pending_days as balance_days,
  updated_at
from public.leave_balances
where employee_id = 'f8180354-9667-439b-8104-0f999bedf4a7'::uuid
  and year = extract(year from now())::int
order by type;

commit;
