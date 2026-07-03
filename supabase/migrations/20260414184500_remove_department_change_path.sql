-- Remove legacy department change DB path.
-- Keeps workflow aligned to role_change + transfer scope.

begin;

alter table public.workflow_requests
  drop constraint if exists workflow_requests_type_check;

alter table public.workflow_requests
  add constraint workflow_requests_type_check
  check (
    type = any (
      array[
        'promotion'::text,
        'transfer'::text,
        'role_change'::text,
        'salary_change'::text,
        'manager_change'::text,
        'personal_info_change'::text
      ]
    )
  );

drop table if exists public.department_change_requests cascade;

commit;

