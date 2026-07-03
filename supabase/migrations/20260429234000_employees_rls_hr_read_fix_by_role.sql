begin;

-- Fix HR employee read visibility:
-- current_user_has_company_leave_access() previously relied on position/job_title,
-- which can be missing in some deployments, causing HR Staff to receive no rows.
-- We add a role-based shortcut while keeping the original position/job_title behavior.
create or replace function public.current_user_has_company_leave_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.employees e
      where e.id = public.current_employee_id()
        and coalesce(e.role::text, '') in (
          'HR_STAFF',
          'HR_ADMIN',
          'HR_MANAGER',
          'SUPER_ADMIN',
          'AUDITOR',
          'EXECUTIVE',
          'DEPARTMENT_MANAGER'
        )
    )
    or coalesce(
      (
        select public.employee_row_has_company_leave_access(e.position::text, e.job_title::text)
        from public.employees e
        where e.id = public.current_employee_id()
        limit 1
      ),
      false
    );
$$;

commit;

