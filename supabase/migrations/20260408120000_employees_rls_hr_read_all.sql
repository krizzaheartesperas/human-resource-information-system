-- Allow HR (by employees.role) to read all employee rows. Superseded for leave/HR-wide access by
-- 20260408150000, which uses position/job_title instead — this policy is replaced when that migration runs.
--
-- Requires public.current_employee_id() (see 20260327173000_employees_department_manager_visibility_fix.sql).

begin;

drop policy if exists "employees_select_hr_company_wide" on public.employees;

create policy "employees_select_hr_company_wide"
on public.employees
for select
to authenticated
using (
  exists (
    select 1
    from public.employees me
    where me.id = public.current_employee_id()
      and coalesce(me.role::text, '') in (
        'HR_STAFF',
        'HR_ADMIN',
        'HR_MANAGER',
        'SUPER_ADMIN'
      )
  )
);

commit;
