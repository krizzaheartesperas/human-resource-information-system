-- Debug public.leave_balances RLS visibility for EMP-0002 / Glen-Glean Ramos.
--
-- Run in Supabase SQL Editor. The first sections inspect the real table,
-- grants, policies, helper functions, employee mapping, and balance rows.
--
-- To simulate the app's authenticated session, replace the AUTH_USER_ID value
-- near the bottom with the user's Supabase Auth UUID from Authentication > Users.

begin;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n
  on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'leave_balances';

select
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'leave_balances'
  and grantee in ('authenticated', 'anon')
order by grantee, privilege_type;

select
  policyname,
  cmd,
  roles,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'public'
  and tablename = 'leave_balances'
order by policyname;

select
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'current_employee_id',
    'current_user_has_company_leave_access',
    'adjust_leave_balance'
  )
order by p.proname;

select
  e.id,
  e.user_id,
  e.auth_user_id,
  to_jsonb(e)->>'employee_code' as employee_code,
  to_jsonb(e)->>'employee_number' as employee_number,
  coalesce(
    nullif(trim(concat_ws(' ', to_jsonb(e)->>'first_name', to_jsonb(e)->>'last_name')), ''),
    nullif(to_jsonb(e)->>'full_name', ''),
    nullif(to_jsonb(e)->>'name', ''),
    nullif(to_jsonb(e)->>'email', '')
  ) as employee_name,
  to_jsonb(e)->>'email' as email,
  to_jsonb(e)->>'role' as role,
  to_jsonb(e)->>'portal_role' as portal_role,
  to_jsonb(e)->>'position' as position,
  to_jsonb(e)->>'job_title' as job_title
from public.employees e
where e.id = 'f8180354-9667-439b-8104-0f999bedf4a7'::uuid
   or to_jsonb(e)->>'employee_code' = 'EMP-0002'
   or to_jsonb(e)->>'employee_number' = 'EMP-0002'
   or lower(coalesce(to_jsonb(e)->>'full_name', '')) like '%ramos%'
   or lower(trim(concat_ws(' ', to_jsonb(e)->>'first_name', to_jsonb(e)->>'last_name'))) like '%ramos%'
order by employee_number nulls last, employee_name nulls last;

select
  lb.employee_id,
  lb.type,
  lb.year,
  lb.total_days,
  lb.used_days,
  lb.pending_days,
  lb.total_days - lb.used_days - lb.pending_days as balance_days,
  lb.updated_at
from public.leave_balances lb
where lb.employee_id = 'f8180354-9667-439b-8104-0f999bedf4a7'::uuid
order by lb.year desc, lb.type;

-- Optional: if SQL Editor can read auth.users, this helps find the auth UUID
-- that must be stored in employees.user_id or employees.auth_user_id.
select
  u.id as auth_user_id,
  u.email
from auth.users u
where exists (
  select 1
  from public.employees e
  where e.id = 'f8180354-9667-439b-8104-0f999bedf4a7'::uuid
    and lower(coalesce(to_jsonb(e)->>'email', '')) = lower(u.email)
)
order by u.email;

commit;

-- ---------------------------------------------------------------------------
-- Authenticated-session simulation.
-- ---------------------------------------------------------------------------
-- Replace 00000000-0000-0000-0000-000000000000 with Glen/Glean's Auth user ID,
-- then run this block by itself. Expected:
--   auth_uid = that Auth user ID
--   current_employee_id = f8180354-9667-439b-8104-0f999bedf4a7
--   visible_balance_rows = 8 for a normal employee, or more for HR/company roles
--
-- begin;
-- set local role authenticated;
-- select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
--
-- select
--   auth.uid() as auth_uid,
--   public.current_employee_id() as current_employee_id,
--   public.current_user_has_company_leave_access() as has_company_leave_access;
--
-- select
--   count(*) as visible_balance_rows
-- from public.leave_balances;
--
-- select
--   employee_id,
--   type,
--   year,
--   total_days,
--   used_days,
--   pending_days,
--   total_days - used_days - pending_days as balance_days
-- from public.leave_balances
-- where employee_id = 'f8180354-9667-439b-8104-0f999bedf4a7'::uuid
-- order by type;
--
-- rollback;
