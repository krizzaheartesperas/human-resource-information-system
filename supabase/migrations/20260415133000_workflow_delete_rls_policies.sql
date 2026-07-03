-- workflow_requests had select/insert/update only; DELETE matched 0 rows under RLS with no error,
-- so the UI removed rows while promotion_requests etc. stayed. Allow safe self-service deletes.

drop policy if exists workflow_requests_delete_policy on public.workflow_requests;
create policy workflow_requests_delete_policy
on public.workflow_requests
for delete
using (
  (
    employee_id = public.current_employee_id()
    and lower(trim(coalesce(status::text, ''))) in ('created', 'closed')
  )
  or public.is_workflow_reviewer()
);

-- Cascaded deletes from workflow_requests still evaluate RLS on children.
drop policy if exists workflow_logs_delete_policy on public.workflow_logs;
create policy workflow_logs_delete_policy
on public.workflow_logs
for delete
using (
  exists (
    select 1
    from public.workflow_requests wr
    where wr.id = workflow_logs.request_id
      and (
        wr.employee_id = public.current_employee_id()
        or public.is_workflow_reviewer()
      )
  )
);

drop policy if exists request_attachments_delete_policy on public.request_attachments;
create policy request_attachments_delete_policy
on public.request_attachments
for delete
using (
  exists (
    select 1
    from public.workflow_requests wr
    where wr.id = request_attachments.request_id
      and (
        wr.employee_id = public.current_employee_id()
        or public.is_workflow_reviewer()
      )
  )
);

drop policy if exists personal_info_changes_delete_policy on public.personal_info_changes;
create policy personal_info_changes_delete_policy
on public.personal_info_changes
for delete
using (
  exists (
    select 1
    from public.workflow_requests wr
    where wr.id = personal_info_changes.request_id
      and (
        wr.employee_id = public.current_employee_id()
        or public.is_workflow_reviewer()
      )
  )
);
