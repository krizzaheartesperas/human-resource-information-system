begin;

-- Postgres tables do not guarantee row order.
-- Use this view anywhere you need deterministic latest-first ordering.
create or replace view public.attendance_latest_first as
select *
from public.attendance
order by date desc, created_at desc, id desc;

commit;

