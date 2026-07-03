-- Seed missing current-year leave balance rows for existing employees.
--
-- Shared database safety:
-- - Insert-only.
-- - Does not update or delete existing leave_balances rows.
-- - Existing rows are preserved by the NOT EXISTS check and unique key.

begin;

insert into public.leave_balances (
  employee_id,
  type,
  year,
  total_days,
  used_days,
  pending_days
)
select
  e.id,
  leave_type.type,
  extract(year from now())::integer as year,
  leave_type.total_days,
  0 as used_days,
  0 as pending_days
from public.employees e
cross join (
  values
    ('VACATION_LEAVE'::text, 15),
    ('SICK_LEAVE'::text, 15),
    ('EMERGENCY_LEAVE'::text, 15),
    ('BEREAVEMENT_LEAVE'::text, 15),
    ('MATERNITY_LEAVE'::text, 15),
    ('PATERNITY_LEAVE'::text, 15),
    ('SOLO_PARENT_LEAVE'::text, 15),
    ('UNPAID_LEAVE'::text, 0)
) as leave_type(type, total_days)
where coalesce(e.is_active, true) = true
  and not exists (
    select 1
    from public.leave_balances lb
    where lb.employee_id = e.id
      and lb.type = leave_type.type
      and lb.year = extract(year from now())::integer
  );

commit;
