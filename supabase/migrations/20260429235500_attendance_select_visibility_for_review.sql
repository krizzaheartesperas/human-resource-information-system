begin;

-- Attendance Review needs attendance clock_in/clock_out for non-self employees.
-- Keep write paths unchanged (insert/update/delete remain self-only), only expand SELECT.
drop policy if exists attendance_select_own on public.attendance;

create policy attendance_select_visible
on public.attendance
for select
to authenticated
using (
  attendance.employee_id = public.current_employee_id()
  or exists (
    select 1
    from public.employees me
    where me.id = public.current_employee_id()
      and coalesce(me.role::text, '') in (
        'HR_STAFF',
        'HR_ADMIN',
        'HR_MANAGER',
        'SUPER_ADMIN',
        'SYSTEM_ADMIN',
        'AUDITOR',
        'EXECUTIVE'
      )
  )
  or exists (
    select 1
    from public.employees mgr
    inner join public.employees req on req.id = attendance.employee_id
    where mgr.id = public.current_employee_id()
      and coalesce(mgr.role::text, '') = 'DEPARTMENT_MANAGER'
      and req.department_id is not distinct from mgr.department_id
  )
);

commit;

