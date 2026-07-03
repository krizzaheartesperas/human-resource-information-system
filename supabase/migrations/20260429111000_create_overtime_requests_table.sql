begin;

create table if not exists public.overtime_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  attendance_id uuid null references public.attendance(id) on delete set null,
  date date not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  ot_type text not null check (ot_type in ('PRE_OT', 'POST_OT')),
  category text not null default 'Regular OT',
  reason text,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  remarks text,
  created_at timestamp without time zone not null default now(),
  updated_at timestamp without time zone not null default now()
);

create index if not exists idx_overtime_requests_employee_date
  on public.overtime_requests(employee_id, date desc);

create index if not exists idx_overtime_requests_status
  on public.overtime_requests(status);

drop trigger if exists set_updated_at on public.overtime_requests;
create trigger set_updated_at
before update on public.overtime_requests
for each row execute function public.set_updated_at();

alter table public.overtime_requests enable row level security;

drop policy if exists overtime_requests_select_own_or_hr on public.overtime_requests;
create policy overtime_requests_select_own_or_hr
on public.overtime_requests
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

drop policy if exists overtime_requests_insert_own on public.overtime_requests;
create policy overtime_requests_insert_own
on public.overtime_requests
for insert
to authenticated
with check (employee_id = public.current_employee_id());

drop policy if exists overtime_requests_update_own_or_hr on public.overtime_requests;
create policy overtime_requests_update_own_or_hr
on public.overtime_requests
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

drop policy if exists overtime_requests_delete_own_or_hr on public.overtime_requests;
create policy overtime_requests_delete_own_or_hr
on public.overtime_requests
for delete
to authenticated
using (
  employee_id = public.current_employee_id()
  or exists (
    select 1
    from public.employees me
    where me.id = public.current_employee_id()
      and coalesce(me.role::text, '') in ('HR_STAFF', 'HR_ADMIN', 'HR_MANAGER', 'SUPER_ADMIN')
  )
);

commit;
