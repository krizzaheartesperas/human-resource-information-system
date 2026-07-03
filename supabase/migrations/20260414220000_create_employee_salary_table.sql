-- Salary source-of-truth per employee (supports history + current snapshot).
create table if not exists public.employee_salary (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  base_salary numeric(12,2) not null check (base_salary >= 0),
  currency text not null default 'PHP',
  pay_frequency text not null default 'MONTHLY' check (pay_frequency in ('WEEKLY','SEMI_MONTHLY','MONTHLY','ANNUAL')),
  effective_from date not null default current_date,
  effective_to date null,
  is_current boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_employee_salary_employee_id
  on public.employee_salary(employee_id);

create unique index if not exists uq_employee_salary_current_per_employee
  on public.employee_salary(employee_id)
  where is_current = true;

-- Keep updated_at fresh.
create or replace function public.set_employee_salary_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_employee_salary_updated_at on public.employee_salary;
create trigger trg_employee_salary_updated_at
before update on public.employee_salary
for each row
execute function public.set_employee_salary_updated_at();

alter table public.employee_salary enable row level security;

drop policy if exists employee_salary_select_policy on public.employee_salary;
create policy employee_salary_select_policy
on public.employee_salary
for select
using (
  employee_id = public.current_employee_id()
  or public.is_workflow_reviewer()
);

drop policy if exists employee_salary_insert_policy on public.employee_salary;
create policy employee_salary_insert_policy
on public.employee_salary
for insert
with check (
  employee_id = public.current_employee_id()
  or public.is_workflow_reviewer()
);

drop policy if exists employee_salary_update_policy on public.employee_salary;
create policy employee_salary_update_policy
on public.employee_salary
for update
using (
  employee_id = public.current_employee_id()
  or public.is_workflow_reviewer()
)
with check (
  employee_id = public.current_employee_id()
  or public.is_workflow_reviewer()
);

drop policy if exists employee_salary_delete_policy on public.employee_salary;
create policy employee_salary_delete_policy
on public.employee_salary
for delete
using (
  employee_id = public.current_employee_id()
  or public.is_workflow_reviewer()
);
