-- HRIS Workflow Request Module
-- Scalable normalized schema with workflow logs + attachments.

create extension if not exists pgcrypto;

create table if not exists public.workflow_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  type text not null check (type in ('promotion', 'transfer', 'salary_change', 'department_change', 'personal_info_change')),
  title text not null,
  status text not null default 'created' check (status in ('created', 'pending', 'approved', 'rejected', 'applied', 'closed')),
  current_step text not null default 'hr_staff' check (current_step in ('hr_staff', 'department_manager', 'hr_manager', 'hr_admin', 'executive')),
  remarks text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_info_changes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.workflow_requests(id) on delete cascade,
  field_name text not null check (field_name in ('email', 'birthdate', 'fullname')),
  old_value text null,
  new_value text not null,
  reason text null
);

create table if not exists public.promotion_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.workflow_requests(id) on delete cascade,
  current_position text null,
  proposed_position text not null,
  proposed_department text null,
  effective_date date null,
  justification text null,
  achievements text null
);

create table if not exists public.salary_change_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.workflow_requests(id) on delete cascade,
  current_salary numeric(14,2) null,
  proposed_salary numeric(14,2) not null,
  reason text null
);

create table if not exists public.transfer_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.workflow_requests(id) on delete cascade,
  current_department text null,
  new_department text not null,
  reason text null
);

create table if not exists public.department_change_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.workflow_requests(id) on delete cascade,
  current_department text null,
  new_department text not null,
  reason text null
);

create table if not exists public.workflow_logs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.workflow_requests(id) on delete cascade,
  action_by uuid not null references public.employees(id) on delete cascade,
  role text not null,
  action text not null check (action in ('submitted', 'forwarded', 'approved', 'rejected', 'applied')),
  remarks text null,
  created_at timestamptz not null default now()
);

create table if not exists public.request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.workflow_requests(id) on delete cascade,
  file_url text not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_workflow_requests_employee_id on public.workflow_requests(employee_id);
create index if not exists idx_workflow_requests_type on public.workflow_requests(type);
create index if not exists idx_workflow_requests_status on public.workflow_requests(status);
create index if not exists idx_workflow_logs_request_id on public.workflow_logs(request_id);
create index if not exists idx_request_attachments_request_id on public.request_attachments(request_id);

create or replace function public.set_workflow_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_workflow_requests_updated_at on public.workflow_requests;
create trigger trg_workflow_requests_updated_at
before update on public.workflow_requests
for each row
execute function public.set_workflow_requests_updated_at();
