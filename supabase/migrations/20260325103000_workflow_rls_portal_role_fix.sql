-- Fix workflow RLS reviewer detection when employees.role column is missing.
-- Your schema uses `portal_role` (as seen in Supabase UI) instead of `role`.

create or replace function public.current_employee_role()
returns text
language plpgsql
stable
as $$
declare
  v_role text := '';
  has_role_col boolean := false;
  has_portal_role_col boolean := false;
begin
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
      and column_name = 'portal_role'
  ) into has_portal_role_col;

  -- Prefer legacy `role` when present.
  if has_role_col then
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
    elsif exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'employees'
        and column_name = 'user_id'
    ) then
      execute 'select coalesce(role, '''') from public.employees where user_id::text = $1 limit 1'
        into v_role
        using auth.uid()::text;
    end if;

    if coalesce(v_role, '') <> '' then
      return v_role;
    end if;
  end if;

  -- Fallback to `portal_role` (current UI schema).
  if has_portal_role_col then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'employees'
        and column_name = 'auth_user_id'
    ) then
      execute 'select coalesce(portal_role, '''') from public.employees where auth_user_id::text = $1 limit 1'
        into v_role
        using auth.uid()::text;
    elsif exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'employees'
        and column_name = 'user_id'
    ) then
      execute 'select coalesce(portal_role, '''') from public.employees where user_id::text = $1 limit 1'
        into v_role
        using auth.uid()::text;
    end if;

    return coalesce(v_role, '');
  end if;

  return '';
end;
$$;

