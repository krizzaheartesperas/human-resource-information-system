-- Restore department change workflow detail table and request type.
-- Department Change is restricted in app layer to Department Manager role.

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
        'department_change'::text,
        'salary_change'::text,
        'manager_change'::text,
        'personal_info_change'::text
      ]
    )
  );

create table if not exists public.department_change_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.workflow_requests(id) on delete cascade,
  current_department text null,
  new_department text not null,
  reason text null
);

alter table public.department_change_requests enable row level security;

drop policy if exists department_change_requests_access_policy on public.department_change_requests;
create policy department_change_requests_access_policy
on public.department_change_requests
for all
to authenticated
using (
  exists (
    select 1
    from public.workflow_requests wr
    where wr.id = department_change_requests.request_id
      and (
        wr.employee_id = public.current_employee_id()
        or public.is_workflow_reviewer()
      )
  )
)
with check (
  exists (
    select 1
    from public.workflow_requests wr
    where wr.id = department_change_requests.request_id
      and (
        wr.employee_id = public.current_employee_id()
        or public.is_workflow_reviewer()
      )
  )
);

commit;

