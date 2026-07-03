-- Rebuild public.leave_balances from connected source tables.
--
-- Source tables used:
-- - public.leave_requests
-- - public.employees
-- - public.user_system_access
-- - public.systems
--
-- This script is destructive for public.leave_balances:
-- - Drops the table
-- - Recreates it
-- - Rebuilds rows for HRIS-connected active employees
-- - Recomputes used_days / pending_days from leave_requests

begin;

drop trigger if exists sync_leave_balance_from_leave_request_trigger on public.leave_requests;
drop function if exists public.adjust_leave_balance(uuid, text, integer, integer, integer, integer);
drop function if exists public.recalculate_leave_balance(uuid, text, integer);
drop function if exists public.sync_leave_balance_from_leave_request();

drop table if exists public.leave_balances;

create table public.leave_balances (
  id uuid not null default gen_random_uuid(),
  employee_id uuid not null,
  type text not null,
  year integer not null,
  total_days integer not null default 0,
  used_days integer not null default 0,
  pending_days integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint leave_balances_pkey primary key (id),
  constraint leave_balances_employee_id_type_year_key unique (employee_id, type, year),
  constraint leave_balances_employee_id_fkey
    foreign key (employee_id) references public.employees(id) on delete cascade
) tablespace pg_default;

create index if not exists idx_leave_balances_employee_id
  on public.leave_balances using btree (employee_id) tablespace pg_default;

drop trigger if exists set_updated_at on public.leave_balances;
create trigger set_updated_at
before update on public.leave_balances
for each row
execute function public.set_updated_at();

with leave_type_defaults(type, total_days) as (
  values
    ('VACATION_LEAVE'::text, 15),
    ('SICK_LEAVE'::text, 15),
    ('EMERGENCY_LEAVE'::text, 15),
    ('BEREAVEMENT_LEAVE'::text, 15),
    ('MATERNITY_LEAVE'::text, 15),
    ('PATERNITY_LEAVE'::text, 15),
    ('SOLO_PARENT_LEAVE'::text, 15),
    ('UNPAID_LEAVE'::text, 0)
),
hris_system as (
  select s.id
  from public.systems s
  where lower(coalesce(s.code, '')) = 'hris'
  limit 1
),
hris_connected_users as (
  select distinct usa.user_id
  from public.user_system_access usa
  join hris_system hs on hs.id = usa.system_id
  where lower(coalesce(usa.status, '')) = 'active'
),
active_employees as (
  select e.id
  from public.employees e
  where (
      coalesce(e.is_active, true) = true
      and lower(coalesce(e.employment_status, 'active')) not in ('inactive', 'terminated', 'resigned', 'separated')
    )
    and (
      exists (select 1 from hris_connected_users hcu where hcu.user_id = e.user_id)
      or exists (select 1 from hris_connected_users hcu where hcu.user_id = e.auth_user_id)
      or (e.user_id is null and e.auth_user_id is null)
    )
),
years_to_build as (
  select distinct extract(year from lr.start_date)::int as year
  from public.leave_requests lr
  union
  select extract(year from now())::int
),
request_totals as (
  select
    lr.employee_id,
    extract(year from lr.start_date)::int as year,
    case
      when upper(lr.type) = 'ANNUAL_LEAVE' then 'VACATION_LEAVE'
      when upper(lr.type) = 'WORK_FROM_HOME' then 'VACATION_LEAVE'
      when upper(lr.type) = 'MATERNITY' then 'MATERNITY_LEAVE'
      when upper(lr.type) = 'OTHER' then 'UNPAID_LEAVE'
      else upper(lr.type)
    end as type,
    coalesce(sum(
      case
        when upper(lr.status) in ('FINAL_APPROVED', 'APPLIED') then
          greatest(0, (lr.end_date::date - lr.start_date::date) + 1)
        else 0
      end
    ), 0)::int as used_days,
    coalesce(sum(
      case
        when upper(lr.status) in (
          'APPROVED',
          'PENDING_RECORDING',
          'PENDING_FINALIZATION',
          'PENDING_HR_ADMIN_PROCESSING',
          'PENDING_HR_ADMIN_PROCESSING_HR_MANAGER',
          'PENDING_HR_ADMIN_PROCESSING_EXECUTIVE',
          'PENDING_HR_MANAGER_PROCESSING_HR_ADMIN',
          'PENDING_HR_STAFF_PROCESSING',
          'PENDING_HR_STAFF_PROCESSING_AUDITOR',
          'PENDING_HR_MANAGER_APPROVAL',
          'PENDING_EXECUTIVE_APPROVAL',
          'PENDING_EXECUTIVE_BOARD_APPROVAL',
          'PENDING_APPROVAL'
        ) then greatest(0, (lr.end_date::date - lr.start_date::date) + 1)
        else 0
      end
    ), 0)::int as pending_days
  from public.leave_requests lr
  where upper(lr.status) not in ('REJECTED', 'CANCELLED', 'DRAFT')
  group by 1, 2, 3
),
desired_balances as (
  select
    e.id as employee_id,
    y.year,
    ltd.type,
    ltd.total_days,
    coalesce(rt.used_days, 0) as used_days,
    coalesce(rt.pending_days, 0) as pending_days
  from active_employees e
  cross join years_to_build y
  cross join leave_type_defaults ltd
  left join request_totals rt
    on rt.employee_id = e.id
   and rt.year = y.year
   and rt.type = ltd.type
)
insert into public.leave_balances (
  employee_id,
  type,
  year,
  total_days,
  used_days,
  pending_days
)
select
  employee_id,
  type,
  year,
  total_days,
  used_days,
  pending_days
