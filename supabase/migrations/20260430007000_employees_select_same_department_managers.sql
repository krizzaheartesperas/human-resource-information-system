begin;

-- Department managers must read peer employee rows (names, dept) for Team Time tables.
-- Prior rules used departments.manager_id / direct reports only, not same employees.department_id.

drop policy if exists "employees_select_department_manager_scope" on public.employees;

create policy "employees_select_department_manager_scope"
on public.employees
for select
to authenticated
using (
  user_id = auth.uid()
  or id = public.current_employee_id()
  or manager_id = public.current_employee_id()
  or manager_id = auth.uid()
  or department_id in (
    select d.id
    from public.departments d
    where d.manager_id = public.current_employee_id()
       or d.manager_id = auth.uid()
  )
  or exists (
    select 1
    from public.employees me
    where me.id = public.current_employee_id()
      and coalesce(me.role::text, '') in ('DEPARTMENT_MANAGER', 'MANAGER')
      and me.department_id is not null
      and public.employees.department_id is not distinct from me.department_id
  )
);

commit;
