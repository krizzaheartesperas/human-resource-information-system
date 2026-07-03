-- HRIS – minimal schema for Leave module only (creates departments + employees + leave tables).
-- Use this on a fresh project if you do not want job_history, workflow_requests, attendance, audit_logs yet.
-- If you already ran 20250302000000_create_hris_tables.sql, skip this file.
--
-- If public.departments ALREADY EXISTS (e.g. teammate-owned), do NOT run this file; use
-- 20250322200000_leave_module_existing_departments.sql instead (does not touch departments).

create extension if not exists "uuid-ossp";

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  parent_id uuid references public.departments(id) on delete set null,
  manager_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Older or hand-made `departments` rows may exist without these columns; CREATE TABLE IF NOT EXISTS would skip.
alter table public.departments add column if not exists parent_id uuid;
alter table public.departments add column if not exists manager_id uuid;
alter table public.departments add column if not exists created_at timestamptz not null default now();
alter table public.departments add column if not exists updated_at timestamptz not null default now();

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
  auth_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_employees_department_id on public.employees(department_id);
create index if not exists idx_employees_manager_id on public.employees(manager_id);
create index if not exists idx_employees_auth_user_id on public.employees(auth_user_id);

alter table public.departments drop constraint if exists fk_departments_manager;
alter table public.departments
  add constraint fk_departments_manager
  foreign key (manager_id) references public.employees(id) on delete set null;

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

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on public.departments;
create trigger set_updated_at before update on public.departments
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.employees;
create trigger set_updated_at before update on public.employees
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.leave_balances;
create trigger set_updated_at before update on public.leave_balances
  for each row execute function public.set_updated_at();
