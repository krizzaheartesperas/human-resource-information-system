-- Align salary change detail table to salary-specific columns.
-- If a deployment only has role_change_request, repurpose it.
do $$
begin
  if to_regclass('public.salary_change_requests') is null
     and to_regclass('public.role_change_request') is not null then
    alter table public.role_change_request rename to salary_change_requests;
  end if;
end $$;

create table if not exists public.salary_change_requests (
  id uuid not null default gen_random_uuid(),
  request_id uuid not null,
  current_salary numeric(12,2) null,
  percentage_increase text null,
  reason text null,
  budget_justification text null,
  constraint salary_change_requests_pkey primary key (id),
  constraint salary_change_requests_request_id_key unique (request_id),
  constraint salary_change_requests_request_id_fkey foreign key (request_id)
    references public.workflow_requests(id) on delete cascade
);

alter table public.salary_change_requests
  add column if not exists current_salary numeric(12,2) null,
  add column if not exists percentage_increase text null,
  add column if not exists reason text null,
  add column if not exists budget_justification text null;

-- Backfill percentage/budget from previous free-text reason when possible.
update public.salary_change_requests
set
  percentage_increase = coalesce(
    percentage_increase,
    nullif(regexp_replace(coalesce(reason, ''), '.*Percentage increase:\s*([0-9]+%?).*', '\1', 'i'), '')
  ),
  budget_justification = coalesce(
    budget_justification,
    nullif(regexp_replace(coalesce(reason, ''), '.*Budget justification:\s*(.*)$', '\1', 'i'), '')
  );

-- Remove obsolete role-change columns if they exist.
alter table public.salary_change_requests
  drop column if exists current_department,
  drop column if exists current_position,
  drop column if exists new_position,
  drop column if exists effective_date,
  drop column if exists proposed_salary;
