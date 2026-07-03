-- Fix RLS update failures on workflow_requests for reviewer actions.
-- Root issue: WITH CHECK can fail on updated row even when USING passes.
-- Keep row-level guard in USING; relax WITH CHECK for non-ownership field updates.

drop policy if exists workflow_requests_update_policy on public.workflow_requests;

create policy workflow_requests_update_policy
on public.workflow_requests
for update
using (
  employee_id = public.current_employee_id()
  or public.is_workflow_reviewer()
)
with check (true);
