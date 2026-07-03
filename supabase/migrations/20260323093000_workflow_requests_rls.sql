-- RLS policies for HRIS Workflow Request Module

-- Helpers
create or replace function public.current_employee_id()
returns uuid
language plpgsql
stable
as $$
declare
  v_employee_id uuid;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'auth_user_id'
  ) then
    execute 'select id from public.employees where auth_user_id = $1 limit 1'
      into v_employee_id
      using auth.uid();
    return v_employee_id;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'user_id'
  ) then
    execute 'select id from public.employees where user_id = $1 limit 1'
      into v_employee_id
      using auth.uid();
    return v_employee_id;
  end if;

  return null;
end;
$$;

create or replace function public.current_employee_role()
returns text
language plpgsql
stable
as $$
declare
  v_role text := '';
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'auth_user_id'
  ) then
    execute 'select coalesce(role, '''') from public.employees where auth_user_id = $1 limit 1'
      into v_role
      using auth.uid();
    return coalesce(v_role, '');
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'user_id'
  ) then
    execute 'select coalesce(role, '''') from public.employees where user_id = $1 limit 1'
      into v_role
      using auth.uid();
    return coalesce(v_role, '');
  end if;

  return '';
end;
$$;

create or replace function public.is_workflow_reviewer()
returns boolean
language sql
stable
as $$
  select public.current_employee_role() in (
    'HR_STAFF',
    'HR_ADMIN',
    'HR_MANAGER',
    'MANAGER',
    'EXECUTIVE',
    'SUPER_ADMIN'
  )
$$;

-- Enable RLS
alter table public.workflow_requests enable row level security;
alter table public.personal_info_changes enable row level security;
alter table public.promotion_requests enable row level security;
alter table public.salary_change_requests enable row level security;
alter table public.transfer_requests enable row level security;
alter table public.department_change_requests enable row level security;
alter table public.workflow_logs enable row level security;
alter table public.request_attachments enable row level security;

-- workflow_requests
drop policy if exists workflow_requests_select_policy on public.workflow_requests;
create policy workflow_requests_select_policy
on public.workflow_requests
for select
using (
  employee_id = public.current_employee_id()
  or public.is_workflow_reviewer()
);

drop policy if exists workflow_requests_insert_policy on public.workflow_requests;
create policy workflow_requests_insert_policy
on public.workflow_requests
for insert
with check (
  employee_id = public.current_employee_id()
  or public.is_workflow_reviewer()
);

drop policy if exists workflow_requests_update_policy on public.workflow_requests;
create policy workflow_requests_update_policy
on public.workflow_requests
for update
using (
  employee_id = public.current_employee_id()
  or public.is_workflow_reviewer()
)
with check (
  employee_id = public.current_employee_id()
  or public.is_workflow_reviewer()
);

-- Shared access rule through parent request
-- personal_info_changes
drop policy if exists personal_info_changes_select_policy on public.personal_info_changes;
create policy personal_info_changes_select_policy
on public.personal_info_changes
for select
using (
  exists (
    select 1
    from public.workflow_requests wr
    where wr.id = personal_info_changes.request_id
      and (
        wr.employee_id = public.current_employee_id()
        or public.is_workflow_reviewer()
      )
  )
);

drop policy if exists personal_info_changes_insert_policy on public.personal_info_changes;
create policy personal_info_changes_insert_policy
on public.personal_info_changes
for insert
with check (
  exists (
    select 1
    from public.workflow_requests wr
    where wr.id = personal_info_changes.request_id
      and (
        wr.employee_id = public.current_employee_id()
        or public.is_workflow_reviewer()
      )
  )
);

drop policy if exists personal_info_changes_update_policy on public.personal_info_changes;
create policy personal_info_changes_update_policy
on public.personal_info_changes
for update
using (
  exists (
    select 1
    from public.workflow_requests wr
    where wr.id = personal_info_changes.request_id
      and (
        wr.employee_id = public.current_employee_id()
        or public.is_workflow_reviewer()
      )
  )
)
with check (
  exists (
    select 1
    from public.workflow_requests wr
    where wr.id = personal_info_changes.request_id
      and (
        wr.employee_id = public.current_employee_id()
        or public.is_workflow_reviewer()
      )
  )
);

