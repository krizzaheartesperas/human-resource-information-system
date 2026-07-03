-- Align transfer_requests with Transfer form team fields.
alter table if exists public.transfer_requests
  add column if not exists current_team text null,
  add column if not exists target_team text null;

-- Backfill target_team from legacy target_team_branch when available.
update public.transfer_requests
set target_team = coalesce(target_team, target_team_branch)
where coalesce(target_team, '') = '';
