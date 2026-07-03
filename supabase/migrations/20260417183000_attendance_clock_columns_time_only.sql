begin;

-- Store only time values since attendance.date already stores the day.
alter table public.attendance
  alter column clock_in type time without time zone
  using (clock_in::time),
  alter column clock_out type time without time zone
  using (clock_out::time);

commit;

