-- Align workflow detail tables with HRIS app (personal info fields + transfer location).
-- Safe to run on existing databases: uses IF EXISTS / IF NOT EXISTS patterns.

-- personal_info_changes: allow additional field_name values used by the app
alter table public.personal_info_changes
  drop constraint if exists personal_info_changes_field_name_check;

alter table public.personal_info_changes
  add constraint personal_info_changes_field_name_check
  check (
    field_name = any (
      array[
        'email'::text,
        'birthdate'::text,
        'fullname'::text,
        'address'::text,
        'contact_number'::text,
        'civil_status'::text
      ]
    )
  );

-- transfer_requests: store target location (app collects To Location separately from department)
alter table public.transfer_requests
  add column if not exists new_location text null;