from desired_balances
on conflict (employee_id, type, year)
do update set
  total_days = excluded.total_days,
  used_days = excluded.used_days,
  pending_days = excluded.pending_days;

create or replace function public.adjust_leave_balance(
  p_employee_id uuid,
  p_type text,
  p_year integer,
  p_total_days integer,
  p_pending_delta integer,
  p_used_delta integer
)
returns public.leave_balances
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_type text;
  target_year integer := coalesce(p_year, extract(year from now())::integer);
  target_total_days integer := coalesce(greatest(0, p_total_days), 0);
  next_row public.leave_balances;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if p_employee_id is null then
    raise exception 'employee_id is required'
      using errcode = '22023';
  end if;

  if p_employee_id <> public.current_employee_id()
     and not public.current_user_has_company_leave_access() then
    raise exception 'Not allowed to adjust this leave balance'
      using errcode = '42501';
  end if;

  normalized_type := upper(
    replace(
      regexp_replace(trim(coalesce(p_type, '')), '[^[:alnum:]]+', '_', 'g'),
      '__',
      '_'
    )
  );

  normalized_type := case normalized_type
    when 'ANNUAL_LEAVE' then 'VACATION_LEAVE'
    when 'WORK_FROM_HOME' then 'VACATION_LEAVE'
    when 'MATERNITY' then 'MATERNITY_LEAVE'
    when 'OTHER' then 'UNPAID_LEAVE'
    else normalized_type
  end;

  if normalized_type not in (
    'VACATION_LEAVE',
    'SICK_LEAVE',
    'EMERGENCY_LEAVE',
    'BEREAVEMENT_LEAVE',
    'MATERNITY_LEAVE',
    'PATERNITY_LEAVE',
    'SOLO_PARENT_LEAVE',
    'UNPAID_LEAVE'
  ) then
    raise exception 'Invalid leave type: %', coalesce(p_type, '<null>')
      using errcode = '22023';
  end if;

  if p_total_days is null then
    target_total_days := case normalized_type
      when 'UNPAID_LEAVE' then 0
      else 15
    end;
  end if;

  insert into public.leave_balances (
    employee_id,
    type,
    year,
    total_days,
    used_days,
    pending_days
  )
  values (
    p_employee_id,
    normalized_type,
    target_year,
    target_total_days,
    greatest(0, coalesce(p_used_delta, 0)),
    greatest(0, coalesce(p_pending_delta, 0))
  )
  on conflict (employee_id, type, year)
  do update set
    total_days = case
      when p_total_days is null then public.leave_balances.total_days
      else greatest(0, p_total_days)
    end,
    used_days = greatest(0, public.leave_balances.used_days + coalesce(p_used_delta, 0)),
    pending_days = greatest(0, public.leave_balances.pending_days + coalesce(p_pending_delta, 0))
  returning * into next_row;

  return next_row;
end;
$$;

revoke all on function public.adjust_leave_balance(uuid, text, integer, integer, integer, integer) from public;
grant execute on function public.adjust_leave_balance(uuid, text, integer, integer, integer, integer) to authenticated;

