-- Role Change detail tables are deprecated in favor of salary/dept workflows.
drop table if exists public.role_change_requests cascade;
drop table if exists public.role_change_request cascade;
