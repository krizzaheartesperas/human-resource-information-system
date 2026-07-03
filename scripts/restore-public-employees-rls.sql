-- Run in Supabase → SQL Editor after employees (or related tables) were recreated and lost RLS policies.
-- Fixes: "RLS enabled but no policies" → Data API returns zero rows.
--
-- Restores:
--   - public.current_employee_id() helper
--   - public.current_user_has_company_leave_access() helper
--   - SELECT on employees (self + dept manager scope + company leave roles)
--   - SELECT on departments (all authenticated)
--   - SELECT/INSERT/UPDATE/DELETE on leave_balances (self + company leave roles)
--   - UPDATE own employees row (account / profile-style updates)
--   - Realtime publication + atomic public.adjust_leave_balance() RPC
--   - Drops old public.leave_balances_with_employee helper relation; app reads public.leave_balances directly.

begin;

-- Ensure both link columns exist (app + RLS use user_id and/or auth_user_id).
alter table public.employees add column if not exists user_id uuid;
alter table public.employees add column if not exists auth_user_id uuid;

-- Helper: resolve current user's employee PK (matches app login: user_id OR auth_user_id).
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
          'super admin',
          'system admin',
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

alter table public.employees enable row level security;
alter table public.departments enable row level security;
alter table public.leave_balances enable row level security;
alter table public.leave_balances replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.leave_balances;
    exception
      when duplicate_object then null;
    end;
  end if;
end
$$;

drop policy if exists "employees_select_department_manager_scope" on public.employees;
drop policy if exists "employees_select_company_leave_access" on public.employees;
drop policy if exists "employees_select_authenticated" on public.employees;
drop policy if exists "employees_select_self_only" on public.employees;
drop policy if exists "employees_update_self" on public.employees;
drop policy if exists "departments_select_authenticated" on public.departments;
drop policy if exists "leave_balances_select_own" on public.leave_balances;
drop policy if exists "leave_balances_select_company" on public.leave_balances;
drop policy if exists "leave_balances_insert_own" on public.leave_balances;
drop policy if exists "leave_balances_insert_company" on public.leave_balances;
drop policy if exists "leave_balances_update_own" on public.leave_balances;
drop policy if exists "leave_balances_update_company" on public.leave_balances;
drop policy if exists "leave_balances_delete_company" on public.leave_balances;

do $$
declare
  relation_kind "char";
begin
  select c.relkind
    into relation_kind
  from pg_class c
  join pg_namespace n
    on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'leave_balances_with_employee';

  if relation_kind = 'v' then
    execute 'drop view public.leave_balances_with_employee';
  elsif relation_kind = 'm' then
    execute 'drop materialized view public.leave_balances_with_employee';
  elsif relation_kind in ('r', 'p') then
    execute 'drop table public.leave_balances_with_employee';
  end if;
end
$$;

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

create policy "employees_select_company_leave_access"
on public.employees
for select
to authenticated
using (public.current_user_has_company_leave_access());

grant select, update on public.employees to authenticated;
grant select on public.departments to authenticated;
grant select, insert, update, delete on public.leave_balances to authenticated;

-- Lets users update their own row (e.g. account page) when auth is linked either way.
create policy "employees_update_self"
on public.employees
for update
to authenticated
using (user_id = auth.uid() or auth_user_id = auth.uid())
with check (user_id = auth.uid() or auth_user_id = auth.uid());

create policy "departments_select_authenticated"
on public.departments
for select
to authenticated
using (true);

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

create or replace function public.adjust_leave_balance(
  p_employee_id uuid,
  p_type text,
  p_year integer,
  p_total_days integer,
  p_pending_delta integer,
  p_used_delta integer
)
returns public.leave_balances
language plpgsql
security definer
set search_path = public
as $$
declare
  next_row public.leave_balances;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if p_employee_id is null then
    raise exception 'employee_id is required'
      using errcode = '22023';
  end if;

  if p_employee_id <> public.current_employee_id()
     and not public.current_user_has_company_leave_access() then
    raise exception 'Not allowed to adjust this leave balance'
      using errcode = '42501';
  end if;

  insert into public.leave_balances (
    employee_id,
    type,
    year,
    total_days,
    used_days,
    pending_days
  )
  values (
    p_employee_id,
    p_type,
    coalesce(p_year, extract(year from now())::integer),
    greatest(0, coalesce(p_total_days, 0)),
    greatest(0, coalesce(p_used_delta, 0)),
    greatest(0, coalesce(p_pending_delta, 0))
  )
  on conflict (employee_id, type, year)
  do update set
    used_days = greatest(0, public.leave_balances.used_days + coalesce(p_used_delta, 0)),
    pending_days = greatest(0, public.leave_balances.pending_days + coalesce(p_pending_delta, 0))
  returning * into next_row;

  return next_row;
end;
$$;

revoke all on function public.adjust_leave_balance(uuid, text, integer, integer, integer, integer) from public;
grant execute on function public.adjust_leave_balance(uuid, text, integer, integer, integer, integer) to authenticated;

commit;
