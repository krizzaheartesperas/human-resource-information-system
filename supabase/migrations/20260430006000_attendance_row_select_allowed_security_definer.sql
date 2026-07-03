begin;

-- Team Time reads attendance for peers via a policy subquery that joins public.employees.
-- employees RLS only allows "same department by role" indirectly (e.g. departments.manager_id),
-- so the join often cannot "see" teammate rows and the manager branch never becomes true.
-- SECURITY DEFINER evaluates department match without employees RLS blocking the inner scan
-- (same idea as current_user_has_company_leave_access in 20260408200000).

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
        and coalesce(mgr.role::text, '') in ('DEPARTMENT_MANAGER', 'MANAGER')
        and req.department_id is not distinct from mgr.department_id
    ) then true
    else false
  end;
$$;

revoke all on function public.attendance_row_select_allowed(uuid) from public;
grant execute on function public.attendance_row_select_allowed(uuid) to authenticated;

drop policy if exists attendance_select_visible on public.attendance;

create policy attendance_select_visible
on public.attendance
for select
to authenticated
using (public.attendance_row_select_allowed(attendance.employee_id));

commit;
