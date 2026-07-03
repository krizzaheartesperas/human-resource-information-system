-- Attendance backend setup (shared-safe, additive-only)
-- This migration avoids destructive changes (no DROP statements).
-- It creates:
--   1) attendance_logs
--   2) attendance_daily
--   3) RLS + policies (if missing)
--   4) functions: clock_in, clock_out, compute_attendance

begin;

create extension if not exists pgcrypto;

-- ============================================================
-- 1) attendance_logs
-- ============================================================
create table if not exists public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null,
  log_type text not null check (log_type in ('clock_in', 'clock_out', 'break_start', 'break_end')),
  log_time timestamptz not null default now(),
  location text,
  device text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'attendance_logs_employee_id_fkey'
  ) then
    alter table public.attendance_logs
      add constraint attendance_logs_employee_id_fkey
      foreign key (employee_id)
      references public.employees(id)
      on delete cascade;
  end if;
end
$$;

create index if not exists idx_attendance_logs_employee_time
  on public.attendance_logs(employee_id, log_time);

create index if not exists idx_attendance_logs_employee_type_time
  on public.attendance_logs(employee_id, log_type, log_time);

-- ============================================================
-- 2) attendance_daily
-- ============================================================
create table if not exists public.attendance_daily (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null,
  attendance_date date not null,
  time_in timestamptz,
  time_out timestamptz,
  break_minutes int not null default 0 check (break_minutes >= 0),
  total_hours numeric(6,2) not null default 0,
  regular_hours numeric(6,2) not null default 0,
  overtime_hours numeric(6,2) not null default 0,
  night_shift_hours numeric(6,2) not null default 0,
  night_ot_hours numeric(6,2) not null default 0,
  late_minutes int not null default 0 check (late_minutes >= 0),
  undertime_minutes int not null default 0 check (undertime_minutes >= 0),
  status text not null default 'pending' check (status in ('pending', 'complete', 'late', 'missing')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_daily_employee_date_unique unique (employee_id, attendance_date)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'attendance_daily_employee_id_fkey'
  ) then
    alter table public.attendance_daily
      add constraint attendance_daily_employee_id_fkey
      foreign key (employee_id)
      references public.employees(id)
      on delete cascade;
  end if;
end
$$;

create index if not exists idx_attendance_daily_employee_date
  on public.attendance_daily(employee_id, attendance_date);

-- Keep updated_at fresh on updates (create only if missing)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'trg_attendance_daily_updated_at'
      and n.nspname = 'public'
      and c.relname = 'attendance_daily'
  ) then
    create trigger trg_attendance_daily_updated_at
    before update on public.attendance_daily
    for each row
    execute function public.set_updated_at();
  end if;
end
$$;

-- ============================================================
-- 3) RLS
-- ============================================================
alter table public.attendance_logs enable row level security;
alter table public.attendance_daily enable row level security;

-- attendance_logs: employee can SELECT own logs
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'attendance_logs'
      and policyname = 'attendance_logs_select_own'
  ) then
    create policy attendance_logs_select_own
    on public.attendance_logs
    for select
    to authenticated
    using (
      employee_id = (
        select e.id
        from public.employees e
        where e.auth_user_id = auth.uid()
      )
    );
  end if;
end
$$;

-- attendance_logs: employee can INSERT own logs
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'attendance_logs'
      and policyname = 'attendance_logs_insert_own'
  ) then
    create policy attendance_logs_insert_own
    on public.attendance_logs
    for insert
    to authenticated
    with check (
      employee_id = (
        select e.id
        from public.employees e
        where e.auth_user_id = auth.uid()
      )
    );
  end if;
end
$$;

-- attendance_daily: employee can SELECT own daily records
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'attendance_daily'
      and policyname = 'attendance_daily_select_own'
  ) then
    create policy attendance_daily_select_own
    on public.attendance_daily
    for select
    to authenticated
    using (
      employee_id = (
        select e.id
        from public.employees e
        where e.auth_user_id = auth.uid()
      )
    );
  end if;
end
$$;

-- ============================================================
-- 4) Functions (create only if missing)
-- ============================================================

-- clock_in()
do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'clock_in'
      and pg_get_function_identity_arguments(p.oid) = 'p_location text, p_device text'
  ) then
    execute $fn$
      create function public.clock_in(
        p_location text default null,
        p_device text default null
      )
      returns uuid
      language plpgsql
      security definer
      set search_path = public
      as $body$
      declare
        v_employee_id uuid;
        v_last_inout_type text;
        v_log_id uuid;
      begin
        select e.id
          into v_employee_id
        from public.employees e
        where e.auth_user_id = auth.uid()
        limit 1;

        if v_employee_id is null then
          raise exception 'No employee record found for current user';
        end if;

        select al.log_type
          into v_last_inout_type
        from public.attendance_logs al
        where al.employee_id = v_employee_id
          and al.log_type in ('clock_in', 'clock_out')
        order by al.log_time desc
        limit 1;

        if v_last_inout_type = 'clock_in' then
          raise exception 'Already clocked in. Please clock out first.';
        end if;

        insert into public.attendance_logs (employee_id, log_type, log_time, location, device)
        values (v_employee_id, 'clock_in', now(), p_location, p_device)
        returning id into v_log_id;

        return v_log_id;
      end;
      $body$;
    $fn$;
  end if;
