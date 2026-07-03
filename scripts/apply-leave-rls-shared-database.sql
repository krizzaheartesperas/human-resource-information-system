-- =============================================================================
-- ONE-TIME (or re-runnable) fix: leave_requests visibility + HR access (shared DB)
-- =============================================================================
-- Safe for a shared database:
--   - Does NOT delete, truncate, or drop tables.
--   - Does NOT touch rows in leave_requests or employees.
--   - Only adds nullable columns IF NOT EXISTS on public.employees.
--   - Replaces named RLS policies and functions (same names as repo migrations).
--
-- HR checks use current_user_has_company_leave_access() (SECURITY DEFINER) so policies
-- never subquery public.employees under RLS (that caused infinite recursion).
--
-- Run in: Supabase Dashboard → SQL Editor → paste → Run.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) Columns (no-op if already present; no data loss)
-- ---------------------------------------------------------------------------
alter table public.employees add column if not exists user_id uuid;
alter table public.employees add column if not exists auth_user_id uuid;
alter table public.employees add column if not exists position text;
alter table public.employees add column if not exists job_title text;

-- ---------------------------------------------------------------------------
-- 2) Resolve signed-in user → employees.id (JWT must match user_id OR auth_user_id)
-- ---------------------------------------------------------------------------
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
     or e.auth_user_id = auth.uid()
  limit 1
$$;

revoke all on function public.current_employee_id() from public;
grant execute on function public.current_employee_id() to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Title check (immutable helper; no table access)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 4) Read current user’s position/title WITHOUT re-entering employees RLS
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 5) leave_requests: RLS + policies
-- ---------------------------------------------------------------------------
alter table public.leave_requests enable row level security;

drop policy if exists "leave_requests_select_own" on public.leave_requests;
drop policy if exists "leave_requests_select_hr" on public.leave_requests;
drop policy if exists "leave_requests_insert_own" on public.leave_requests;
drop policy if exists "leave_requests_insert_hr" on public.leave_requests;
drop policy if exists "leave_requests_update_own" on public.leave_requests;
drop policy if exists "leave_requests_update_hr" on public.leave_requests;
drop policy if exists "leave_requests_delete_hr" on public.leave_requests;

create policy "leave_requests_select_own"
on public.leave_requests
for select
to authenticated
using (employee_id = public.current_employee_id());

create policy "leave_requests_select_hr"
on public.leave_requests
for select
to authenticated
using (public.current_user_has_company_leave_access());

create policy "leave_requests_insert_own"
on public.leave_requests
for insert
to authenticated
with check (employee_id = public.current_employee_id());

create policy "leave_requests_insert_hr"
on public.leave_requests
for insert
to authenticated
with check (public.current_user_has_company_leave_access());

create policy "leave_requests_update_own"
on public.leave_requests
for update
to authenticated
using (employee_id = public.current_employee_id())
with check (employee_id = public.current_employee_id());

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

-- ---------------------------------------------------------------------------
-- 6) employees: HR can SELECT all rows (no self-referential subquery in policy)
-- ---------------------------------------------------------------------------
drop policy if exists "employees_select_hr_company_wide" on public.employees;

create policy "employees_select_hr_company_wide"
on public.employees
for select
to authenticated
using (public.current_user_has_company_leave_access());

commit;
