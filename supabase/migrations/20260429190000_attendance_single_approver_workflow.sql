begin;

-- ---------------------------------------------------------------------------
-- overtime_requests: approval audit columns
-- ---------------------------------------------------------------------------
alter table public.overtime_requests
  add column if not exists approved_by uuid null references public.employees (id) on delete set null;

alter table public.overtime_requests
  add column if not exists approved_at timestamptz null;

-- status / remarks already exist from initial migration

create index if not exists idx_overtime_requests_approved_by
  on public.overtime_requests (approved_by)
  where approved_by is not null;

-- ---------------------------------------------------------------------------
-- attendance_correction_requests: approval audit columns
-- ---------------------------------------------------------------------------
alter table public.attendance_correction_requests
  add column if not exists approved_by uuid null references public.employees (id) on delete set null;

alter table public.attendance_correction_requests
  add column if not exists approved_at timestamptz null;

create index if not exists idx_attendance_correction_requests_approved_by
  on public.attendance_correction_requests (approved_by)
  where approved_by is not null;

-- ---------------------------------------------------------------------------
-- overtime_requests RLS (single approver: DEPARTMENT_MANAGER for team OT)
-- HR: read-only (SELECT). No broad UPDATE.
-- ---------------------------------------------------------------------------
drop policy if exists overtime_requests_select_own_or_hr on public.overtime_requests;
drop policy if exists overtime_requests_insert_own on public.overtime_requests;
drop policy if exists overtime_requests_update_own_or_hr on public.overtime_requests;
drop policy if exists overtime_requests_delete_own_or_hr on public.overtime_requests;

create policy overtime_requests_select_visible
on public.overtime_requests
for select
to authenticated
using (
  employee_id = public.current_employee_id()
  or exists (
    select 1
    from public.employees mgr
    inner join public.employees req on req.id = overtime_requests.employee_id
    where mgr.id = public.current_employee_id()
      and coalesce(mgr.role::text, '') = 'DEPARTMENT_MANAGER'
      and req.department_id is not distinct from mgr.department_id
  )
  or exists (
    select 1
    from public.employees me
    where me.id = public.current_employee_id()
      and coalesce(me.role::text, '') in (
        'HR_STAFF',
        'HR_ADMIN',
        'HR_MANAGER',
        'SUPER_ADMIN',
        'SYSTEM_ADMIN'
      )
  )
);

create policy overtime_requests_insert_own
on public.overtime_requests
for insert
to authenticated
with check (employee_id = public.current_employee_id());

create policy overtime_requests_update_dept_manager_only
on public.overtime_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.employees mgr
    inner join public.employees req on req.id = overtime_requests.employee_id
    where mgr.id = public.current_employee_id()
      and coalesce(mgr.role::text, '') = 'DEPARTMENT_MANAGER'
      and req.department_id is not distinct from mgr.department_id
      and req.id <> mgr.id
  )
)
with check (
  exists (
    select 1
    from public.employees mgr
    inner join public.employees req on req.id = overtime_requests.employee_id
    where mgr.id = public.current_employee_id()
      and coalesce(mgr.role::text, '') = 'DEPARTMENT_MANAGER'
      and req.department_id is not distinct from mgr.department_id
      and req.id <> mgr.id
  )
);

create policy overtime_requests_delete_own
on public.overtime_requests
for delete
to authenticated
using (employee_id = public.current_employee_id());

-- ---------------------------------------------------------------------------
-- attendance_correction_requests RLS
-- SELECT: submitter, all HR_STAFF, read-only HR_ADMIN / HR_MANAGER / SUPER_ADMIN
-- UPDATE: HR_STAFF only
-- ---------------------------------------------------------------------------
drop policy if exists attendance_correction_requests_select_own_or_reviewer on public.attendance_correction_requests;
drop policy if exists attendance_correction_requests_insert_own on public.attendance_correction_requests;
drop policy if exists attendance_correction_requests_update_reviewer on public.attendance_correction_requests;
drop policy if exists attendance_correction_requests_delete_own_or_reviewer on public.attendance_correction_requests;

create policy attendance_correction_requests_select_visible
on public.attendance_correction_requests
for select
to authenticated
using (
  employee_id = public.current_employee_id()
  or exists (
    select 1
    from public.employees me
    where me.id = public.current_employee_id()
      and coalesce(me.role::text, '') in (
        'HR_STAFF',
        'HR_ADMIN',
        'HR_MANAGER',
        'SUPER_ADMIN',
        'SYSTEM_ADMIN'
      )
  )
);

create policy attendance_correction_requests_insert_own
on public.attendance_correction_requests
for insert
to authenticated
with check (employee_id = public.current_employee_id());

create policy attendance_correction_requests_update_hr_staff_only
on public.attendance_correction_requests
for update
to authenticated
using (
  attendance_correction_requests.employee_id <> public.current_employee_id()
  and exists (
    select 1
    from public.employees me
    where me.id = public.current_employee_id()
      and coalesce(me.role::text, '') = 'HR_STAFF'
  )
)
with check (
  attendance_correction_requests.employee_id <> public.current_employee_id()
  and exists (
    select 1
    from public.employees me
    where me.id = public.current_employee_id()
      and coalesce(me.role::text, '') = 'HR_STAFF'
  )
);

create policy attendance_correction_requests_delete_own
on public.attendance_correction_requests
for delete
to authenticated
using (employee_id = public.current_employee_id());

commit;
