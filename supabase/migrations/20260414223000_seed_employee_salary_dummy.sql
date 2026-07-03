-- Seed dummy current salary for all employees that do not have one yet.
-- Safe to re-run: skips employees with an existing is_current=true row.
insert into public.employee_salary (
  employee_id,
  base_salary,
  currency,
  pay_frequency,
  effective_from,
  is_current,
  notes
)
select
  e.id as employee_id,
  case
    when lower(coalesce(e.job_title, e.position, '')) like '%junior software engineer%' then 28000
    when lower(coalesce(e.job_title, e.position, '')) like '%software engineer ii%' then 36000
    when lower(coalesce(e.job_title, e.position, '')) like '%senior software engineer%' then 55000
    when lower(coalesce(e.job_title, e.position, '')) like '%engineering manager%' then 85000
    when lower(coalesce(e.job_title, e.position, '')) like '%hr admin%' then 42000
    when lower(coalesce(e.job_title, e.position, '')) like '%hr manager%' then 70000
    when lower(coalesce(e.job_title, e.position, '')) like '%hr staff%' then 30000
    when lower(coalesce(e.job_title, e.position, '')) like '%audit%' then 45000
    when lower(coalesce(e.job_title, e.position, '')) like '%executive%' then 120000
    when lower(coalesce(e.job_title, e.position, '')) like '%system admin%' then 65000
    when lower(coalesce(e.job_title, e.position, '')) like '%data analyst%' then 40000
    else 25000
  end::numeric(12,2) as base_salary,
  'PHP' as currency,
  'MONTHLY' as pay_frequency,
  current_date as effective_from,
  true as is_current,
  'Dummy seed salary generated from employee title.' as notes
from public.employees e
where not exists (
  select 1
  from public.employee_salary s
  where s.employee_id = e.id
    and s.is_current = true
);
