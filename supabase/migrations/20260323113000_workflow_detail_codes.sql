-- Add human-readable codes for workflow_logs and personal_info_changes.
-- Keep UUID id as PK; codes are for display/reference.

create sequence if not exists public.workflow_log_code_seq start 1;
create sequence if not exists public.personal_info_change_code_seq start 1;

alter table public.workflow_logs
add column if not exists log_code text;

alter table public.personal_info_changes
add column if not exists change_code text;

create or replace function public.generate_workflow_log_code()
returns trigger
language plpgsql
as $$
begin
  if new.log_code is null or btrim(new.log_code) = '' then
    new.log_code := 'WL-' || lpad(nextval('public.workflow_log_code_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

create or replace function public.generate_personal_info_change_code()
returns trigger
language plpgsql
as $$
begin
  if new.change_code is null or btrim(new.change_code) = '' then
    new.change_code := 'PIC-' || lpad(nextval('public.personal_info_change_code_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_generate_workflow_log_code on public.workflow_logs;
create trigger trg_generate_workflow_log_code
before insert on public.workflow_logs
for each row
execute function public.generate_workflow_log_code();

drop trigger if exists trg_generate_personal_info_change_code on public.personal_info_changes;
create trigger trg_generate_personal_info_change_code
before insert on public.personal_info_changes
for each row
execute function public.generate_personal_info_change_code();

-- Backfill workflow_logs
with numbered as (
  select id, row_number() over (order by created_at asc, id asc) as rn
  from public.workflow_logs
  where log_code is null or btrim(log_code) = ''
)
update public.workflow_logs wl
set log_code = 'WL-' || lpad(numbered.rn::text, 5, '0')
from numbered
where wl.id = numbered.id;

-- Backfill personal_info_changes
with numbered as (
  select pic.id, row_number() over (order by wr.created_at asc, pic.id asc) as rn
  from public.personal_info_changes pic
  join public.workflow_requests wr on wr.id = pic.request_id
  where pic.change_code is null or btrim(pic.change_code) = ''
)
update public.personal_info_changes pic
set change_code = 'PIC-' || lpad(numbered.rn::text, 5, '0')
from numbered
where pic.id = numbered.id;

-- Move sequences forward after backfill
select setval(
  'public.workflow_log_code_seq',
  greatest(
    coalesce((select max(substring(log_code from 4)::int) from public.workflow_logs where log_code like 'WL-%'), 0),
    1
  ),
  true
);

select setval(
  'public.personal_info_change_code_seq',
  greatest(
    coalesce((select max(substring(change_code from 5)::int) from public.personal_info_changes where change_code like 'PIC-%'), 0),
    1
  ),
  true
);

create unique index if not exists idx_workflow_logs_log_code_unique
on public.workflow_logs(log_code);

create unique index if not exists idx_personal_info_changes_change_code_unique
on public.personal_info_changes(change_code);
