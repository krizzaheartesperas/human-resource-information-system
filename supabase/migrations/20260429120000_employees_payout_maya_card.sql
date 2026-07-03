-- Maya payout account + linked card details per employee.

begin;

create table if not exists public.employee_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  payout_preference text not null default 'maya' check (payout_preference in ('maya', 'bank')),
  card_holder_name text,
  card_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id)
);

create index if not exists idx_employee_payout_accounts_employee_id
  on public.employee_payout_accounts(employee_id);

comment on table public.employee_payout_accounts is 'Per-employee Maya payout account + linked card metadata.';
comment on column public.employee_payout_accounts.payout_preference is 'maya | bank payout preference.';
comment on column public.employee_payout_accounts.card_holder_name is 'Display name on linked Maya/bank card.';
comment on column public.employee_payout_accounts.card_number is 'Linked card number (16 digits, UI masked by default).';

alter table public.employee_payout_accounts enable row level security;

drop policy if exists "employee_payout_accounts_select_self" on public.employee_payout_accounts;
drop policy if exists "employee_payout_accounts_insert_self" on public.employee_payout_accounts;
drop policy if exists "employee_payout_accounts_update_self" on public.employee_payout_accounts;
drop policy if exists "employee_payout_accounts_delete_self" on public.employee_payout_accounts;

create policy "employee_payout_accounts_select_self"
on public.employee_payout_accounts
for select
to authenticated
using (
  employee_id = public.current_employee_id()
);

create policy "employee_payout_accounts_insert_self"
on public.employee_payout_accounts
for insert
to authenticated
with check (
  employee_id = public.current_employee_id()
);

create policy "employee_payout_accounts_update_self"
on public.employee_payout_accounts
for update
to authenticated
using (
  employee_id = public.current_employee_id()
)
with check (
  employee_id = public.current_employee_id()
);

create policy "employee_payout_accounts_delete_self"
on public.employee_payout_accounts
for delete
to authenticated
using (
  employee_id = public.current_employee_id()
);

-- Demo Personal Workplace cards (EMP-0002 … EMP-0009), by employee_code / employee_number.
insert into public.employee_payout_accounts (
  employee_id,
  payout_preference,
  card_holder_name,
  card_number
)
select
  e.id,
  'maya',
  v.holder,
  v.card_number
from public.employees e
join (values
  ('EMP-0002', 'Glean Ramos', '4123456789013210'),
  ('EMP-0003', 'Jon Garcia', '4123456789015631'),
  ('EMP-0004', 'Clinton Galvez', '4123456789011142'),
  ('EMP-0005', 'Kath Domingo', '4123456789017783'),
  ('EMP-0006', 'Randy Castro', '4123456789016674'),
  ('EMP-0007', 'Francis Lopez', '4123456789018895'),
  ('EMP-0008', 'Lani Rivera', '4123456789011126'),
  ('EMP-0009', 'Anthony Torres', '4123456789019907')
) as v(code, holder, card_number)
  on coalesce(nullif(trim(e.employee_code), ''), nullif(trim(e.employee_number), '')) = v.code
on conflict (employee_id) do update
set
  payout_preference = excluded.payout_preference,
  card_holder_name = excluded.card_holder_name,
  card_number = excluded.card_number,
  updated_at = now();

commit;
