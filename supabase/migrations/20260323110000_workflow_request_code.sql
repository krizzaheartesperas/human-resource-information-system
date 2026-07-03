-- Add human-readable workflow request code (e.g. WR-00001)
-- Keep UUID id as PK for relational integrity.

create sequence if not exists public.workflow_request_code_seq start 1;

alter table public.workflow_requests
add column if not exists request_code text;

create or replace function public.generate_workflow_request_code()
returns trigger
language plpgsql
as $$
begin
  if new.request_code is null or btrim(new.request_code) = '' then
    new.request_code := 'WR-' || lpad(nextval('public.workflow_request_code_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_generate_workflow_request_code on public.workflow_requests;
create trigger trg_generate_workflow_request_code
before insert on public.workflow_requests
for each row
execute function public.generate_workflow_request_code();

-- Backfill older rows that were inserted before request_code existed.
with numbered as (
  select id, row_number() over (order by created_at asc, id asc) as rn
  from public.workflow_requests
  where request_code is null or btrim(request_code) = ''
)
update public.workflow_requests wr
set request_code = 'WR-' || lpad(numbered.rn::text, 5, '0')
from numbered
where wr.id = numbered.id;

-- Ensure sequence continues after backfill.
select setval(
  'public.workflow_request_code_seq',
  greatest(
    coalesce((select max(substring(request_code from 4)::int) from public.workflow_requests where request_code like 'WR-%'), 0),
    1
  ),
  true
);

create unique index if not exists idx_workflow_requests_request_code_unique
on public.workflow_requests(request_code);
