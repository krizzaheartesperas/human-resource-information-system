-- Rename department_change_requests to role_change_request
-- and ensure transfer_requests has the expected scoped columns.

begin;

-- If older plural table exists from previous migration, normalize to singular name.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'role_change_requests'
  ) and not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'role_change_request'
  ) then
    alter table public.role_change_requests rename to role_change_request;
  end if;
end
$$;

-- Repurpose/rename existing department_change_requests table if present.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'department_change_requests'
  ) and not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'role_change_request'
  ) then
    alter table public.department_change_requests rename to role_change_request;
  end if;
end
$$;

-- Ensure role_change_request table exists with expected columns.
create table if not exists public.role_change_request (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.workflow_requests(id) on delete cascade,
  current_department text null,
  current_position text null,
  new_position text not null,
  effective_date date null,
  reason text null
);

-- Column alignment for role_change_request (safe on upgraded schemas).
alter table public.role_change_request
  add column if not exists current_department text null,
  add column if not exists current_position text null,
  add column if not exists new_position text null,
  add column if not exists effective_date date null,
  add column if not exists reason text null;

-- If table came from department_change_requests, map legacy new_department -> new_position.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'role_change_request' and column_name = 'new_department'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'role_change_request' and column_name = 'new_position'
  ) then
    alter table public.role_change_request rename column new_department to new_position;
  end if;
end
$$;

-- Keep new_position required for fresh inserts.
alter table public.role_change_request
  alter column new_position set not null;

-- transfer_requests expected columns for location/team/branch scope.
alter table public.transfer_requests
  add column if not exists current_location text null,
  add column if not exists new_location text null,
  add column if not exists target_team_branch text null,
  add column if not exists effective_date date null,
  add column if not exists impact_notes text null;

-- Keep backward-compatible department columns, but allow nullable for non-department transfer flow.
alter table public.transfer_requests
  alter column new_department drop not null;

commit;

