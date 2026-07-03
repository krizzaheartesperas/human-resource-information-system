-- Seed dummy Employee Records data (idempotent)
-- Adds complete sample rows for employees + profiles + history tables.

begin;

-- ---------------------------------------------------------------------------
-- 1) Dummy employees (safe insert)
-- ---------------------------------------------------------------------------
insert into public.employees (
  id,
  user_id,
  employee_number,
  employee_code,
  department_id,
  job_title,
  position,
  manager_id,
  role,
  portal_role,
  employment_status,
  account_status,
  is_active,
  start_date,
  regularization_date,
  separation_date,
  employment_type,
  job_level,
  birthday,
  current_address,
  personal_phone,
  profile_photo,
  immutable_employee_number,
  created_at,
  updated_at
)
with seed as (
  select *
  from (
    values
      (
        'EMP-0101',
        'Dianne',
        'Lopez',
        'dianne.lopez@company.com',
        'HR_STAFF',
        'HR Staff',
        'ACTIVE',
        'FULL_TIME',
        'Staff',
        date '2024-02-01',
        date '1997-04-11',
        '45 Pioneer St, Mandaluyong City',
        '+63 917 321 9876',
        (select id from public.departments order by created_at asc limit 1)
      ),
      (
        'EMP-0102',
        'Mark',
        'Rivera',
        'mark.rivera@company.com',
        'EMPLOYEE',
        'Junior Software Developer',
        'ACTIVE',
        'FULL_TIME',
        'Junior',
        date '2025-01-15',
        date '2000-09-21',
        '102 Rizal Ave, Pasig City',
        '+63 918 222 3344',
        (select id from public.departments order by created_at asc limit 1)
      ),
      (
        'EMP-0103',
        'Angela',
        'Cruz',
        'angela.cruz@company.com',
        'HR_ADMIN',
        'HR Admin',
        'ACTIVE',
        'FULL_TIME',
        'Manager',
        date '2023-08-10',
        date '1993-12-03',
        '9 Ayala Ext, Makati City',
        '+63 919 888 1212',
        (select id from public.departments order by created_at asc limit 1)
      )
  ) as s(
    employee_number,
    first_name,
    last_name,
    email,
    role,
    job_title,
    employment_status,
    employment_type,
    job_level,
    start_date,
    birthday,
    current_address,
    personal_phone,
    department_id
  )
)
select
  gen_random_uuid(),
  gen_random_uuid(),
  s.employee_number,
  s.employee_number,
  s.department_id,
  s.job_title,
  s.job_title,
  null,
  s.role,
  lower(replace(s.role, '_', ' ')),
  s.employment_status,
  'active',
  (s.employment_status <> 'OFFBOARDED'),
  s.start_date,
  (s.start_date + interval '6 months')::date,
  case when s.employment_status = 'OFFBOARDED' then current_date else null end,
  s.employment_type,
  s.job_level,
  s.birthday,
  s.current_address,
  s.personal_phone,
  null,
  true,
  now(),
  now()
from seed s
where not exists (
  select 1 from public.employees e where e.employee_number = s.employee_number
);

-- ---------------------------------------------------------------------------
-- 2) Dummy profiles for those seeded employees
-- ---------------------------------------------------------------------------
insert into public.profiles (
  first_name,
  last_name,
  user_id,
  user_type,
  phone,
  current_address,
  permanent_address,
  birthday,
  gender,
  civil_status,
  nationality,
  personal_email,
  sss,
  philhealth,
  pagibig,
  tin,
  emergency_contact_name,
  emergency_contact_relationship,
  emergency_contact_phone,
  created_at,
  updated_at
)
with seed as (
  select *
  from (
    values
      ('EMP-0101','Dianne','Lopez','dianne.lopez@company.com','+63 917 321 9876','45 Pioneer St, Mandaluyong City',date '1997-04-11'),
      ('EMP-0102','Mark','Rivera','mark.rivera@company.com','+63 918 222 3344','102 Rizal Ave, Pasig City',date '2000-09-21'),
      ('EMP-0103','Angela','Cruz','angela.cruz@company.com','+63 919 888 1212','9 Ayala Ext, Makati City',date '1993-12-03')
  ) as s(employee_number,first_name,last_name,email,phone,current_address,birthday)
)
select
  s.first_name,
  s.last_name,
  e.user_id,
  'employee',
  coalesce(e.personal_phone, s.phone, '+63 900 000 0000'),
  coalesce(e.current_address, s.current_address, 'Not provided'),
  coalesce(e.current_address, s.current_address, 'Not provided'),
  coalesce(e.birthday, s.birthday),
  'Not specified',
  'Not specified',
  'Filipino',
  lower(replace(s.first_name || '.' || s.last_name, ' ', '')) || '@personal.local',
  '12-3456789-0',
  '1234-5678-9012',
  '1234-5678-9012',
  '123-456-789',
  'Maria ' || s.last_name,
  'Sibling',
  '+63 917 000 0000',
  now(),
  now()
from public.employees e
join seed s
  on e.employee_number = s.employee_number
  or e.employee_code = s.employee_number
where (
    e.employee_number in ('EMP-0101', 'EMP-0102', 'EMP-0103')
    or e.employee_code in ('EMP-0101', 'EMP-0102', 'EMP-0103')
  )
  and not exists (
    select 1
    from public.profiles p
    where p.user_id = e.user_id
  );

-- ---------------------------------------------------------------------------
-- 3) Seed employment + compensation history baseline
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
  change_reason,
  created_at
)
select
  e.id,
  e.job_title,
  e.department_id,
  e.manager_id,
  e.employment_status,
  e.employment_type,
  case when e.role = 'HR_ADMIN' then 70000 when e.role = 'HR_STAFF' then 45000 else 35000 end,
  e.start_date,
  e.separation_date,
  'Initial dummy seed snapshot',
  now()
from public.employees e
where e.employee_number in ('EMP-0101', 'EMP-0102', 'EMP-0103')
  and not exists (
    select 1 from public.employee_employment_history h where h.employee_id = e.id
  );

insert into public.employee_compensation_history (
  employee_id,
  amount,
  currency,
  pay_grade,
  effective_date,
  end_date,
  change_reason,
  created_at
)
select
  e.id,
  case when e.role = 'HR_ADMIN' then 70000 when e.role = 'HR_STAFF' then 45000 else 35000 end,
  'PHP',
  case when e.role = 'HR_ADMIN' then 'PG-7' when e.role = 'HR_STAFF' then 'PG-5' else 'PG-3' end,
  e.start_date,
  null,
  'Initial dummy compensation',
  now()
from public.employees e
where e.employee_number in ('EMP-0101', 'EMP-0102', 'EMP-0103')
  and not exists (
    select 1 from public.employee_compensation_history c where c.employee_id = e.id
  );

commit;

