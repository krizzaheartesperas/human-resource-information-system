-- Fix reviewer detection for workflow RLS when employees.role is missing.
-- Uses role when present, otherwise falls back to position/job_title keywords.

create or replace function public.is_workflow_reviewer()
returns boolean
language plpgsql
stable
as $$
declare
  v_emp_id uuid;
  v_role text := '';
  v_position text := '';
  has_role_col boolean := false;
  has_position_col boolean := false;
  has_job_title_col boolean := false;
begin
  v_emp_id := public.current_employee_id();
  if v_emp_id is null then
    return false;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'role'
  ) into has_role_col;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'position'
  ) into has_position_col;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'job_title'
  ) into has_job_title_col;

  if has_role_col then
    execute 'select coalesce(role, '''') from public.employees where id = $1'
      into v_role
      using v_emp_id;

    if upper(v_role) in ('HR_STAFF', 'HR_ADMIN', 'HR_MANAGER', 'MANAGER', 'EXECUTIVE', 'SUPER_ADMIN') then
      return true;
    end if;
  end if;

  if has_position_col then
    execute 'select coalesce(position, '''') from public.employees where id = $1'
      into v_position
      using v_emp_id;
  elsif has_job_title_col then
    execute 'select coalesce(job_title, '''') from public.employees where id = $1'
      into v_position
      using v_emp_id;
  end if;

  return (
    v_position ilike '%hr staff%'
    or v_position ilike '%hr admin%'
    or v_position ilike '%hr manager%'
    or v_position ilike '%manager%'
    or v_position ilike '%executive%'
    or v_position ilike '%super admin%'
  );
end;
$$;
