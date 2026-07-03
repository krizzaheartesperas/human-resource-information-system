-- Employee Records / Account upgrade
-- Adds missing columns, backfills existing data, and creates history/event tables.
-- Safe to run on partially-migrated environments (uses IF NOT EXISTS + guarded updates).

begin;

-- ---------------------------------------------------------------------------
-- 1) EMPLOYEES TABLE: add columns needed by Employee Records / Account
-- ---------------------------------------------------------------------------
alter table if exists public.employees
  add column if not exists employee_number text,
  add column if not exists role text,
  add column if not exists start_date date,
  add column if not exists separation_date date,
  add column if not exists regularization_date date,
  add column if not exists job_level text,
  add column if not exists employment_type text,
  add column if not exists is_active boolean default true,
  add column if not exists current_address text,
  add column if not exists personal_phone text,
  add column if not exists birthday date,
  add column if not exists profile_photo text,
  add column if not exists immutable_employee_number boolean default true;

-- Use employee_code as source when employee_number is missing.
do $$
begin
  -- Ensure role exists before portal_role -> role normalization.
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'role'
  ) then
    execute 'alter table public.employees add column role text';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'employee_code'
  ) then
    execute $q$
      update public.employees
      set employee_number = employee_code
      where (employee_number is null or employee_number = '')
        and employee_code is not null
        and employee_code <> ''
    $q$;
  end if;
end $$;

-- Normalize role values from portal_role text to canonical enum-like text values.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='employees' and column_name='portal_role'
  ) then
    execute $q$
      update public.employees
      set role = case lower(trim(portal_role))
        when 'hr admin' then 'HR_ADMIN'
        when 'hr_staff' then 'HR_STAFF'
        when 'hr' then 'HR_STAFF'
        when 'manager' then 'MANAGER'
        when 'employee' then 'EMPLOYEE'
        when 'auditor' then 'AUDITOR'
        when 'management' then 'EXECUTIVE'
        when 'executive' then 'EXECUTIVE'
        when 'system_admin' then 'SUPER_ADMIN'
        when 'interviewer' then 'EMPLOYEE'
        when 'recruiter' then 'EMPLOYEE'
        else role
      end
      where portal_role is not null
    $q$;
  end if;
end $$;

-- Optional role backfill from user_system_access/system_roles/systems (prefer HRIS system roles).
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='user_system_access'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='systems'
  ) then
    execute $q$
      with hris_access as (
        select
          usa.user_id,
          lower(coalesce(sr.code, usa.role, '')) as role_code,
          row_number() over (
            partition by usa.user_id
            order by
              case when lower(coalesce(s.code, '')) = 'hris' then 0 else 1 end,
              usa.created_at desc nulls last
          ) as rn
        from public.user_system_access usa
        left join public.systems s on s.id = usa.system_id
        left join public.system_roles sr on sr.id = usa.system_role_id
        where lower(coalesce(usa.status, 'active')) = 'active'
      )
      update public.employees e
      set role = case
          when h.role_code in ('hr_admin','hr_administrator') then 'HR_ADMIN'
          when h.role_code in ('hr_staff','hr_specialist') then 'HR_STAFF'
          when h.role_code in ('hr_manager') then 'HR_MANAGER'
          when h.role_code in ('department_manager','engineering_manager','it_manager','manager') then 'DEPARTMENT_MANAGER'
          when h.role_code in ('auditor_compliance','audit_officer','auditor') then 'AUDITOR'
          when h.role_code in ('executive') then 'EXECUTIVE'
          when h.role_code in ('system_admin','super_admin') then 'SUPER_ADMIN'
          else coalesce(e.role, 'EMPLOYEE')
        end
      from hris_access h
      where h.rn = 1
        and e.user_id = h.user_id
    $q$;
  end if;
end $$;

-- Final role fallback.
update public.employees
set role = coalesce(nullif(role, ''), 'EMPLOYEE')
where role is null or role = '';

-- Normalize employment status and derive is_active.
update public.employees
set employment_status = case
    when lower(coalesce(employment_status, '')) in ('active', 'full_time', 'part_time', 'contract', 'probation', 'internship') then 'ACTIVE'
    when lower(coalesce(employment_status, '')) in ('onboarding', 'pre_hire', 'pre-hire') then 'ONBOARDING'
    when lower(coalesce(employment_status, '')) in ('offboarded', 'terminated', 'suspended') then 'OFFBOARDED'
    else coalesce(employment_status, 'ACTIVE')
  end;

update public.employees
set is_active = (employment_status not in ('OFFBOARDED'));

