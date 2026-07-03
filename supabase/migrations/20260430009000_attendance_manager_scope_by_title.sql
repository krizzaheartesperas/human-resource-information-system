begin;

-- Jon/Glean dataset uses role='EMPLOYEE' for Engineering Manager records.
-- Expand manager scope in attendance visibility to also recognize manager titles.
create or replace function public.attendance_row_select_allowed(p_attendance_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_attendance_employee_id is null then false
    when p_attendance_employee_id = public.current_employee_id() then true
    when exists (
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
    ) then true
    when exists (
      select 1
      from public.employees mgr
      inner join public.employees req on req.id = p_attendance_employee_id
      where mgr.id = public.current_employee_id()
        and (
          coalesce(mgr.role::text, '') in ('DEPARTMENT_MANAGER', 'MANAGER')
          or lower(coalesce(mgr.position, '')) like '%manager%'
          or lower(coalesce(mgr.job_title, '')) like '%manager%'
        )
        and req.department_id is not distinct from mgr.department_id
    ) then true
    else false
  end;
$$;

revoke all on function public.attendance_row_select_allowed(uuid) from public;
grant execute on function public.attendance_row_select_allowed(uuid) to authenticated;

commit;
