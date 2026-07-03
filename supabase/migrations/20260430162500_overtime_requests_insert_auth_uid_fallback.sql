begin;

-- Fix OT self-insert when one auth account maps to multiple employee rows
-- (e.g., System Admin workspace + Employee personal workspace).
drop policy if exists overtime_requests_insert_own on public.overtime_requests;

create policy overtime_requests_insert_own
on public.overtime_requests
for insert
to authenticated
with check (
  overtime_requests.employee_id = public.current_employee_id()
  or exists (
    select 1
    from public.employees me
    where me.id = overtime_requests.employee_id
      and (me.user_id = auth.uid() or me.auth_user_id = auth.uid())
  )
);

commit;
