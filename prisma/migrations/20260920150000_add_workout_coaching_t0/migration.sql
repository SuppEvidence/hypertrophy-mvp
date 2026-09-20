-- T0 live-coaching persistence: traceable set prescriptions and a dedicated
-- short-horizon coaching action/outcome ledger.
CREATE TYPE "WorkoutCoachActionType" AS ENUM (
  'KEEP',
  'CHANGE_LOAD',
  'CHANGE_REP_TARGET',
  'CHANGE_RIR_TARGET',
  'CHANGE_REST',
  'ADD_SET',
  'REMOVE_SET',
  'STOP_EXERCISE'
);

CREATE TYPE "WorkoutCoachActionStatus" AS ENUM (
  'PROPOSED',
  'APPLIED',
  'DECLINED',
  'SUPERSEDED'
);

ALTER TABLE "workout_sets" ADD COLUMN "prescription" JSONB;

CREATE TABLE "workout_coach_actions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "session_exercise_id" UUID NOT NULL,
  "trigger_set_id" UUID,
  "action_type" "WorkoutCoachActionType" NOT NULL,
  "confidence" TEXT NOT NULL,
  "reason_code" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "before_state" JSONB NOT NULL,
  "proposed_state" JSONB NOT NULL,
  "applied_state" JSONB,
  "status" "WorkoutCoachActionStatus" NOT NULL DEFAULT 'PROPOSED',
  "outcome" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "applied_at" TIMESTAMP(3),
  "evaluated_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workout_coach_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workout_coach_actions_user_id_created_at_idx" ON "workout_coach_actions"("user_id", "created_at");
CREATE INDEX "workout_coach_actions_session_id_created_at_idx" ON "workout_coach_actions"("session_id", "created_at");
CREATE INDEX "workout_coach_actions_session_exercise_id_status_created_at_idx" ON "workout_coach_actions"("session_exercise_id", "status", "created_at");
CREATE UNIQUE INDEX "workout_coach_actions_trigger_set_id_key" ON "workout_coach_actions"("trigger_set_id");

ALTER TABLE "workout_coach_actions" ADD CONSTRAINT "workout_coach_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_coach_actions" ADD CONSTRAINT "workout_coach_actions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_coach_actions" ADD CONSTRAINT "workout_coach_actions_session_exercise_id_fkey" FOREIGN KEY ("session_exercise_id") REFERENCES "workout_session_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_coach_actions" ADD CONSTRAINT "workout_coach_actions_trigger_set_id_fkey" FOREIGN KEY ("trigger_set_id") REFERENCES "workout_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
