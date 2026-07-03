-- Run in Supabase Dashboard → SQL Editor (postgres).
-- Links auth.users to public.employees so the app can load your job row after sign-in.

-- 1) Auth UUID for an email (replace the email)
select id as auth_user_id, email, created_at
from auth.users
where email ilike 'jon.garcia@gmail.com';

-- 2) See employee rows and current user_id (spot mismatches)
select id, user_id, employee_code, position, portal_role
from public.employees
order by updated_at desc nulls last;

-- 3) Fix: set employees.user_id to the id from step 1 (replace both placeholders)
-- update public.employees
-- set user_id = 'PASTE_AUTH_USER_ID_FROM_STEP_1'
-- where id = 'PASTE_EMPLOYEES_PRIMARY_KEY_FROM_STEP_2';
-- Example by code:
-- update public.employees
-- set user_id = 'PASTE_AUTH_USER_ID_FROM_STEP_1'
-- where employee_code = 'EMP-0003';
