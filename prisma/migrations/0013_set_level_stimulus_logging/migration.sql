-- Add set-level stimulus fields while preserving existing exercise-level stimulus fields for backward compatibility.
ALTER TABLE workout_sets
  ADD COLUMN IF NOT EXISTS rep_range_status "RepRangeStatus" NOT NULL DEFAULT 'NOT_LOGGED',
  ADD COLUMN IF NOT EXISTS effort_status "EffortStatus" NOT NULL DEFAULT 'PRODUCTIVE',
  ADD COLUMN IF NOT EXISTS pain_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pain_note text;

-- Existing completed set rows came from the previous exercise-level stimulus model.
-- Keep them analytically compatible by inheriting the exercise-level statuses where available.
UPDATE workout_sets ws
SET
  rep_range_status = wse.rep_range_status,
  effort_status = wse.effort_status,
  pain_flag = COALESCE(wse.pain_flag, false),
  pain_note = wse.pain_note
FROM workout_session_exercises wse
WHERE ws.session_exercise_id = wse.id
  AND ws.is_completed = true;
