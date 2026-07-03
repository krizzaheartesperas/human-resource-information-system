begin;

-- Keep attendance.date consistent with the date used by linked correction requests.
-- This is safe because it only updates rows with an explicit link:
-- attendance_correction_requests.attendance_id -> attendance.id
update public.attendance a
set date = c.attendance_date
from public.attendance_correction_requests c
where c.attendance_id = a.id
  and a.date is distinct from c.attendance_date;

-- Helpful index for Team Time / attendance lookups.
create index if not exists idx_attendance_employee_date_desc
  on public.attendance (employee_id, date desc);

commit;

