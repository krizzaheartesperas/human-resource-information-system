-- Ensure Junior Software Engineer has current-year rows in public.leave_balances.
--
-- Run in Supabase SQL Editor. This reads/writes only public.leave_balances
-- for employee_id f8180354-9667-439b-8104-0f999bedf4a7.

begin;

-- 1) Confirm the employee exists.
select
  e.id,
  to_jsonb(e)->>'employee_code' as employee_code,
  to_jsonb(e)->>'employee_number' as employee_number,
  coalesce(
    nullif(trim(concat_ws(' ', to_jsonb(e)->>'first_name', to_jsonb(e)->>'last_name')), ''),
    nullif(to_jsonb(e)->>'full_name', ''),
    nullif(to_jsonb(e)->>'name', ''),
    nullif(to_jsonb(e)->>'email', ''),
    nullif(to_jsonb(e)->>'position', ''),
    nullif(to_jsonb(e)->>'job_title', '')
  ) as employee_name
from public.employees e
where e.id = 'f8180354-9667-439b-8104-0f999bedf4a7'::uuid;

-- 2) Show current rows directly from public.leave_balances before repair.
select
  lb.employee_id,
  lb.type,
  lb.year,
  lb.total_days,
  lb.used_days,
  lb.pending_days,
  lb.total_days - lb.used_days - lb.pending_days as balance_days,
  lb.created_at,
  lb.updated_at
from public.leave_balances lb
where lb.employee_id = 'f8180354-9667-439b-8104-0f999bedf4a7'::uuid
order by lb.year desc, lb.type;

-- 3) Insert/update all current-year leave types from leave_requests totals.
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
target_employee as (
  select e.id as employee_id
  from public.employees e
  where e.id = 'f8180354-9667-439b-8104-0f999bedf4a7'::uuid
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
  join target_employee te
    on te.employee_id = lr.employee_id
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
    te.employee_id,
    ltd.type,
    extract(year from now())::integer as year,
    ltd.total_days,
    coalesce(rt.used_days, 0) as used_days,
    coalesce(rt.pending_days, 0) as pending_days
  from target_employee te
  cross join leave_type_defaults ltd
  left join request_totals rt
    on rt.employee_id = te.employee_id
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

-- 4) Show the final rows directly from public.leave_balances.
select
  lb.employee_id,
  lb.type,
  lb.year,
  lb.total_days,
  lb.used_days,
  lb.pending_days,
  lb.total_days - lb.used_days - lb.pending_days as balance_days,
  lb.created_at,
  lb.updated_at
from public.leave_balances lb
where lb.employee_id = 'f8180354-9667-439b-8104-0f999bedf4a7'::uuid
  and lb.year = extract(year from now())::integer
order by lb.type;

commit;
