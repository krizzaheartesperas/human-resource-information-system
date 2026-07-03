begin;

-- Ensure approver matrix helper exists for OT routing.
create or replace function public.can_approve_overtime_request(p_requester_id uuid)
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
    when 'EMP-0002' then upper(v_actor_no) in ('EMP-0003')
    when 'EMP-0003' then upper(v_actor_no) in ('EMP-0006')
    when 'EMP-0004' then upper(v_actor_no) in ('EMP-0006')
    when 'EMP-0005' then upper(v_actor_no) in ('EMP-0006')
    when 'EMP-0006' then upper(v_actor_no) in ('EMP-0008')
    when 'EMP-0007' then upper(v_actor_no) in ('EMP-0006')
    when 'EMP-0008' then upper(v_actor_no) in ('EMP-0006', 'EMP-0004')
    when 'EMP-0009' then upper(v_actor_no) in ('EMP-0006')
    else false
  end;
end;
$$;

revoke all on function public.can_approve_overtime_request(uuid) from public;
grant execute on function public.can_approve_overtime_request(uuid) to authenticated;

drop policy if exists overtime_requests_select_visible on public.overtime_requests;
drop policy if exists overtime_requests_update_dept_manager_only on public.overtime_requests;
drop policy if exists overtime_requests_update_matrix_approver on public.overtime_requests;

-- SELECT:
-- - submitter can always view own rows
-- - matrix approver can view rows assigned to them
-- - dept/engineering managers can view same-department rows (title fallback included)
-- - HR/admin/audit/executive/system admins can view all rows
create policy overtime_requests_select_visible
on public.overtime_requests
for select
to authenticated
using (
  overtime_requests.employee_id = public.current_employee_id()
  or public.can_approve_overtime_request(overtime_requests.employee_id)
  or exists (
    select 1
    from public.employees mgr
    inner join public.employees req on req.id = overtime_requests.employee_id
    where mgr.id = public.current_employee_id()
      and (
        coalesce(mgr.role::text, '') in ('DEPARTMENT_MANAGER', 'MANAGER')
        or lower(coalesce(mgr.position, '')) like '%manager%'
        or lower(coalesce(mgr.job_title, '')) like '%manager%'
      )
      and req.department_id is not distinct from mgr.department_id
  )
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
-- approver can approve/reject only non-self requests, by matrix or team-manager scope.
create policy overtime_requests_update_manager_or_matrix
on public.overtime_requests
for update
to authenticated
using (
  overtime_requests.employee_id <> public.current_employee_id()
  and (
    public.can_approve_overtime_request(overtime_requests.employee_id)
    or exists (
      select 1
      from public.employees mgr
      inner join public.employees req on req.id = overtime_requests.employee_id
      where mgr.id = public.current_employee_id()
        and (
          coalesce(mgr.role::text, '') in ('DEPARTMENT_MANAGER', 'MANAGER')
          or lower(coalesce(mgr.position, '')) like '%manager%'
          or lower(coalesce(mgr.job_title, '')) like '%manager%'
        )
        and req.department_id is not distinct from mgr.department_id
    )
  )
)
with check (
  overtime_requests.employee_id <> public.current_employee_id()
  and (
    public.can_approve_overtime_request(overtime_requests.employee_id)
    or exists (
      select 1
      from public.employees mgr
      inner join public.employees req on req.id = overtime_requests.employee_id
      where mgr.id = public.current_employee_id()
        and (
          coalesce(mgr.role::text, '') in ('DEPARTMENT_MANAGER', 'MANAGER')
          or lower(coalesce(mgr.position, '')) like '%manager%'
          or lower(coalesce(mgr.job_title, '')) like '%manager%'
        )
        and req.department_id is not distinct from mgr.department_id
    )
  )
);

commit;
