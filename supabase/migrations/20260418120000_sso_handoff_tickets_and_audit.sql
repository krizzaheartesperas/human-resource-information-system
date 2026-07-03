-- One-time SSO handoff tickets (Recruitment trusted server inserts; HRIS consumes via service role).
-- Audit trail for issued/consumed/failed attempts.

begin;

create table if not exists public.sso_handoff_tickets (
  id uuid primary key default gen_random_uuid(),
  secret_hash text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint uq_sso_handoff_tickets_secret_hash unique (secret_hash)
);

create index if not exists idx_sso_handoff_tickets_user_id
  on public.sso_handoff_tickets (user_id);

create index if not exists idx_sso_handoff_tickets_expires_at
  on public.sso_handoff_tickets (expires_at);

create table if not exists public.sso_handoff_audit (
  id bigint generated always as identity primary key,
  event text not null,
  ticket_id uuid references public.sso_handoff_tickets (id) on delete set null,
  user_id uuid,
  ip text,
  user_agent text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_sso_handoff_audit_created_at
  on public.sso_handoff_audit (created_at desc);

create index if not exists idx_sso_handoff_audit_event
  on public.sso_handoff_audit (event);

alter table public.sso_handoff_tickets enable row level security;
alter table public.sso_handoff_audit enable row level security;

-- No policies for anon/authenticated: deny via RLS. Service role bypasses RLS for API routes.

comment on table public.sso_handoff_tickets is
  'Recruitment (or other trusted app) inserts a row with sha256(raw_ticket) as secret_hash and auth user_id. HRIS consumes with atomic UPDATE ... RETURNING.';

comment on table public.sso_handoff_audit is
  'Append-only SSO handoff audit (written from HRIS /api/auth/sso/consume with service role).';

commit;
