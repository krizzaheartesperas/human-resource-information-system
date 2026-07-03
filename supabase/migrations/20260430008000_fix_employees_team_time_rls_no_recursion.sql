begin;

-- Fix recursion-prone employees RLS for Team Time name resolution.
-- Do not query public.employees from inside an employees policy expression.
-- Use SECURITY DEFINER helpers for current user's role/department.

create or replace function public.current_employee_role_text()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(e.role::text, '')
  from public.employees e
  where e.id = public.current_employee_id()
  limit 1
$$;

create or replace function public.current_employee_department_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.department_id
  from public.employees e
  where e.id = public.current_employee_id()
  limit 1
$$;

revoke all on function public.current_employee_role_text() from public;
grant execute on function public.current_employee_role_text() to authenticated;
revoke all on function public.current_employee_department_id() from public;
grant execute on function public.current_employee_department_id() to authenticated;

drop policy if exists "employees_select_department_manager_scope" on public.employees;

create policy "employees_select_department_manager_scope"
on public.employees
for select
to authenticated
using (
  user_id = auth.uid()
  or auth_user_id = auth.uid()
  or id = public.current_employee_id()
  or manager_id = public.current_employee_id()
  or manager_id = auth.uid()
  or department_id in (
    select d.id
    from public.departments d
    where d.manager_id = public.current_employee_id()
       or d.manager_id = auth.uid()
  )
  or (
    public.current_employee_role_text() in ('DEPARTMENT_MANAGER', 'MANAGER')
    and public.current_employee_department_id() is not null
    and public.employees.department_id is not distinct from public.current_employee_department_id()
  )
);

-- If attendance visibility helper exists, allow reading employee rows visible in Team Time attendance.
do $$
begin
  if to_regprocedure('public.attendance_row_select_allowed(uuid)') is not null then
    execute 'drop policy if exists "employees_select_visible_team_attendance" on public.employees';
    execute '
      create policy "employees_select_visible_team_attendance"
      on public.employees
      for select
      to authenticated
      using (public.attendance_row_select_allowed(public.employees.id))
    ';
  end if;
end
$$;

commit;
