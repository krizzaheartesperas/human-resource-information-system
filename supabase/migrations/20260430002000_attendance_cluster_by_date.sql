begin;

-- DB-level ordering support for attendance rows by date (newest first).
-- Note: PostgreSQL tables are logically unordered; this clusters physical storage
-- based on the index to keep scans naturally date-ordered.
create index if not exists idx_attendance_date_created_desc
  on public.attendance (date desc, created_at desc, id desc);

cluster public.attendance using idx_attendance_date_created_desc;

analyze public.attendance;

commit;

