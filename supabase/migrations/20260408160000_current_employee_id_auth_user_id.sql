-- Fix leave_requests (and other RLS) returning 0 rows while Table Editor shows data.
--
-- public.current_employee_id() previously only matched employees.user_id. The Next.js app
-- also resolves login via employees.auth_user_id (see supabaseAuth.fetchEmployeeForAuthUser).
-- When only auth_user_id was set, JWT login worked but RLS saw NULL employee id → no SELECT.
--
-- Safe on schemas that only have one of the columns (add missing column as nullable first).

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

commit;