end
$$;

grant execute on function public.clock_in(text, text) to authenticated;

-- clock_out()
do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'clock_out'
      and pg_get_function_identity_arguments(p.oid) = 'p_location text, p_device text'
  ) then
    execute $fn$
      create function public.clock_out(
        p_location text default null,
        p_device text default null
      )
      returns uuid
      language plpgsql
      security definer
      set search_path = public
      as $body$
      declare
        v_employee_id uuid;
        v_last_inout_type text;
        v_log_id uuid;
      begin
        select e.id
          into v_employee_id
        from public.employees e
        where e.auth_user_id = auth.uid()
        limit 1;

        if v_employee_id is null then
          raise exception 'No employee record found for current user';
        end if;

        select al.log_type
          into v_last_inout_type
        from public.attendance_logs al
        where al.employee_id = v_employee_id
          and al.log_type in ('clock_in', 'clock_out')
        order by al.log_time desc
        limit 1;

        if v_last_inout_type is distinct from 'clock_in' then
          raise exception 'Cannot clock out before clocking in.';
        end if;

        insert into public.attendance_logs (employee_id, log_type, log_time, location, device)
        values (v_employee_id, 'clock_out', now(), p_location, p_device)
        returning id into v_log_id;

        return v_log_id;
      end;
      $body$;
    $fn$;
  end if;
end
$$;

grant execute on function public.clock_out(text, text) to authenticated;

-- compute_attendance(employee_id, date)
do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'compute_attendance'
      and pg_get_function_identity_arguments(p.oid) = 'p_employee_id uuid, p_attendance_date date'
  ) then
    execute $fn$
      create function public.compute_attendance(
        p_employee_id uuid,
        p_attendance_date date
      )
      returns void
      language plpgsql
      security definer
      set search_path = public
      as $body$
      declare
        v_time_in timestamptz;
        v_time_out timestamptz;
        v_total_minutes int := 0;
        v_total_hours numeric(6,2) := 0;
        v_regular_hours numeric(6,2) := 0;
        v_overtime_hours numeric(6,2) := 0;
        v_late_minutes int := 0;
        v_undertime_minutes int := 0;
        v_status text := 'missing';
        v_shift_start timestamptz;
      begin
        select min(al.log_time)
          into v_time_in
        from public.attendance_logs al
        where al.employee_id = p_employee_id
          and al.log_type = 'clock_in'
          and al.log_time::date = p_attendance_date;

        select max(al.log_time)
          into v_time_out
        from public.attendance_logs al
        where al.employee_id = p_employee_id
          and al.log_type = 'clock_out'
          and al.log_time::date = p_attendance_date;

        if v_time_in is null and v_time_out is null then
          v_status := 'missing';
        elsif v_time_in is not null and v_time_out is null then
          v_status := 'pending';
        elsif v_time_in is null and v_time_out is not null then
          v_status := 'pending';
        else
          if v_time_out > v_time_in then
            v_total_minutes := floor(extract(epoch from (v_time_out - v_time_in)) / 60);
          else
            v_total_minutes := 0;
          end if;

          v_total_hours := round(v_total_minutes::numeric / 60.0, 2);
          v_regular_hours := round(least(v_total_hours, 8.0), 2);
          v_overtime_hours := round(greatest(v_total_hours - 8.0, 0), 2);

          v_shift_start := (p_attendance_date::text || ' 08:00:00+00')::timestamptz;
          if v_time_in > v_shift_start then
            v_late_minutes := floor(extract(epoch from (v_time_in - v_shift_start)) / 60);
          else
            v_late_minutes := 0;
          end if;

          v_undertime_minutes := greatest(480 - v_total_minutes, 0);
          if v_late_minutes > 0 then
            v_status := 'late';
          else
            v_status := 'complete';
          end if;
        end if;

        insert into public.attendance_daily (
          employee_id,
          attendance_date,
          time_in,
          time_out,
          break_minutes,
          total_hours,
          regular_hours,
          overtime_hours,
          night_shift_hours,
          night_ot_hours,
          late_minutes,
          undertime_minutes,
          status
        )
        values (
          p_employee_id,
          p_attendance_date,
          v_time_in,
          v_time_out,
          0,
          coalesce(v_total_hours, 0),
          coalesce(v_regular_hours, 0),
          coalesce(v_overtime_hours, 0),
          0,
          0,
          coalesce(v_late_minutes, 0),
          coalesce(v_undertime_minutes, 0),
          v_status
        )
        on conflict (employee_id, attendance_date)
        do update set
          time_in = excluded.time_in,
          time_out = excluded.time_out,
          break_minutes = excluded.break_minutes,
          total_hours = excluded.total_hours,
          regular_hours = excluded.regular_hours,
          overtime_hours = excluded.overtime_hours,
          night_shift_hours = excluded.night_shift_hours,
          night_ot_hours = excluded.night_ot_hours,
          late_minutes = excluded.late_minutes,
          undertime_minutes = excluded.undertime_minutes,
          status = excluded.status,
          updated_at = now();
      end;
      $body$;
    $fn$;
  end if;
end
$$;

commit;

