-- Remove optional performance summary column; UI and workflow text no longer use it.
alter table public.promotion_requests drop column if exists achievements;
