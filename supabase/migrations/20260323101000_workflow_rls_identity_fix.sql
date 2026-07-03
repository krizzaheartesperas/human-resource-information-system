-- Fix workflow RLS identity resolution across differing employees schemas.
-- Supports auth_user_id or user_id columns even when not uuid by comparing as text.

create or replace function public.current_employee_id()
returns uuid
language plpgsql
stable
as $$
declare
  v_employee_id uuid;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'auth_user_id'
  ) then
    execute 'select id from public.employees where auth_user_id::text = $1 limit 1'
      into v_employee_id
      using auth.uid()::text;
    if v_employee_id is not null then
      return v_employee_id;
    end if;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'user_id'
  ) then
    execute 'select id from public.employees where user_id::text = $1 limit 1'
      into v_employee_id
      using auth.uid()::text;
    if v_employee_id is not null then
      return v_employee_id;
    end if;
  end if;

  return null;
end;
$$;

create or replace function public.current_employee_role()
returns text
language plpgsql
stable
as $$
declare
  v_role text := '';
begin
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
