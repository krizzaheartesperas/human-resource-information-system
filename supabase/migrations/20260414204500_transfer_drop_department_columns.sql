-- Transfer requests no longer carry department changes.
-- Department movement is handled by department_change_requests.
alter table if exists public.transfer_requests
  drop column if exists current_department,
  drop column if exists new_department;
