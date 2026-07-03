-- RLS policies must NOT use "EXISTS (SELECT ... FROM employees ...)" on public.employees:
-- the inner scan re-applies employees RLS → infinite recursion.
--
-- Use SECURITY DEFINER helper to read the current user's row without RLS.

begin;

create or replace function public.current_user_has_company_leave_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select public.employee_row_has_company_leave_access(e.position::text, e.job_title::text)
      from public.employees e
      where e.id = public.current_employee_id()
      limit 1
    ),
    false
  );
$$;

revoke all on function public.current_user_has_company_leave_access() from public;
grant execute on function public.current_user_has_company_leave_access() to authenticated;

drop policy if exists "employees_select_hr_company_wide" on public.employees;

create policy "employees_select_hr_company_wide"
on public.employees
for select
to authenticated
using (public.current_user_has_company_leave_access());

drop policy if exists "leave_requests_select_hr" on public.leave_requests;
drop policy if exists "leave_requests_insert_hr" on public.leave_requests;
drop policy if exists "leave_requests_update_hr" on public.leave_requests;
drop policy if exists "leave_requests_delete_hr" on public.leave_requests;

create policy "leave_requests_select_hr"
on public.leave_requests
for select
to authenticated
using (public.current_user_has_company_leave_access());

create policy "leave_requests_insert_hr"
on public.leave_requests
for insert
to authenticated
with check (public.current_user_has_company_leave_access());

create policy "leave_requests_update_hr"
on public.leave_requests
for update
to authenticated
using (public.current_user_has_company_leave_access())
with check (true);

create policy "leave_requests_delete_hr"
on public.leave_requests
for delete
to authenticated
using (public.current_user_has_company_leave_access());

commit;
