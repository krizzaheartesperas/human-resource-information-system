-- Supabase Storage bucket + RLS policies for leave request supporting documents.
-- Bucket name aligns with app default: "leave-documents".

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'leave-documents',
  'leave-documents',
  true,
  10485760,
  array['application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "leave_documents_select_authenticated" on storage.objects;
drop policy if exists "leave_documents_insert_own_or_hr" on storage.objects;
drop policy if exists "leave_documents_update_own_or_hr" on storage.objects;
drop policy if exists "leave_documents_delete_own_or_hr" on storage.objects;

-- Read policy for Storage API usage (public URLs can also be used directly).
create policy "leave_documents_select_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'leave-documents');

-- Upload policy:
-- expected object path: leave-requests/<employee_id>/<request_id>/<filename>.pdf
-- employee_id is the second path segment.
create policy "leave_documents_insert_own_or_hr"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'leave-documents'
  and (
    (storage.foldername(name))[2] = public.current_employee_id()::text
    or exists (
      select 1
      from public.employees me
      where me.id = public.current_employee_id()
        and coalesce(me.role::text, '') in ('HR_STAFF', 'HR_ADMIN', 'HR_MANAGER', 'SUPER_ADMIN')
    )
  )
);

create policy "leave_documents_update_own_or_hr"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'leave-documents'
  and (
    (storage.foldername(name))[2] = public.current_employee_id()::text
    or exists (
      select 1
      from public.employees me
      where me.id = public.current_employee_id()
        and coalesce(me.role::text, '') in ('HR_STAFF', 'HR_ADMIN', 'HR_MANAGER', 'SUPER_ADMIN')
    )
  )
)
with check (
  bucket_id = 'leave-documents'
  and (
    (storage.foldername(name))[2] = public.current_employee_id()::text
    or exists (
      select 1
      from public.employees me
      where me.id = public.current_employee_id()
        and coalesce(me.role::text, '') in ('HR_STAFF', 'HR_ADMIN', 'HR_MANAGER', 'SUPER_ADMIN')
    )
  )
);

create policy "leave_documents_delete_own_or_hr"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'leave-documents'
  and (
    (storage.foldername(name))[2] = public.current_employee_id()::text
    or exists (
      select 1
      from public.employees me
      where me.id = public.current_employee_id()
        and coalesce(me.role::text, '') in ('HR_STAFF', 'HR_ADMIN', 'HR_MANAGER', 'SUPER_ADMIN')
    )
  )
);

commit;

