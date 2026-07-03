DO $$ 
BEGIN 
  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_schema='public' AND table_name='attendance' AND column_name='total_late_minutes') THEN
      ALTER TABLE public.attendance RENAME COLUMN late_minutes TO total_late_minutes;
  END IF;
  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_schema='public' AND table_name='attendance' AND column_name='total_undertime_minutes') THEN
      ALTER TABLE public.attendance RENAME COLUMN undertime_minutes TO total_undertime_minutes;
  END IF;
  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_schema='public' AND table_name='attendance' AND column_name='total_overtime_minutes') THEN
      ALTER TABLE public.attendance RENAME COLUMN overtime_minutes TO total_overtime_minutes;
  END IF;
END $$;

ALTER TABLE public.attendance
DROP COLUMN IF EXISTS late_hour,
DROP COLUMN IF EXISTS late_minutes,
DROP COLUMN IF EXISTS undertime_hour,
DROP COLUMN IF EXISTS undertime_minutes,
DROP COLUMN IF EXISTS overtime_hour,
DROP COLUMN IF EXISTS overtime_minutes;

ALTER TABLE public.attendance
ADD COLUMN late_hour integer GENERATED ALWAYS AS (total_late_minutes / 60) STORED,
ADD COLUMN late_minutes integer GENERATED ALWAYS AS (total_late_minutes % 60) STORED,
ADD COLUMN undertime_hour integer GENERATED ALWAYS AS (total_undertime_minutes / 60) STORED,
ADD COLUMN undertime_minutes integer GENERATED ALWAYS AS (total_undertime_minutes % 60) STORED,
ADD COLUMN overtime_hour integer GENERATED ALWAYS AS (total_overtime_minutes / 60) STORED,
ADD COLUMN overtime_minutes integer GENERATED ALWAYS AS (total_overtime_minutes % 60) STORED;
