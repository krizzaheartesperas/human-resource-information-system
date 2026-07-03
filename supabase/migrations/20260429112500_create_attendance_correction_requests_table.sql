begin;

create table if not exists public.attendance_correction_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  attendance_id uuid null references public.attendance(id) on delete set null,
  attendance_date date not null,
  requested_clock_in time without time zone null,
  requested_clock_out time without time zone null,
  reason text not null,
  attachment_name text null,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  remarks text null,
  created_at timestamp without time zone not null default now(),
  updated_at timestamp without time zone not null default now()
);

create index if not exists idx_attendance_correction_requests_employee_date
  on public.attendance_correction_requests(employee_id, attendance_date desc);

create index if not exists idx_attendance_correction_requests_status
  on public.attendance_correction_requests(status);

drop trigger if exists set_updated_at on public.attendance_correction_requests;
create trigger set_updated_at
before update on public.attendance_correction_requests
for each row execute function public.set_updated_at();

alter table public.attendance_correction_requests enable row level security;

drop policy if exists attendance_correction_requests_select_own_or_reviewer on public.attendance_correction_requests;
create policy attendance_correction_requests_select_own_or_reviewer
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
        'SYSTEM_ADMIN',
        'DEPARTMENT_MANAGER',
        'EXECUTIVE',
        'AUDITOR'
      )
  )
);

drop policy if exists attendance_correction_requests_insert_own on public.attendance_correction_requests;
create policy attendance_correction_requests_insert_own
on public.attendance_correction_requests
for insert
to authenticated
with check (employee_id = public.current_employee_id());

drop policy if exists attendance_correction_requests_update_reviewer on public.attendance_correction_requests;
create policy attendance_correction_requests_update_reviewer
on public.attendance_correction_requests
for update
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
        'SYSTEM_ADMIN',
        'DEPARTMENT_MANAGER',
        'EXECUTIVE',
        'AUDITOR'
      )
  )
)
with check (
  employee_id = public.current_employee_id()
  or exists (
    select 1
    from public.employees me
    where me.id = public.current_employee_id()
      and coalesce(me.role::text, '') in (
        'HR_STAFF',
        'HR_ADMIN',
        'HR_MANAGER',
        'SYSTEM_ADMIN',
        'DEPARTMENT_MANAGER',
        'EXECUTIVE',
        'AUDITOR'
      )
  )
);

drop policy if exists attendance_correction_requests_delete_own_or_reviewer on public.attendance_correction_requests;
create policy attendance_correction_requests_delete_own_or_reviewer
on public.attendance_correction_requests
for delete
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
        'SYSTEM_ADMIN',
        'DEPARTMENT_MANAGER',
        'EXECUTIVE',
        'AUDITOR'
      )
  )
);

commit;
