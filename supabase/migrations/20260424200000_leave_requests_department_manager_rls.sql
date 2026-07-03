-- Department Manager RLS for public.leave_requests.
--
-- Shared database safety:
-- - Does not modify leave request rows.
-- - Only creates/replaces helper functions and named policies.
-- - Grants Department Managers access only to team/direct-report leave rows.

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

create or replace function public.current_user_has_department_leave_access()
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
          'department manager',
          'engineering manager',
          'it manager'
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
          'department manager',
          'engineering manager',
          'it manager'
        )
      )
  );
$$;

revoke all on function public.current_user_has_department_leave_access() from public;
grant execute on function public.current_user_has_department_leave_access() to authenticated;

create or replace function public.current_user_manages_employee(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select
      e.id,
      e.user_id,
      e.auth_user_id,
      e.department_id
    from public.employees e
    where e.id = public.current_employee_id()
    limit 1
  ),
  manager_keys as (
    select key
    from me
    cross join lateral (
      values (me.id), (me.user_id), (me.auth_user_id), (auth.uid())
    ) as keys(key)
    where key is not null
  ),
  target as (
    select t.id, t.department_id, t.manager_id
    from public.employees t
    where t.id = p_employee_id
    limit 1
  )
  select coalesce(
    (
      select
        public.current_user_has_department_leave_access()
        and target.id <> me.id
        and (
          target.manager_id in (select key from manager_keys)
          or target.department_id in (
            select d.id
            from public.departments d
            where d.manager_id in (select key from manager_keys)
          )
          or target.department_id = me.department_id
        )
      from me, target
    ),
    false
  );
$$;

revoke all on function public.current_user_manages_employee(uuid) from public;
grant execute on function public.current_user_manages_employee(uuid) to authenticated;

alter table public.leave_requests enable row level security;

drop policy if exists "leave_requests_select_department_manager_team" on public.leave_requests;
drop policy if exists "leave_requests_update_department_manager_team" on public.leave_requests;

create policy "leave_requests_select_department_manager_team"
on public.leave_requests
for select
to authenticated
using (public.current_user_manages_employee(employee_id));

create policy "leave_requests_update_department_manager_team"
on public.leave_requests
for update
to authenticated
using (
  status = 'PENDING_APPROVAL'
  and public.current_user_manages_employee(employee_id)
)
with check (
  status in ('PENDING_FINALIZATION', 'REJECTED')
  and public.current_user_manages_employee(employee_id)
);

commit;
