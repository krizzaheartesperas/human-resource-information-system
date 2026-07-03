begin;

-- Robust actor resolution for OT visibility/approval:
-- use current_employee_id() first, but also fallback to employees.user_id/auth_user_id = auth.uid().

drop policy if exists overtime_requests_select_visible on public.overtime_requests;
drop policy if exists overtime_requests_update_manager_or_matrix on public.overtime_requests;
drop policy if exists overtime_requests_update_matrix_approver on public.overtime_requests;
drop policy if exists overtime_requests_update_dept_manager_only on public.overtime_requests;

create policy overtime_requests_select_visible
on public.overtime_requests
for select
to authenticated
using (
  -- Requester always sees own rows.
  overtime_requests.employee_id = public.current_employee_id()

  -- Matrix approver sees assigned rows.
  or public.can_approve_overtime_request(overtime_requests.employee_id)

  -- Department/engineering manager sees same-department requesters (role or title).
  or exists (
    select 1
    from public.employees mgr
    inner join public.employees req on req.id = overtime_requests.employee_id
    where (mgr.id = public.current_employee_id() or mgr.user_id = auth.uid() or mgr.auth_user_id = auth.uid())
      and (
        coalesce(mgr.role::text, '') in ('DEPARTMENT_MANAGER', 'MANAGER')
        or lower(coalesce(mgr.position, '')) like '%manager%'
        or lower(coalesce(mgr.job_title, '')) like '%manager%'
      )
      and req.department_id is not distinct from mgr.department_id
  )

  -- HR/Admin/Audit/Executive/System-wide visibility (role or title fallback).
  or exists (
    select 1
    from public.employees me
    where (me.id = public.current_employee_id() or me.user_id = auth.uid() or me.auth_user_id = auth.uid())
      and (
        coalesce(me.role::text, '') in (
          'HR_STAFF',
          'HR_ADMIN',
          'HR_MANAGER',
          'SUPER_ADMIN',
          'SYSTEM_ADMIN',
          'AUDITOR',
          'EXECUTIVE'
        )
        or lower(coalesce(me.position, '')) like '%hr manager%'
        or lower(coalesce(me.job_title, '')) like '%hr manager%'
      )
  )
);

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
      where (mgr.id = public.current_employee_id() or mgr.user_id = auth.uid() or mgr.auth_user_id = auth.uid())
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
      where (mgr.id = public.current_employee_id() or mgr.user_id = auth.uid() or mgr.auth_user_id = auth.uid())
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