-- promotion_requests
drop policy if exists promotion_requests_access_policy on public.promotion_requests;
create policy promotion_requests_access_policy
on public.promotion_requests
for all
using (
  exists (
    select 1
    from public.workflow_requests wr
    where wr.id = promotion_requests.request_id
      and (
        wr.employee_id = public.current_employee_id()
        or public.is_workflow_reviewer()
      )
  )
)
with check (
  exists (
    select 1
    from public.workflow_requests wr
    where wr.id = promotion_requests.request_id
      and (
        wr.employee_id = public.current_employee_id()
        or public.is_workflow_reviewer()
      )
  )
);

-- salary_change_requests
drop policy if exists salary_change_requests_access_policy on public.salary_change_requests;
create policy salary_change_requests_access_policy
on public.salary_change_requests
for all
using (
  exists (
    select 1
    from public.workflow_requests wr
    where wr.id = salary_change_requests.request_id
      and (
        wr.employee_id = public.current_employee_id()
        or public.is_workflow_reviewer()
      )
  )
)
with check (
  exists (
    select 1
    from public.workflow_requests wr
    where wr.id = salary_change_requests.request_id
      and (
        wr.employee_id = public.current_employee_id()
        or public.is_workflow_reviewer()
      )
  )
);

-- transfer_requests
drop policy if exists transfer_requests_access_policy on public.transfer_requests;
create policy transfer_requests_access_policy
on public.transfer_requests
for all
using (
  exists (
    select 1
    from public.workflow_requests wr
    where wr.id = transfer_requests.request_id
      and (
        wr.employee_id = public.current_employee_id()
        or public.is_workflow_reviewer()
      )
  )
)
with check (
  exists (
    select 1
    from public.workflow_requests wr
    where wr.id = transfer_requests.request_id
      and (
        wr.employee_id = public.current_employee_id()
        or public.is_workflow_reviewer()
      )
  )
);

-- department_change_requests
drop policy if exists department_change_requests_access_policy on public.department_change_requests;
create policy department_change_requests_access_policy
on public.department_change_requests
for all
using (
  exists (
    select 1
    from public.workflow_requests wr
    where wr.id = department_change_requests.request_id
      and (
        wr.employee_id = public.current_employee_id()
        or public.is_workflow_reviewer()
      )
  )
)
with check (
  exists (
    select 1
    from public.workflow_requests wr
    where wr.id = department_change_requests.request_id
      and (
        wr.employee_id = public.current_employee_id()
        or public.is_workflow_reviewer()
      )
  )
);

-- workflow_logs
drop policy if exists workflow_logs_select_policy on public.workflow_logs;
create policy workflow_logs_select_policy
on public.workflow_logs
for select
using (
  exists (
    select 1
    from public.workflow_requests wr
    where wr.id = workflow_logs.request_id
      and (
        wr.employee_id = public.current_employee_id()
        or public.is_workflow_reviewer()
      )
  )
);

drop policy if exists workflow_logs_insert_policy on public.workflow_logs;
create policy workflow_logs_insert_policy
on public.workflow_logs
for insert
with check (
  (
    action_by = public.current_employee_id()
    or public.is_workflow_reviewer()
  )
  and exists (
    select 1
    from public.workflow_requests wr
    where wr.id = workflow_logs.request_id
      and (
        wr.employee_id = public.current_employee_id()
        or public.is_workflow_reviewer()
      )
  )
);

-- request_attachments
drop policy if exists request_attachments_select_policy on public.request_attachments;
create policy request_attachments_select_policy
on public.request_attachments
for select
using (
  exists (
    select 1
    from public.workflow_requests wr
    where wr.id = request_attachments.request_id
      and (
        wr.employee_id = public.current_employee_id()
        or public.is_workflow_reviewer()
      )
  )
);

drop policy if exists request_attachments_insert_policy on public.request_attachments;
create policy request_attachments_insert_policy
on public.request_attachments
for insert
with check (
  exists (
    select 1
    from public.workflow_requests wr
    where wr.id = request_attachments.request_id
      and (
        wr.employee_id = public.current_employee_id()
        or public.is_workflow_reviewer()
      )
  )
);
