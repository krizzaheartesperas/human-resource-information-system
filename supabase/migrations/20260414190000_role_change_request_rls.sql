-- Fix RLS for role_change_request detail table.
-- Allows employee owner or workflow reviewer to access request-linked rows.

begin;

alter table public.role_change_request enable row level security;

-- Cleanup possible legacy policy names after table rename/migration.
drop policy if exists role_change_request_access_policy on public.role_change_request;
drop policy if exists role_change_requests_access_policy on public.role_change_request;
drop policy if exists department_change_requests_access_policy on public.role_change_request;

create policy role_change_request_access_policy
on public.role_change_request
for all
to authenticated
using (
  exists (
    select 1
    from public.workflow_requests wr
    where wr.id = role_change_request.request_id
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
    where wr.id = role_change_request.request_id
      and (
        wr.employee_id = public.current_employee_id()
        or public.is_workflow_reviewer()
      )
  )
);

commit;

