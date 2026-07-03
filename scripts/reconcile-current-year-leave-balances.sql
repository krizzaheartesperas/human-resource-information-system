-- Diagnose and reconcile current-year leave balances for every employee.
--
-- Run in Supabase SQL Editor. This script:
-- 1) shows Glen/Glean Ramos by employee id / code / name,
-- 2) shows his joined leave balances,
-- 3) inserts missing rows for every employee + leave type,
-- 4) updates used_days and pending_days from leave_requests,
-- 5) reports any remaining employee/type gaps.

begin;

-- Find Glen/Glean Ramos. leave_balances does not store names, so search employees.
select
  e.id,
  to_jsonb(e)->>'employee_code' as employee_code,
  to_jsonb(e)->>'employee_number' as employee_number,
  coalesce(
    nullif(trim(concat_ws(' ', to_jsonb(e)->>'first_name', to_jsonb(e)->>'last_name')), ''),
    nullif(to_jsonb(e)->>'full_name', ''),
    nullif(to_jsonb(e)->>'name', ''),
    nullif(to_jsonb(e)->>'email', '')
  ) as display_name
from public.employees e
where e.id = 'f8180354-9667-439b-8104-0f999bedf4a7'::uuid
   or lower(coalesce(to_jsonb(e)->>'employee_code', '')) = 'emp-0002'
   or lower(coalesce(to_jsonb(e)->>'employee_number', '')) = 'emp-0002'
   or lower(coalesce(to_jsonb(e)->>'email', '')) like '%glen%'
   or lower(concat_ws(' ', to_jsonb(e)->>'first_name', to_jsonb(e)->>'last_name', to_jsonb(e)->>'full_name', to_jsonb(e)->>'name')) like '%glen%ramos%'
   or lower(concat_ws(' ', to_jsonb(e)->>'first_name', to_jsonb(e)->>'last_name', to_jsonb(e)->>'full_name', to_jsonb(e)->>'name')) like '%glean%ramos%';

-- Current joined balances for Glen/Glean before reconciliation.
select
  e.id as employee_id,
  coalesce(
    nullif(trim(concat_ws(' ', to_jsonb(e)->>'first_name', to_jsonb(e)->>'last_name')), ''),
    nullif(to_jsonb(e)->>'full_name', ''),
    nullif(to_jsonb(e)->>'name', ''),
    nullif(to_jsonb(e)->>'email', '')
  ) as employee_name,
  coalesce(to_jsonb(e)->>'employee_code', to_jsonb(e)->>'employee_number') as employee_number,
  lb.type,
  lb.year,
  lb.total_days,
  lb.used_days,
  lb.pending_days,
  (lb.total_days - lb.used_days - lb.pending_days) as balance_days
from public.employees e
left join public.leave_balances lb
  on lb.employee_id = e.id
 and lb.year = extract(year from now())::integer
where e.id = 'f8180354-9667-439b-8104-0f999bedf4a7'::uuid
order by lb.type;

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

-- Glen/Glean after reconciliation.
select
  e.id as employee_id,
  coalesce(
    nullif(trim(concat_ws(' ', to_jsonb(e)->>'first_name', to_jsonb(e)->>'last_name')), ''),
    nullif(to_jsonb(e)->>'full_name', ''),
    nullif(to_jsonb(e)->>'name', ''),
    nullif(to_jsonb(e)->>'email', '')
  ) as employee_name,
  coalesce(to_jsonb(e)->>'employee_code', to_jsonb(e)->>'employee_number') as employee_number,
  lb.type,
  lb.year,
  lb.total_days,
  lb.used_days,
  lb.pending_days,
  (lb.total_days - lb.used_days - lb.pending_days) as balance_days
from public.employees e
join public.leave_balances lb
  on lb.employee_id = e.id
 and lb.year = extract(year from now())::integer
where e.id = 'f8180354-9667-439b-8104-0f999bedf4a7'::uuid
order by lb.type;

-- Any employees still missing one of the 8 leave type rows.
with leave_type_defaults(type) as (
  values
    ('VACATION_LEAVE'::text),
    ('SICK_LEAVE'::text),
    ('EMERGENCY_LEAVE'::text),
    ('BEREAVEMENT_LEAVE'::text),
    ('MATERNITY_LEAVE'::text),
    ('PATERNITY_LEAVE'::text),
    ('SOLO_PARENT_LEAVE'::text),
    ('UNPAID_LEAVE'::text)
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
)
select
  e.id as employee_id,
  ltd.type as missing_type
from active_employees e
cross join leave_type_defaults ltd
left join public.leave_balances lb
  on lb.employee_id = e.id
 and lb.type = ltd.type
 and lb.year = extract(year from now())::integer
where lb.id is null
order by e.id, ltd.type;

commit;
