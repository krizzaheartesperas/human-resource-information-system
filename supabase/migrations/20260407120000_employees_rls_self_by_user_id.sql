-- Ensure authenticated users can read their own employees row when user_id = auth.uid(),
-- without relying only on current_employee_id() (helps hosted DBs / policy edge cases).

begin;

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
);

commit;
