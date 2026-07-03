-- Leave module: add leave_requests + leave_balances only.
--
-- Assumes public.departments and public.employees ALREADY EXIST (teammate-owned).
-- Does NOT create public.employees or public.departments — avoids clashing with schemas like:
--   employees: id, user_id, department_id, position, employment_status, created_at, updated_at, employee_code
--
-- Optional: adds manager_id on employees if missing (for org charts / future FKs). Safe: IF NOT EXISTS.

create extension if not exists "uuid-ossp";

alter table public.employees add column if not exists manager_id uuid;

create index if not exists idx_employees_department_id on public.employees(department_id);
create index if not exists idx_employees_manager_id on public.employees(manager_id);
create index if not exists idx_employees_user_id on public.employees(user_id);

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

drop trigger if exists set_updated_at on public.employees;
create trigger set_updated_at before update on public.employees
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.leave_balances;
create trigger set_updated_at before update on public.leave_balances
  for each row execute function public.set_updated_at();
