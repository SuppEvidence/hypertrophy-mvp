CREATE TYPE "MusclePriority" AS ENUM ('SPECIALIZE', 'GROW', 'MAINTAIN', 'INDIRECT_ONLY');

ALTER TABLE "program_mesocycles"
  ADD COLUMN "t3_activated_at" TIMESTAMP(3),
  ADD COLUMN "t3_last_evaluated_at" TIMESTAMP(3),
  ADD COLUMN "t3_evaluation_status" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
  ADD COLUMN "t3_evaluation_error" TEXT,
  ADD COLUMN "t3_assessment" JSONB;

ALTER TABLE "workout_sessions"
  ADD COLUMN "ai_analysis_status" TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN "ai_analysis_error" TEXT,
  ADD COLUMN "ai_analysis_attempted_at" TIMESTAMP(3);

UPDATE "workout_sessions"
SET "ai_analysis_status" = 'COMPLETE'
WHERE "ai_analysis" IS NOT NULL;

CREATE TABLE "mesocycle_muscle_priorities" (
  "id" UUID NOT NULL,
  "mesocycle_id" UUID NOT NULL,
  "muscle_id" UUID NOT NULL,
  "priority" "MusclePriority" NOT NULL,
  "baseline_weekly_sets" DECIMAL(5,2) NOT NULL,
  "coach_target_weekly_sets" DECIMAL(5,2) NOT NULL,
  "range_minimum_sets" DECIMAL(5,2) NOT NULL,
  "range_maximum_sets" DECIMAL(5,2) NOT NULL,
  "coaching_status" TEXT NOT NULL DEFAULT 'BASELINE',
  "confidence" TEXT,
  "rationale" TEXT,
  "evidence" JSONB,
  "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_evaluated_at" TIMESTAMP(3),
  "last_adjusted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mesocycle_muscle_priorities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mesocycle_muscle_priorities_mesocycle_id_muscle_id_key"
  ON "mesocycle_muscle_priorities"("mesocycle_id", "muscle_id");
CREATE INDEX "mesocycle_muscle_priorities_muscle_id_idx"
  ON "mesocycle_muscle_priorities"("muscle_id");
CREATE INDEX "mesocycle_muscle_priorities_mesocycle_id_priority_idx"
  ON "mesocycle_muscle_priorities"("mesocycle_id", "priority");

ALTER TABLE "mesocycle_muscle_priorities"
  ADD CONSTRAINT "mesocycle_muscle_priorities_mesocycle_id_fkey"
  FOREIGN KEY ("mesocycle_id") REFERENCES "program_mesocycles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mesocycle_muscle_priorities"
  ADD CONSTRAINT "mesocycle_muscle_priorities_muscle_id_fkey"
  FOREIGN KEY ("muscle_id") REFERENCES "muscles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
