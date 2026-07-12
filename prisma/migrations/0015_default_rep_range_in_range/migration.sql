-- Default new workout logging rows to IN_RANGE so the primary logger starts from the expected hypertrophy-stimulus assumption.
-- Existing historical rows are intentionally not rewritten.
alter table public.workout_session_exercises
  alter column rep_range_status set default 'IN_RANGE';

alter table public.workout_sets
  alter column rep_range_status set default 'IN_RANGE';
