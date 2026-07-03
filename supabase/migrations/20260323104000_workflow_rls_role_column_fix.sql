-- Fix RLS helper when public.employees.role column is missing.
-- Prevents errors like: column "role" does not exist

create or replace function public.current_employee_role()
returns text
language plpgsql
stable
as $$
declare
  v_role text := '';
  has_role_col boolean := false;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'role'
  ) into has_role_col;

  -- If schema has no role column, return empty role safely.
  if not has_role_col then
    return '';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'auth_user_id'
  ) then
    execute 'select coalesce(role, '''') from public.employees where auth_user_id::text = $1 limit 1'
      into v_role
      using auth.uid()::text;
    if coalesce(v_role, '') <> '' then
      return coalesce(v_role, '');
    end if;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'user_id'
  ) then
    execute 'select coalesce(role, '''') from public.employees where user_id::text = $1 limit 1'
      into v_role
      using auth.uid()::text;
    return coalesce(v_role, '');
  end if;

  return '';
end;
$$;
