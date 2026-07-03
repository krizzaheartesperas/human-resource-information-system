-- Fix request_code gaps by re-numbering all workflow requests contiguously.
-- This changes existing request_code values (display-only) to remove "lapses".

BEGIN;

WITH ordered AS (
  SELECT
    id,
    row_number() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM public.workflow_requests
)
UPDATE public.workflow_requests wr
SET request_code = 'WR-' || lpad(ordered.rn::text, 5, '0')
FROM ordered
WHERE wr.id = ordered.id;

-- Reset sequence to the new max request_code number.
SELECT setval(
  'public.workflow_request_code_seq',
  COALESCE((
    SELECT max(substring(request_code FROM 4)::int)
    FROM public.workflow_requests
    WHERE request_code LIKE 'WR-%'
  ), 1),
  true
);

COMMIT;

