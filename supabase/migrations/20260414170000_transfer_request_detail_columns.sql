-- Add structured transfer detail columns used by the Transfer tab form.
-- Safe additive migration.

begin;

alter table public.transfer_requests
  add column if not exists current_location text null,
  add column if not exists effective_date date null,
  add column if not exists impact_notes text null;

commit;

