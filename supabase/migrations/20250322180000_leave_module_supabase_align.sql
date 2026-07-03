-- Leave module: align with app enums and sync from the Next.js client.
-- - Text primary key supports existing demo IDs (lr-*, etc.) and UUID strings.
-- - Drops restrictive CHECK constraints so full LeaveStatus / TimeOffType values persist.
-- - Adds metadata JSON for remarks, rejectionReason, returnedTo, supportingDocName, etc.
--
-- After applying: seed public.employees with rows whose employee_number matches mock data
-- (E001, E002, …) so leave_requests.employee_id FK resolves. Enable RLS policies as needed.

alter table public.leave_requests drop constraint if exists leave_requests_pkey;

alter table public.leave_requests alter column id drop default;

alter table public.leave_requests alter column id type text using id::text;

alter table public.leave_requests add primary key (id);

alter table public.leave_requests drop constraint if exists leave_requests_type_check;

alter table public.leave_requests drop constraint if exists leave_requests_status_check;

alter table public.leave_requests
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.leave_balances drop constraint if exists leave_balances_type_check;

comment on column public.leave_requests.metadata is
  'Workflow/UI fields not in core columns: remarks, rejectionReason, returnedTo, supportingDocName (avoid large supportingDocDataUrl in DB).';
