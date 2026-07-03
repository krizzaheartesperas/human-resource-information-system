-- Row Level Security for public.leave_balances
--
-- Employees need to read and update their own current-year balance rows when
-- submitting/cancelling leave from the app. HR/admin roles need company-wide
-- access for balance monitoring and corrections.
--
-- Known app users / labels:
-- - Employee / Junior Software Engineer: own leave balance only
-- - HR Staff, HR Admin, HR Manager, Auditor, Executive, System Admin: company access
-- - Department Manager / Engineering Manager: company/team leave management access
--
-- Role/title sources in this database:
-- - employees.user_id/auth_user_id -> auth.users.id
-- - profiles.user_id -> auth.users.id
-- - user_system_access.user_id -> auth.users.id, with active HRIS role in system_roles

begin;

alter table public.employees add column if not exists user_id uuid;
alter table public.employees add column if not exists auth_user_id uuid;

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

create or replace function public.current_user_has_company_leave_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employees e
    where e.id = public.current_employee_id()
      and exists (
        select 1
        from unnest(array[
          to_jsonb(e)->>'role',
          to_jsonb(e)->>'portal_role',
          to_jsonb(e)->>'position',
          to_jsonb(e)->>'job_title'
        ]) as field_value(raw_value)
        where replace(lower(trim(coalesce(field_value.raw_value, ''))), '_', ' ') in (
          'hr staff',
          'hr admin',
          'hr manager',
          'department manager',
          'engineering manager',
          -- Stored code for the System Admin account in employees.role.
          'super admin',
          'system admin',
          -- Stored HRIS role name for the Auditor account in system_roles.name.
          'audit officer',
          'auditor',
          'executive'
        )
      )
  )
  or exists (
    select 1
    from public.user_system_access usa
    join public.systems s
      on s.id = usa.system_id
    left join public.system_roles sr
      on sr.id = usa.system_role_id
    where usa.user_id = auth.uid()
      and usa.status = 'active'
      and s.code = 'hris'
      and exists (
        select 1
        from unnest(array[
          usa.role,
          sr.code,
          sr.name
        ]) as access_value(raw_value)
        where replace(lower(trim(coalesce(access_value.raw_value, ''))), '_', ' ') in (
          'hr staff',
          'hr admin',
          'hr manager',
          'department manager',
          'engineering manager',
          'super admin',
          'system admin',
          'audit officer',
          'auditor',
          'executive'
        )
      )
  );
$$;

revoke all on function public.current_user_has_company_leave_access() from public;
grant execute on function public.current_user_has_company_leave_access() to authenticated;

alter table public.leave_balances enable row level security;

grant select, insert, update, delete on public.leave_balances to authenticated;

drop policy if exists "leave_balances_select_own" on public.leave_balances;
drop policy if exists "leave_balances_select_company" on public.leave_balances;
drop policy if exists "leave_balances_insert_own" on public.leave_balances;
drop policy if exists "leave_balances_insert_company" on public.leave_balances;
drop policy if exists "leave_balances_update_own" on public.leave_balances;
drop policy if exists "leave_balances_update_company" on public.leave_balances;
drop policy if exists "leave_balances_delete_company" on public.leave_balances;

create policy "leave_balances_select_own"
on public.leave_balances
for select
to authenticated
using (employee_id = public.current_employee_id());

create policy "leave_balances_select_company"
on public.leave_balances
for select
to authenticated
using (public.current_user_has_company_leave_access());

create policy "leave_balances_insert_own"
on public.leave_balances
for insert
to authenticated
with check (employee_id = public.current_employee_id());

create policy "leave_balances_insert_company"
on public.leave_balances
for insert
to authenticated
with check (public.current_user_has_company_leave_access());

create policy "leave_balances_update_own"
on public.leave_balances
for update
to authenticated
using (employee_id = public.current_employee_id())
with check (employee_id = public.current_employee_id());

create policy "leave_balances_update_company"
on public.leave_balances
for update
to authenticated
using (public.current_user_has_company_leave_access())
with check (public.current_user_has_company_leave_access());

create policy "leave_balances_delete_company"
on public.leave_balances
for delete
to authenticated
using (public.current_user_has_company_leave_access());

commit;
