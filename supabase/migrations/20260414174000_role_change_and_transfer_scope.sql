-- Add ROLE_CHANGE workflow type, detail table, and transfer scoped fields.

begin;

alter table public.workflow_requests
  drop constraint if exists workflow_requests_type_check;

alter table public.workflow_requests
  add constraint workflow_requests_type_check
  check (
    type = any (
      array[
        'promotion'::text,
        'transfer'::text,
        'role_change'::text,
        'salary_change'::text,
        'department_change'::text,
        'manager_change'::text,
        'personal_info_change'::text
      ]
    )
  );

create table if not exists public.role_change_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.workflow_requests(id) on delete cascade,
  current_department text null,
  current_position text null,
  new_position text not null,
  effective_date date null,
  reason text null
);

alter table public.transfer_requests
  add column if not exists target_team_branch text null;

commit;