-- Derive employment_type from existing values when possible.
update public.employees
set employment_type = case
    when upper(coalesce(employment_type, '')) in ('FULL_TIME','PART_TIME','CONTRACT','INTERNSHIP','PROBATION') then upper(employment_type)
    when lower(coalesce(employment_status, '')) = 'active' then 'FULL_TIME'
    else coalesce(employment_type, 'FULL_TIME')
  end
where employment_type is null
   or employment_type = ''
   or upper(employment_type) not in ('FULL_TIME','PART_TIME','CONTRACT','INTERNSHIP','PROBATION');

-- Default start_date for old rows that do not have it.
update public.employees
set start_date = coalesce(date(created_at), current_date)
where start_date is null;

-- Ensure uniqueness on employee_number once populated.
create unique index if not exists uq_employees_employee_number_nonnull
  on public.employees(employee_number)
  where employee_number is not null and employee_number <> '';

-- ---------------------------------------------------------------------------
-- 2) PROFILES TABLE: add Account fields including Government IDs
-- ---------------------------------------------------------------------------
alter table if exists public.profiles
  add column if not exists middle_name text,
  add column if not exists personal_email text,
  add column if not exists permanent_address text,
  add column if not exists gender text,
  add column if not exists civil_status text,
  add column if not exists nationality text,
  add column if not exists sss text,
  add column if not exists philhealth text,
  add column if not exists pagibig text,
  add column if not exists tin text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_relationship text,
  add column if not exists emergency_contact_phone text,
  add column if not exists last_login_at timestamptz;

-- Baseline defaults for existing rows (non-destructive).
update public.profiles
set
  nationality = coalesce(nullif(nationality, ''), 'Filipino'),
  civil_status = coalesce(nullif(civil_status, ''), 'Not specified'),
  gender = coalesce(nullif(gender, ''), 'Not specified')
where true;

-- ---------------------------------------------------------------------------
-- 3) BACKFILL EMPLOYEE <-> PROFILE shared fields (if linked by user/auth IDs)
-- ---------------------------------------------------------------------------
do $$
begin
  -- Backfill employees personal/contact fields from profiles by user_id.
  if exists (
    select 1
    from information_schema.columns
    where table_schema='public' and table_name='employees' and column_name='user_id'
  ) then
    execute $q$
      update public.employees e
      set
        personal_phone = coalesce(nullif(e.personal_phone, ''), p.phone),
        current_address = coalesce(nullif(e.current_address, ''), p.current_address),
        birthday = coalesce(e.birthday, p.birthday)
      from public.profiles p
      where p.user_id is not null
        and e.user_id = p.user_id
    $q$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4) EVENT-DRIVEN HR TABLES (effective-dated history + event audit)
-- ---------------------------------------------------------------------------
create table if not exists public.employee_employment_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  title text not null,
  department_id uuid references public.departments(id) on delete set null,
  manager_id uuid references public.employees(id) on delete set null,
  employment_status text not null,
  employment_type text,
  salary_snapshot numeric(12,2),
  effective_date date not null,
  end_date date,
  change_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_employee_employment_history_employee_id
  on public.employee_employment_history(employee_id, effective_date desc);

create table if not exists public.employee_compensation_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'PHP',
  pay_grade text,
  effective_date date not null,
  end_date date,
  change_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_employee_comp_history_employee_id
  on public.employee_compensation_history(employee_id, effective_date desc);

create table if not exists public.employee_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  event_type text not null check (
    event_type in (
      'EDIT_PROFILE',
      'PROMOTION',
      'TRANSFER',
      'SALARY_CHANGE',
      'TERMINATION',
      'REHIRE',
      'SUSPENSION'
    )
  ),
  field_changed text,
  old_value text,
  new_value text,
  effective_date date not null,
  changed_by uuid references public.employees(id) on delete set null,
  changed_by_role text,
  metadata jsonb,
  status text not null default 'APPLIED' check (status in ('PENDING', 'APPLIED', 'REJECTED')),
  created_at timestamptz not null default now()
);

create index if not exists idx_employee_events_employee_id
  on public.employee_events(employee_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5) Seed baseline employment history from current employee row (idempotent)
-- ---------------------------------------------------------------------------
insert into public.employee_employment_history (
  employee_id,
  title,
  department_id,
  manager_id,
  employment_status,
  employment_type,
  salary_snapshot,
  effective_date,
  end_date,
  change_reason
)
select
  e.id,
  coalesce(nullif(e.job_title, ''), nullif(e.position, ''), 'Employee') as title,
  e.department_id,
  e.manager_id,
  coalesce(nullif(e.employment_status, ''), 'ACTIVE') as employment_status,
  e.employment_type,
  null,
  coalesce(e.start_date, date(e.created_at), current_date) as effective_date,
  e.separation_date,
  'Initial snapshot from employees table'
from public.employees e
where not exists (
  select 1
  from public.employee_employment_history h
  where h.employee_id = e.id
);

commit;

