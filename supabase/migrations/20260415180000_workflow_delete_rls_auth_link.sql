-- Replace workflow delete RLS to match auth.uid() on employees (user_id / auth_user_id).
-- Some databases still resolve employees only via auth_user_id while older policies used
-- public.current_employee_id() alone; mismatches produced "delete 0 rows" with no error.
-- Also support legacy workflow_requests.created_by when present.

drop policy if exists workflow_requests_delete_policy on public.workflow_requests;
drop policy if exists workflow_logs_delete_policy on public.workflow_logs;
drop policy if exists request_attachments_delete_policy on public.request_attachments;
drop policy if exists personal_info_changes_delete_policy on public.personal_info_changes;

do $do$
declare
  has_created_by boolean;
  pol text;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workflow_requests'
      and column_name = 'created_by'
  )
  into has_created_by;

  if has_created_by then
    pol :=
      $p$
      create policy workflow_requests_delete_policy on public.workflow_requests
      for delete
      to authenticated
      using (
        (
          exists (
            select 1
            from public.employees e
            where e.id = coalesce(employee_id, created_by)
              and (e.user_id = auth.uid() or e.auth_user_id = auth.uid())
          )
          and lower(trim(coalesce(status::text, ''))) in ('created', 'closed', 'rejected')
        )
        or public.is_workflow_reviewer()
      )
      $p$;
  else
    pol :=
      $p$
      create policy workflow_requests_delete_policy on public.workflow_requests
      for delete
      to authenticated
      using (
        (
          exists (
            select 1
            from public.employees e
            where e.id = employee_id
              and (e.user_id = auth.uid() or e.auth_user_id = auth.uid())
          )
          and lower(trim(coalesce(status::text, ''))) in ('created', 'closed', 'rejected')
        )
        or public.is_workflow_reviewer()
      )
      $p$;
  end if;

  execute pol;
end
$do$;

create policy workflow_logs_delete_policy
on public.workflow_logs
for delete
to authenticated
using (
  exists (
    select 1
    from public.workflow_requests wr
    inner join public.employees e on e.id = wr.employee_id
    where wr.id = workflow_logs.request_id
      and (e.user_id = auth.uid() or e.auth_user_id = auth.uid())
  )
  or public.is_workflow_reviewer()
);

create policy request_attachments_delete_policy
on public.request_attachments
for delete
to authenticated
using (
  exists (
    select 1
    from public.workflow_requests wr
    inner join public.employees e on e.id = wr.employee_id
    where wr.id = request_attachments.request_id
      and (e.user_id = auth.uid() or e.auth_user_id = auth.uid())
  )
  or public.is_workflow_reviewer()
);

create policy personal_info_changes_delete_policy
on public.personal_info_changes
for delete
to authenticated
using (
  exists (
    select 1
    from public.workflow_requests wr
    inner join public.employees e on e.id = wr.employee_id
    where wr.id = personal_info_changes.request_id
      and (e.user_id = auth.uid() or e.auth_user_id = auth.uid())
  )
  or public.is_workflow_reviewer()
);