create or replace function public.normalized_leave_type(p_type text)
returns text
language sql
immutable
as $$
  select case upper(replace(regexp_replace(trim(coalesce(p_type, '')), '[^[:alnum:]]+', '_', 'g'), '__', '_'))
    when 'ANNUAL_LEAVE' then 'VACATION_LEAVE'
    when 'WORK_FROM_HOME' then 'VACATION_LEAVE'
    when 'MATERNITY' then 'MATERNITY_LEAVE'
    when 'OTHER' then 'UNPAID_LEAVE'
    else upper(replace(regexp_replace(trim(coalesce(p_type, '')), '[^[:alnum:]]+', '_', 'g'), '__', '_'))
  end
$$;

create or replace function public.default_leave_total_days(p_type text)
returns integer
language sql
immutable
as $$
  select case public.normalized_leave_type(p_type)
    when 'UNPAID_LEAVE' then 0
    else 15
  end
$$;

create or replace function public.recalculate_leave_balance(
  p_employee_id uuid,
  p_type text,
  p_year integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_type text := public.normalized_leave_type(p_type);
  next_used_days integer := 0;
  next_pending_days integer := 0;
begin
  if p_employee_id is null or normalized_type is null or p_year is null then
    return;
  end if;

  select
    coalesce(sum(
      case
        when upper(replace(regexp_replace(trim(coalesce(lr.status, '')), '[^[:alnum:]]+', '_', 'g'), '__', '_')) in ('FINAL_APPROVED', 'APPLIED') then
          greatest(0, (lr.end_date::date - lr.start_date::date) + 1)
        else 0
      end
    ), 0)::integer,
    coalesce(sum(
      case
        when upper(replace(regexp_replace(trim(coalesce(lr.status, '')), '[^[:alnum:]]+', '_', 'g'), '__', '_')) in (
          'APPROVED',
          'PENDING_RECORDING',
          'PENDING_FINALIZATION',
          'PENDING_HR_ADMIN_PROCESSING',
          'PENDING_HR_ADMIN_PROCESSING_HR_MANAGER',
          'PENDING_HR_ADMIN_PROCESSING_EXECUTIVE',
          'PENDING_HR_MANAGER_PROCESSING_HR_ADMIN',
          'PENDING_HR_STAFF_PROCESSING',
          'PENDING_HR_STAFF_PROCESSING_AUDITOR',
          'PENDING_HR_MANAGER_APPROVAL',
          'PENDING_EXECUTIVE_APPROVAL',
          'PENDING_EXECUTIVE_BOARD_APPROVAL',
          'PENDING_APPROVAL',
          'RETURNED_FOR_REVIEW'
        ) then greatest(0, (lr.end_date::date - lr.start_date::date) + 1)
        else 0
      end
    ), 0)::integer
  into next_used_days, next_pending_days
  from public.leave_requests lr
  where lr.employee_id = p_employee_id
    and public.normalized_leave_type(lr.type) = normalized_type
    and extract(year from lr.start_date::date)::integer = p_year
    and upper(replace(regexp_replace(trim(coalesce(lr.status, '')), '[^[:alnum:]]+', '_', 'g'), '__', '_')) not in ('REJECTED', 'CANCELLED', 'DRAFT');

  insert into public.leave_balances (
    employee_id,
    type,
    year,
    total_days,
    used_days,
    pending_days
  )
  values (
    p_employee_id,
    normalized_type,
    p_year,
    public.default_leave_total_days(normalized_type),
    next_used_days,
    next_pending_days
  )
  on conflict (employee_id, type, year)
  do update set
    used_days = excluded.used_days,
    pending_days = excluded.pending_days;
end;
$$;

create or replace function public.sync_leave_balance_from_leave_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if upper(trim(coalesce(old.status, ''))) is distinct from 'DRAFT' then
      perform public.recalculate_leave_balance(
        old.employee_id,
        old.type,
        extract(year from old.start_date::date)::integer
      );
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if upper(trim(coalesce(new.status, ''))) is distinct from 'DRAFT' then
      perform public.recalculate_leave_balance(
        new.employee_id,
        new.type,
        extract(year from new.start_date::date)::integer
      );
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_leave_balance_from_leave_request_trigger on public.leave_requests;
create trigger sync_leave_balance_from_leave_request_trigger
after insert or update or delete on public.leave_requests
for each row
execute function public.sync_leave_balance_from_leave_request();

commit;

-- Verification for EMP-0002 sample employee:
select
  employee_id,
  type,
  year,
  total_days,
  used_days,
  pending_days,
  total_days - used_days - pending_days as balance_days,
  updated_at
from public.leave_balances
where employee_id = 'f8180354-9667-439b-8104-0f999bedf4a7'::uuid
order by year desc, type;
