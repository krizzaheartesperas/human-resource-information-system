-- Align workflow + audit DB policies with app behavior.
-- 1) Allow manager_change request type in workflow_requests.
-- 2) Align workflow_logs insert policy with auth.uid() actor id.
-- 3) Enable and define practical RLS policies for audit_logs.

begin;

-- 1) workflow_requests.type includes manager_change
alter table public.workflow_requests
  drop constraint if exists workflow_requests_type_check;

alter table public.workflow_requests
  add constraint workflow_requests_type_check
  check (
    type = any (
      array[
        'promotion'::text,
        'transfer'::text,
        'salary_change'::text,
        'department_change'::text,
        'manager_change'::text,
        'personal_info_change'::text
      ]
    )
  );

-- 2) workflow_logs insert uses auth user id as action_by
drop policy if exists workflow_logs_insert_policy on public.workflow_logs;
create policy workflow_logs_insert_policy
on public.workflow_logs
for insert
to authenticated
with check (
  (
    action_by = auth.uid()
    or public.is_workflow_reviewer()
  )
  and exists (
    select 1
    from public.workflow_requests wr
    where wr.id = workflow_logs.request_id
      and (
        wr.employee_id = public.current_employee_id()
        or public.is_workflow_reviewer()
      )
  )
);

-- 3) audit_logs RLS
alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select_policy on public.audit_logs;
create policy audit_logs_select_policy
on public.audit_logs
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_workflow_reviewer()
);

drop policy if exists audit_logs_insert_policy on public.audit_logs;
create policy audit_logs_insert_policy
on public.audit_logs
for insert
to authenticated
with check (
  user_id is null
  or user_id = auth.uid()
);

drop policy if exists audit_logs_update_policy on public.audit_logs;
create policy audit_logs_update_policy
on public.audit_logs
for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_workflow_reviewer()
)
with check (
  user_id = auth.uid()
  or public.is_workflow_reviewer()
);

drop policy if exists audit_logs_delete_policy on public.audit_logs;
create policy audit_logs_delete_policy
on public.audit_logs
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_workflow_reviewer()
);

commit;

