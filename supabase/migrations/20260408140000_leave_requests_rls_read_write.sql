-- Row Level Security for public.leave_requests
--
-- The Table Editor uses the service role and sees every row; the Next.js app uses the
-- anon key with a logged-in user (JWT → authenticated). Without matching policies, SELECT
-- can return a subset or nothing while two rows still appear in the dashboard UI.
--
-- Requires public.current_employee_id() (see 20260327173000_employees_department_manager_visibility_fix.sql).

begin;

alter table public.leave_requests enable row level security;

drop policy if exists "leave_requests_select_own" on public.leave_requests;
drop policy if exists "leave_requests_select_hr" on public.leave_requests;
drop policy if exists "leave_requests_insert_own" on public.leave_requests;
drop policy if exists "leave_requests_insert_hr" on public.leave_requests;
drop policy if exists "leave_requests_update_own" on public.leave_requests;
drop policy if exists "leave_requests_update_hr" on public.leave_requests;
drop policy if exists "leave_requests_delete_hr" on public.leave_requests;

-- Submitters read their own requests (same employee_id as signed-in profile).
create policy "leave_requests_select_own"
on public.leave_requests
for select
to authenticated
using (employee_id = public.current_employee_id());

-- HR / admin roles read every leave request (company-wide queues).
create policy "leave_requests_select_hr"
on public.leave_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.employees me
    where me.id = public.current_employee_id()
      and coalesce(me.role::text, '') in (
        'HR_STAFF',
        'HR_ADMIN',
        'HR_MANAGER',
        'SUPER_ADMIN'
      )
  )
);

-- Employees create requests for themselves.
create policy "leave_requests_insert_own"
on public.leave_requests
for insert
to authenticated
with check (employee_id = public.current_employee_id());

-- HR can insert on behalf of anyone (sync / seed / corrections).
create policy "leave_requests_insert_hr"
on public.leave_requests
for insert
to authenticated
with check (
  exists (
    select 1
    from public.employees me
    where me.id = public.current_employee_id()
      and coalesce(me.role::text, '') in (
        'HR_STAFF',
        'HR_ADMIN',
        'HR_MANAGER',
        'SUPER_ADMIN'
      )
  )
);

-- Employees may update only their own rows (e.g. cancel / edit while pending).
create policy "leave_requests_update_own"
on public.leave_requests
for update
to authenticated
using (employee_id = public.current_employee_id())
with check (employee_id = public.current_employee_id());

-- HR can update any row (workflow transitions, app upsert).
create policy "leave_requests_update_hr"
on public.leave_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.employees me
    where me.id = public.current_employee_id()
      and coalesce(me.role::text, '') in (
        'HR_STAFF',
        'HR_ADMIN',
        'HR_MANAGER',
        'SUPER_ADMIN'
      )
  )
)
with check (true);

-- HR can delete stray / test rows (optional; app rarely deletes).
create policy "leave_requests_delete_hr"
on public.leave_requests
for delete
to authenticated
using (
  exists (
    select 1
    from public.employees me
    where me.id = public.current_employee_id()
      and coalesce(me.role::text, '') in (
        'HR_STAFF',
        'HR_ADMIN',
        'HR_MANAGER',
        'SUPER_ADMIN'
      )
  )
);

commit;
