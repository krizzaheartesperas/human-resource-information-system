begin;

create or replace function public.can_approve_overtime_request(p_requester_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_requester_no text;
  v_actor_no text;
begin
  select
    coalesce(nullif(trim(employee_number), ''), nullif(trim(employee_code), '')) into v_requester_no
  from public.employees
  where id = p_requester_id;

  select
    coalesce(nullif(trim(employee_number), ''), nullif(trim(employee_code), '')) into v_actor_no
  from public.employees
  where id = public.current_employee_id();

  if v_requester_no is null or v_actor_no is null then
    return false;
  end if;

  return case upper(v_requester_no)
    when 'EMP-0002' then upper(v_actor_no) in ('EMP-0003')
    when 'EMP-0003' then upper(v_actor_no) in ('EMP-0006')
    when 'EMP-0004' then upper(v_actor_no) in ('EMP-0006')
    when 'EMP-0005' then upper(v_actor_no) in ('EMP-0006')
    when 'EMP-0006' then upper(v_actor_no) in ('EMP-0008')
    when 'EMP-0007' then upper(v_actor_no) in ('EMP-0006')
    when 'EMP-0008' then upper(v_actor_no) in ('EMP-0006', 'EMP-0004')
    when 'EMP-0009' then upper(v_actor_no) in ('EMP-0006')
    else false
  end;
end;
$$;

create or replace function public.can_approve_attendance_issue(p_requester_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_requester_no text;
  v_actor_no text;
begin
  select
    coalesce(nullif(trim(employee_number), ''), nullif(trim(employee_code), '')) into v_requester_no
  from public.employees
  where id = p_requester_id;

  select
    coalesce(nullif(trim(employee_number), ''), nullif(trim(employee_code), '')) into v_actor_no
  from public.employees
  where id = public.current_employee_id();

  if v_requester_no is null or v_actor_no is null then
    return false;
  end if;

  return case upper(v_requester_no)
    when 'EMP-0002' then upper(v_actor_no) in ('EMP-0005')
    when 'EMP-0003' then upper(v_actor_no) in ('EMP-0005')
    when 'EMP-0004' then upper(v_actor_no) in ('EMP-0005')
    when 'EMP-0005' then upper(v_actor_no) in ('EMP-0006')
    when 'EMP-0006' then upper(v_actor_no) in ('EMP-0004')
    when 'EMP-0007' then upper(v_actor_no) in ('EMP-0005')
    when 'EMP-0008' then upper(v_actor_no) in ('EMP-0004')
    when 'EMP-0009' then upper(v_actor_no) in ('EMP-0005')
    else false
  end;
end;
$$;

commit;

