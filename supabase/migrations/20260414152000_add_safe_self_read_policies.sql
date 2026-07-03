-- Safe additive RLS patch:
-- Adds self-read policies for employees/profiles without removing existing teammate policies.
-- This is designed for shared databases and avoids disrupting manager/HR access rules.

begin;

-- Ensure RLS remains enabled (no-op if already enabled)
alter table public.employees enable row level security;
alter table public.profiles enable row level security;

-- employees: authenticated user can read their own employee row.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'employees'
      and policyname = 'employees_select_self_safe'
  ) then
    create policy employees_select_self_safe
    on public.employees
    for select
    to authenticated
    using (
      id = public.current_employee_id()
      or user_id = auth.uid()
      or auth_user_id = auth.uid()
    );
  end if;
end
$$;

-- profiles: authenticated user can read their own profile row.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_select_self_safe'
  ) then
    create policy profiles_select_self_safe
    on public.profiles
    for select
    to authenticated
    using (user_id = auth.uid());
  end if;
end
$$;

commit;

