-- Add explicit attachment metadata columns for personal info changes
-- and optional filename support for request_attachments.

begin;

alter table public.personal_info_changes
  add column if not exists supporting_document_url text null,
  add column if not exists supporting_document_name text null;

alter table public.request_attachments
  add column if not exists file_name text null;

commit;

