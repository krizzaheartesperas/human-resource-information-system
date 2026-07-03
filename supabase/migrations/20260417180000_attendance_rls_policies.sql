begin;

-- Enable Row Level Security on attendance table
alter table if exists public.attendance enable row level security;

-- SELECT own attendance rows
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'attendance'
      and policyname = 'attendance_select_own'
  ) then
    create policy attendance_select_own
    on public.attendance
    for select
    to authenticated
    using (
      employee_id in (
        select e.id
        from public.employees e
        where e.user_id = auth.uid()
           or e.auth_user_id = auth.uid()
      )
    );
  end if;
end
$$;

-- INSERT own attendance rows
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'attendance'
      and policyname = 'attendance_insert_own'
  ) then
    create policy attendance_insert_own
    on public.attendance
    for insert
    to authenticated
    with check (
      employee_id in (
        select e.id
        from public.employees e
        where e.user_id = auth.uid()
           or e.auth_user_id = auth.uid()
      )
    );
  end if;
end
$$;

-- UPDATE own attendance rows
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'attendance'
      and policyname = 'attendance_update_own'
  ) then
    create policy attendance_update_own
    on public.attendance
    for update
    to authenticated
    using (
      employee_id in (
        select e.id
        from public.employees e
        where e.user_id = auth.uid()
           or e.auth_user_id = auth.uid()
      )
    )
    with check (
      employee_id in (
        select e.id
        from public.employees e
        where e.user_id = auth.uid()
           or e.auth_user_id = auth.uid()
      )
    );
  end if;
end
$$;

-- DELETE own attendance rows (needed for dev reset button)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'attendance'
      and policyname = 'attendance_delete_own'
  ) then
    create policy attendance_delete_own
    on public.attendance
    for delete
    to authenticated
    using (
      employee_id in (
        select e.id
        from public.employees e
        where e.user_id = auth.uid()
           or e.auth_user_id = auth.uid()
      )
    );
  end if;
end
$$;

commit;

