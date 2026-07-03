begin;

-- Ensure matrix helper exists for attendance issue routing.
create or replace function public.can_approve_attendance_issue(p_requester_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_requester_no text;
  v_actor_no text;
begin
  select coalesce(nullif(trim(employee_number), ''), nullif(trim(employee_code), ''))
    into v_requester_no
  from public.employees
  where id = p_requester_id;

  select coalesce(nullif(trim(employee_number), ''), nullif(trim(employee_code), ''))
    into v_actor_no
  from public.employees
  where id = public.current_employee_id();

  if v_requester_no is null or v_actor_no is null then
    return false;
  end if;

  return case upper(v_requester_no)
    when 'EMP-0002' then upper(v_actor_no) in ('EMP-0005')
    when 'EMP-0003' then upper(v_actor_no) in ('EMP-0005')
    when 'EMP-0004' then upper(v_actor_no) in ('EMP-0005')
    when 'EMP-0005' then upper(v_actor_no) in ('EMP-0006')
    when 'EMP-0006' then upper(v_actor_no) in ('EMP-0004')
    when 'EMP-0007' then upper(v_actor_no) in ('EMP-0005')
    when 'EMP-0008' then upper(v_actor_no) in ('EMP-0004')
    when 'EMP-0009' then upper(v_actor_no) in ('EMP-0005')
    else false
  end;
end;
$$;

revoke all on function public.can_approve_attendance_issue(uuid) from public;
grant execute on function public.can_approve_attendance_issue(uuid) to authenticated;

drop policy if exists attendance_correction_requests_select_visible on public.attendance_correction_requests;
drop policy if exists attendance_correction_requests_update_hr_staff_only on public.attendance_correction_requests;
drop policy if exists attendance_correction_requests_update_matrix_approver on public.attendance_correction_requests;

-- SELECT:
-- - submitter sees own request
-- - assigned matrix approver sees rows assigned to them
-- - HR/Admin/Super/Audit/Executive can read as needed for review workflows
create policy attendance_correction_requests_select_visible
on public.attendance_correction_requests
for select
to authenticated
using (
  attendance_correction_requests.employee_id = public.current_employee_id()
  or public.can_approve_attendance_issue(attendance_correction_requests.employee_id)
  or exists (
    select 1
    from public.employees me
    where me.id = public.current_employee_id()
      and coalesce(me.role::text, '') in (
        'HR_STAFF',
        'HR_ADMIN',
        'HR_MANAGER',
        'SUPER_ADMIN',
        'SYSTEM_ADMIN',
        'AUDITOR',
        'EXECUTIVE'
      )
  )
);

-- UPDATE:
-- matrix approver can approve/reject non-self requests.
create policy attendance_correction_requests_update_matrix_approver
on public.attendance_correction_requests
for update
to authenticated
using (
  attendance_correction_requests.employee_id <> public.current_employee_id()
  and public.can_approve_attendance_issue(attendance_correction_requests.employee_id)
)
with check (
  attendance_correction_requests.employee_id <> public.current_employee_id()
  and public.can_approve_attendance_issue(attendance_correction_requests.employee_id)
);

commit;
