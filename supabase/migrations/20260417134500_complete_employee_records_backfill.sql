-- Completes missing employee/profile data after schema upgrade.
-- Uses deterministic defaults for demo/staging environments.

begin;

-- ---------------------------------------------------------------------------
-- 1) Employees: fill canonical fields required by Employee Records
-- ---------------------------------------------------------------------------

-- Ensure job_title is always present (fallback from position).
update public.employees
set job_title = coalesce(nullif(job_title, ''), nullif(position, ''), 'Employee')
where job_title is null or job_title = '';

-- Ensure employee_number exists and is unique for missing records.
with max_existing as (
  select coalesce(max((regexp_replace(employee_number, '[^0-9]', '', 'g'))::int), 0) as n
  from public.employees
  where employee_number ~ '[0-9]'
),
missing as (
  select
    e.id,
    row_number() over (order by coalesce(e.created_at, now()), e.id) as rn
  from public.employees e
  where e.employee_number is null or trim(e.employee_number) = ''
)
update public.employees e
set employee_number = 'EMP-' || lpad((m.rn + x.n)::text, 4, '0')
from missing m
cross join max_existing x
where e.id = m.id;

-- Normalize role fallback if still null/blank.
update public.employees
set role = case
  when lower(coalesce(portal_role, '')) in ('hr admin', 'hr_admin') then 'HR_ADMIN'
  when lower(coalesce(portal_role, '')) in ('hr staff', 'hr_staff', 'hr') then 'HR_STAFF'
  when lower(coalesce(portal_role, '')) in ('hr manager', 'hr_manager') then 'HR_MANAGER'
  when lower(coalesce(portal_role, '')) in ('manager', 'engineering manager', 'department manager') then 'DEPARTMENT_MANAGER'
  when lower(coalesce(portal_role, '')) in ('auditor', 'audit officer') then 'AUDITOR'
  when lower(coalesce(portal_role, '')) in ('executive', 'management') then 'EXECUTIVE'
  when lower(coalesce(portal_role, '')) in ('system admin', 'system_admin', 'super_admin') then 'SUPER_ADMIN'
  else 'EMPLOYEE'
end
where role is null or trim(role) = '';

-- Normalize employment status and account status.
update public.employees
set employment_status = case
    when lower(coalesce(employment_status, '')) in ('active', 'full_time', 'part_time', 'contract', 'probation', 'internship') then 'ACTIVE'
    when lower(coalesce(employment_status, '')) in ('onboarding', 'pre_hire', 'pre-hire') then 'ONBOARDING'
    when lower(coalesce(employment_status, '')) in ('offboarded', 'terminated', 'suspended') then 'OFFBOARDED'
    else 'ACTIVE'
  end;

update public.employees
set account_status = coalesce(nullif(account_status, ''), 'active');

-- Fill dates.
update public.employees
set start_date = coalesce(start_date, date(created_at), current_date)
where start_date is null;

update public.employees
set regularization_date = coalesce(regularization_date, (start_date + interval '6 months')::date)
where regularization_date is null
  and employment_status in ('ACTIVE', 'ONBOARDING');

update public.employees
set separation_date = coalesce(separation_date, current_date)
where separation_date is null
  and employment_status = 'OFFBOARDED';

-- Fill employment_type.
update public.employees
set employment_type = case
    when upper(coalesce(employment_type, '')) in ('FULL_TIME','PART_TIME','CONTRACT','INTERNSHIP','PROBATION')
      then upper(employment_type)
    when lower(coalesce(employment_status, '')) = 'onboarding' then 'PROBATION'
    else 'FULL_TIME'
  end
where employment_type is null
   or trim(employment_type) = ''
   or upper(employment_type) not in ('FULL_TIME','PART_TIME','CONTRACT','INTERNSHIP','PROBATION');

-- Fill job_level heuristically.
update public.employees
set job_level = case
  when lower(job_title) like '%chief%' or lower(job_title) like '%director%' or lower(job_title) like '%executive%' then 'Executive'
  when lower(job_title) like '%manager%' or lower(job_title) like '%lead%' then 'Manager'
  when lower(job_title) like '%senior%' then 'Senior'
  when lower(job_title) like '%junior%' or lower(job_title) like '%associate%' then 'Junior'
  when lower(job_title) like '%staff%' then 'Staff'
  else 'Mid-Level'
end
where job_level is null or trim(job_level) = '';

-- Active flag and immutable employee number marker.
update public.employees
set
  is_active = (employment_status <> 'OFFBOARDED'),
  immutable_employee_number = true
where true;

-- ---------------------------------------------------------------------------
-- 2) Profiles: complete account fields, contact fields, and Gov IDs
-- ---------------------------------------------------------------------------

-- Sync profile phone/address/birthday defaults from employees when possible.
update public.profiles p
set
  phone = coalesce(nullif(p.phone, ''), e.personal_phone),
  current_address = coalesce(nullif(p.current_address, ''), e.current_address),
  birthday = coalesce(p.birthday, e.birthday)
from public.employees e
where p.user_id is not null
  and e.user_id = p.user_id;

-- Basic demographic defaults.
update public.profiles
set
  nationality = coalesce(nullif(nationality, ''), 'Filipino'),
  civil_status = coalesce(nullif(civil_status, ''), 'Not specified'),
  gender = coalesce(nullif(gender, ''), 'Not specified'),
  permanent_address = coalesce(nullif(permanent_address, ''), nullif(current_address, ''), 'Not provided')
where true;

-- Personal email fallback.
update public.profiles
set personal_email = coalesce(
  nullif(personal_email, ''),
  lower(replace(coalesce(first_name, 'user') || '.' || coalesce(last_name, 'profile'), ' ', '')) || '@personal.local'
)
where personal_email is null or trim(personal_email) = '';

-- Government ID placeholders (masked format for completeness in demo data).
update public.profiles
set
  sss = coalesce(nullif(sss, ''), '00-0000000-0'),
  philhealth = coalesce(nullif(philhealth, ''), '0000-0000-0000'),
  pagibig = coalesce(nullif(pagibig, ''), '0000-0000-0000'),
  tin = coalesce(nullif(tin, ''), '000-000-000')
where true;

-- Emergency contact placeholders.
update public.profiles
set
  emergency_contact_name = coalesce(nullif(emergency_contact_name, ''), 'Not provided'),
  emergency_contact_relationship = coalesce(nullif(emergency_contact_relationship, ''), 'Not provided'),
  emergency_contact_phone = coalesce(nullif(emergency_contact_phone, ''), 'Not provided')
where true;

-- ---------------------------------------------------------------------------
-- 3) Seed baseline compensation history where missing
-- ---------------------------------------------------------------------------
insert into public.employee_compensation_history (
  employee_id,
  amount,
  currency,
  pay_grade,
  effective_date,
  end_date,
  change_reason
)
select
  e.id,
  45000,
  'PHP',
  'PG-5',
  coalesce(e.start_date, date(e.created_at), current_date),
  null,
  'Initial compensation baseline'
from public.employees e
where not exists (
  select 1 from public.employee_compensation_history c where c.employee_id = e.id
);

commit;

