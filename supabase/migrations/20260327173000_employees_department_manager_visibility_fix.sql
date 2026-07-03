-- Fix employees visibility for Department Managers without recursive RLS.
-- Scope:
-- 1) User can read own employee row
-- 2) Department Manager can read direct reports (employees.manager_id = my employee id)
-- 3) Department Manager can read employees in departments they manage (departments.manager_id = my employee id)
-- 4) HR/Admin/Super Admin can read all employees

begin;

-- Helper: current signed-in employee id (by employees.user_id = auth.uid()).
create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.id
  from public.employees e
  where e.user_id = auth.uid()
  limit 1
$$;

revoke all on function public.current_employee_id() from public;
grant execute on function public.current_employee_id() to authenticated;

-- Ensure RLS is enabled.
alter table public.employees enable row level security;
alter table public.departments enable row level security;

-- Remove conflicting/recursive policies if present.
drop policy if exists "employees_select_department_manager_scope" on public.employees;
drop policy if exists "employees_select_authenticated" on public.employees;
drop policy if exists "employees_select_self_only" on public.employees;
drop policy if exists "departments_select_authenticated" on public.departments;

-- Employees read policy with safe non-recursive conditions.
create policy "employees_select_department_manager_scope"
on public.employees
for select
to authenticated
using (
  -- Own employee row.
  id = public.current_employee_id()
  or
  -- Direct reports.
  manager_id = public.current_employee_id()
  or manager_id = auth.uid()
  or
  -- Members of departments managed by current employee.
  department_id in (
    select d.id
    from public.departments d
    where d.manager_id = public.current_employee_id()
       or d.manager_id = auth.uid()
  )
);

-- Departments readable to authenticated users (needed for name mapping).
create policy "departments_select_authenticated"
on public.departments
for select
to authenticated
using (true);

commit;

