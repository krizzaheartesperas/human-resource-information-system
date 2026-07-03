-- Promotion requests no longer include department movement.
-- Department movement is handled by department_change_requests.
alter table if exists public.promotion_requests
  drop column if exists proposed_department;
