CREATE TYPE "ExerciseCoachingPreference" AS ENUM ('NEUTRAL', 'PREFERRED', 'AVOID');
CREATE TYPE "ExerciseIntensifierPreference" AS ENUM ('DEFAULT', 'NONE', 'ONLY_SELECTED');
CREATE TYPE "CoachingInterventionStage" AS ENUM ('T2_PRE_WORKOUT', 'T3_VOLUME');
CREATE TYPE "CoachingInterventionStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'DECLINED', 'SUPERSEDED');

CREATE TABLE "exercise_coaching_profiles" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "exercise_id" UUID NOT NULL,
  "preference" "ExerciseCoachingPreference" NOT NULL DEFAULT 'NEUTRAL',
  "intensifier_preference" "ExerciseIntensifierPreference" NOT NULL DEFAULT 'DEFAULT',
  "allowed_intensifier_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notes" VARCHAR(800),
  "last_confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "exercise_coaching_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "exercise_coaching_profiles_user_id_exercise_id_key" ON "exercise_coaching_profiles"("user_id", "exercise_id");
CREATE INDEX "exercise_coaching_profiles_user_id_preference_idx" ON "exercise_coaching_profiles"("user_id", "preference");
ALTER TABLE "exercise_coaching_profiles" ADD CONSTRAINT "exercise_coaching_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exercise_coaching_profiles" ADD CONSTRAINT "exercise_coaching_profiles_exercise_id_fkey"
  FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "coaching_interventions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "program_id" UUID NOT NULL,
  "mesocycle_id" UUID,
  "session_id" UUID,
  "source_decision_id" UUID,
  "stage" "CoachingInterventionStage" NOT NULL,
  "status" "CoachingInterventionStatus" NOT NULL DEFAULT 'PROPOSED',
  "proposal" JSONB NOT NULL,
  "baseline" JSONB NOT NULL,
  "outcome" JSONB,
  "decided_at" TIMESTAMP(3),
  "evaluated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "coaching_interventions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "coaching_interventions_source_decision_id_key" ON "coaching_interventions"("source_decision_id");
CREATE INDEX "coaching_interventions_user_id_stage_created_at_idx" ON "coaching_interventions"("user_id", "stage", "created_at");
CREATE INDEX "coaching_interventions_user_id_status_evaluated_at_idx" ON "coaching_interventions"("user_id", "status", "evaluated_at");
CREATE INDEX "coaching_interventions_mesocycle_id_stage_idx" ON "coaching_interventions"("mesocycle_id", "stage");
ALTER TABLE "coaching_interventions" ADD CONSTRAINT "coaching_interventions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coaching_interventions" ADD CONSTRAINT "coaching_interventions_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "workout_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "coaching_interventions" ADD CONSTRAINT "coaching_interventions_source_decision_id_fkey"
  FOREIGN KEY ("source_decision_id") REFERENCES "ai_programming_decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
