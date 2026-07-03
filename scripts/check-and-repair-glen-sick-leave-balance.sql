-- Check and repair Glen/Glean Ramos Sick Leave balance for 2026.
--
-- Run this in the Supabase SQL Editor connected to the same project your app uses.
-- It is insert-only for leave_balances: if the row already exists, it is preserved.

begin;

-- 1) Confirm the target employee row exists.
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
where e.id = 'f8180354-9667-439b-8104-0f999bedf4a7'::uuid;

-- 2) Show the exact Sick Leave balance row if it already exists.
select
  lb.*,
  (lb.total_days - lb.used_days - lb.pending_days) as balance_days
from public.leave_balances lb
where lb.employee_id = 'f8180354-9667-439b-8104-0f999bedf4a7'::uuid
  and lb.type = 'SICK_LEAVE'
  and lb.year = 2026;

-- 3) Insert the missing row from leave_requests if it does not exist.
--    Used = final approved/applied sick leave.
--    Pending = active in-progress sick leave.
with target_employee as (
  select 'f8180354-9667-439b-8104-0f999bedf4a7'::uuid as employee_id
),
request_totals as (
  select
    te.employee_id,
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
  from target_employee te
  left join public.leave_requests lr
    on lr.employee_id = te.employee_id
   and lr.type = 'SICK_LEAVE'
   and extract(year from lr.start_date::date)::integer = 2026
   and lr.status not in ('REJECTED', 'CANCELLED')
  group by te.employee_id
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
  rt.employee_id,
  'SICK_LEAVE',
  2026,
  15,
  rt.used_days,
  rt.pending_days
from request_totals rt
where exists (
  select 1
  from public.employees e
  where e.id = rt.employee_id
)
on conflict (employee_id, type, year) do nothing;

-- 4) Show the final row after repair.
select
  lb.*,
  (lb.total_days - lb.used_days - lb.pending_days) as balance_days
from public.leave_balances lb
where lb.employee_id = 'f8180354-9667-439b-8104-0f999bedf4a7'::uuid
  and lb.type = 'SICK_LEAVE'
  and lb.year = 2026;

commit;
