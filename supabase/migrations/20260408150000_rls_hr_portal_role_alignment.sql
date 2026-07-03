-- Company-wide leave access + HR-wide employee SELECT: employees.position (job_title fallback).
-- HR branch uses current_user_has_company_leave_access() (SECURITY DEFINER) to avoid RLS
-- recursion from "EXISTS (SELECT ... FROM employees ...)" inside employees policies.

begin;

alter table public.employees add column if not exists position text;
alter table public.employees add column if not exists job_title text;

drop function if exists public.employee_row_has_company_leave_access(text, text, text);

create or replace function public.employee_row_has_company_leave_access(
  p_position text,
  p_job_title text
)
returns boolean
language sql
immutable
as $$
  select lower(trim(coalesce(
    nullif(trim(coalesce(p_position, '')), ''),
    nullif(trim(coalesce(p_job_title, '')), '')
  ))) in (
    'hr',
    'hr staff',
    'hr admin',
    'hr administrator',
    'hr manager',
    'hr coordinator',
    'hr director',
    'human resources',
    'system admin',
    'system administrator',
    'audit officer',
    'executive'
  );
$$;

revoke all on function public.employee_row_has_company_leave_access(text, text) from public;
grant execute on function public.employee_row_has_company_leave_access(text, text) to authenticated;

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
