-- SSO multi-system authorization hardening
-- Adds constraints/indexes for user_system_access and backfills HRIS access from employees.

begin;

create index if not exists idx_user_system_access_user_id
  on public.user_system_access(user_id);

create index if not exists idx_user_system_access_system_id
  on public.user_system_access(system_id);

create index if not exists idx_user_system_access_system_role_id
  on public.user_system_access(system_role_id);

do $$
begin
  -- Shared-db safe: only create this unique index when existing data is already clean.
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'uq_user_system_access_active_role'
  ) then
    if not exists (
      select 1
      from public.user_system_access usa
      where usa.status = 'active'
        and usa.system_role_id is not null
      group by usa.user_id, usa.system_id, usa.system_role_id
      having count(*) > 1
    ) then
      create unique index uq_user_system_access_active_role
        on public.user_system_access(user_id, system_id, system_role_id)
        where status = 'active';
    else
      raise notice 'Skipping uq_user_system_access_active_role creation due to duplicate active rows.';
    end if;
  end if;
end $$;

do $$
begin
  begin
    alter table public.user_system_access
      add constraint fk_user_system_access_system_role
      foreign key (system_role_id)
      references public.system_roles(id)
      on update cascade
      on delete set null
      not valid;
  exception
    when duplicate_object then null;
  end;
end $$;

-- Backfill missing HRIS access rows from employees.* role-like columns.
-- Handles environments where `employees.role` may not exist yet.
do $$
declare
  has_role boolean;
  has_portal_role boolean;
  has_position boolean;
  role_expr text;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'employees' and column_name = 'role'
  ) into has_role;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'employees' and column_name = 'portal_role'
  ) into has_portal_role;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'employees' and column_name = 'position'
  ) into has_position;

  role_expr := 'coalesce(';
  if has_role then
    role_expr := role_expr || 'nullif(trim(e.role), ''''),';
  end if;
  if has_portal_role then
    role_expr := role_expr || 'nullif(trim(e.portal_role), ''''),';
  end if;
  if has_position then
    role_expr := role_expr || 'nullif(trim(e.position), ''''),';
  end if;
  role_expr := role_expr || '''employee'')';

  execute format($sql$
    with hris_system as (
      select id
      from public.systems
      where lower(code) = 'hris'
      limit 1
    ),
    employee_role_seed as (
      select
        e.user_id,
        hs.id as system_id,
        lower(replace(%1$s, ' ', '_')) as role_code
      from public.employees e
      cross join hris_system hs
      where e.user_id is not null
    ),
    mapped_roles as (
      select
        ers.user_id,
        ers.system_id,
        sr.id as system_role_id,
        sr.name as role_name
      from employee_role_seed ers
      join public.system_roles sr
        on sr.system_id = ers.system_id
       and lower(sr.code) = ers.role_code
    ),
    fallback_roles as (
      select
        ers.user_id,
        ers.system_id,
        sr.id as system_role_id,
        sr.name as role_name
      from employee_role_seed ers
      join public.system_roles sr
        on sr.system_id = ers.system_id
       and lower(sr.code) = 'employee'
      where not exists (
        select 1
        from mapped_roles mr
        where mr.user_id = ers.user_id and mr.system_id = ers.system_id
      )
    ),
    seed as (
      select * from mapped_roles
      union all
      select * from fallback_roles
    )
    -- Shared-db safe: insert only when no row exists for user+system.
    insert into public.user_system_access (
      id,
      user_id,
      system_id,
      role,
      status,
      created_at,
      updated_at,
      system_role_id
    )
    select
      gen_random_uuid(),
      s.user_id,
      s.system_id,
      s.role_name,
      'active',
      now(),
      now(),
      s.system_role_id
    from seed s
    where not exists (
      select 1
      from public.user_system_access usa
      where usa.user_id = s.user_id
        and usa.system_id = s.system_id
    );
  $sql$, role_expr);
end $$;

commit;
