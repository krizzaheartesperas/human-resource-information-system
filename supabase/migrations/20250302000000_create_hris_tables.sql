-- Workzen HRIS – Supabase tables
-- Run this in Supabase Dashboard → SQL Editor, or via: supabase db push
-- Revise later if any process or schema needs to change.

-- Enable UUID generation (usually already on in Supabase)
create extension if not exists "uuid-ossp";

-- =============================================================================
-- 1. departments
-- =============================================================================
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  parent_id uuid references public.departments(id) on delete set null,
  manager_id uuid, -- FK added after employees exists
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.departments is 'Company departments / org units';

-- =============================================================================
-- 2. employees
-- =============================================================================
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_number text not null unique,
  first_name text not null,
  last_name text not null,
  email text not null,
  department_id uuid not null references public.departments(id) on delete restrict,
  job_title text not null,
  manager_id uuid references public.employees(id) on delete set null,
  employment_status text not null check (employment_status in ('ACTIVE', 'ONBOARDING', 'OFFBOARDED')),
  start_date date not null,
  role text not null check (role in ('HR_ADMIN', 'HR_STAFF', 'MANAGER', 'EMPLOYEE')),
  employment_type text check (employment_type in ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'PROBATION')),
  birthday date,
  current_address text,
  personal_phone text,
  profile_photo text,
  auth_user_id uuid, -- link to auth.users(id) when using Supabase Auth
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_employees_department_id on public.employees(department_id);
create index if not exists idx_employees_manager_id on public.employees(manager_id);
create index if not exists idx_employees_auth_user_id on public.employees(auth_user_id);
create index if not exists idx_employees_employment_status on public.employees(employment_status);

comment on table public.employees is 'Employee master data';

-- FK: departments.manager_id -> employees
alter table public.departments drop constraint if exists fk_departments_manager;
alter table public.departments
  add constraint fk_departments_manager
  foreign key (manager_id) references public.employees(id) on delete set null;

-- =============================================================================
-- 3. job_history
-- =============================================================================
create table if not exists public.job_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  job_title text not null,
  department_id uuid not null references public.departments(id) on delete restrict,
  department_name text not null,
  manager_id uuid references public.employees(id) on delete set null,
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now()
);

create index if not exists idx_job_history_employee_id on public.job_history(employee_id);

comment on table public.job_history is 'Historical job/position changes per employee';

-- =============================================================================
-- 4. leave_requests
-- =============================================================================
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  type text not null check (type in ('SICK_LEAVE', 'ANNUAL_LEAVE', 'WORK_FROM_HOME', 'MATERNITY', 'OTHER')),
  start_date date not null,
  end_date date not null,
  reason text not null default '',
  status text not null check (status in ('CREATED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'APPLIED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  approved_by uuid references public.employees(id) on delete set null,
  approved_at timestamptz
);

create index if not exists idx_leave_requests_employee_id on public.leave_requests(employee_id);
create index if not exists idx_leave_requests_status on public.leave_requests(status);
create index if not exists idx_leave_requests_dates on public.leave_requests(start_date, end_date);

comment on table public.leave_requests is 'Leave / time-off requests';

-- =============================================================================
-- 5. leave_balances
-- =============================================================================
create table if not exists public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  type text not null check (type in ('SICK_LEAVE', 'ANNUAL_LEAVE', 'WORK_FROM_HOME', 'MATERNITY', 'OTHER')),
  year int not null,
  total_days int not null default 0,
  used_days int not null default 0,
  pending_days int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id, type, year)
);

create index if not exists idx_leave_balances_employee_id on public.leave_balances(employee_id);

comment on table public.leave_balances is 'Leave balance per employee per type per year; balance_days = total_days - used_days - pending_days';

-- =============================================================================
-- 6. workflow_requests
-- =============================================================================
create table if not exists public.workflow_requests (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('PROMOTION', 'TRANSFER', 'MANAGER_CHANGE', 'DEPARTMENT_CHANGE', 'SALARY_CHANGE')),
  title text not null,
  created_by uuid not null references public.employees(id) on delete cascade,
  status text not null check (status in ('CREATED', 'PENDING', 'APPROVED', 'REJECTED', 'APPLIED', 'CLOSED')),
  created_at timestamptz not null default now(),
  entity_id uuid,
  entity_type text
);

create index if not exists idx_workflow_requests_created_by on public.workflow_requests(created_by);
create index if not exists idx_workflow_requests_status on public.workflow_requests(status);

comment on table public.workflow_requests is 'HR workflow requests (promotion, transfer, etc.)';

-- =============================================================================
-- 7. attendance
-- =============================================================================
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  date date not null,
  clock_in timestamptz,
  clock_out timestamptz,
  late_minutes int not null default 0,
  undertime_minutes int not null default 0,
  overtime_minutes int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id, date)
);

create index if not exists idx_attendance_employee_id on public.attendance(employee_id);
create index if not exists idx_attendance_date on public.attendance(date);

comment on table public.attendance is 'Daily attendance (clock in/out) per employee';

-- =============================================================================
-- 8. audit_logs
-- =============================================================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  timestamp timestamptz not null default now(),
  actor_id text not null,
  actor_name text not null,
  actor_role text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  summary text not null,
  before jsonb,
  after jsonb,
  reason text,
  source text default 'WEB_APP',
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_timestamp on public.audit_logs(timestamp desc);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_actor_id on public.audit_logs(actor_id);

comment on table public.audit_logs is 'Audit trail for HR actions';

-- =============================================================================
-- Optional: updated_at trigger helper (reuse for any table with updated_at)
-- =============================================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Attach to tables that have updated_at
drop trigger if exists set_updated_at on public.departments;
create trigger set_updated_at before update on public.departments
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.employees;
create trigger set_updated_at before update on public.employees
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.leave_balances;
create trigger set_updated_at before update on public.leave_balances
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.attendance;
create trigger set_updated_at before update on public.attendance
  for each row execute function public.set_updated_at();
