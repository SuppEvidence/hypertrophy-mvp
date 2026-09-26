ALTER TABLE "exercise_secondary_muscles"
  ADD COLUMN "contribution_estimate" DECIMAL(3,2),
  ADD COLUMN "assessment_rationale" TEXT,
  ADD COLUMN "assessed_at" TIMESTAMP(3),
  ADD COLUMN "assessment_model" TEXT,
  ADD COLUMN "assessment_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "exercise_secondary_muscles"
  ADD CONSTRAINT "exercise_secondary_muscles_contribution_estimate_check"
  CHECK ("contribution_estimate" IS NULL OR ("contribution_estimate" >= 0 AND "contribution_estimate" <= 1));
CREATE TABLE "exercise_secondary_contribution_reviews" (
  "id" UUID NOT NULL,
  "exercise_id" UUID NOT NULL,
  "muscle_id" UUID NOT NULL,
  "mesocycle_id" UUID NOT NULL,
  "previous_estimate" DECIMAL(3,2) NOT NULL,
  "new_estimate" DECIMAL(3,2) NOT NULL,
  "rationale" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "model" TEXT NOT NULL,
  "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exercise_secondary_contribution_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exercise_secondary_contribution_reviews_exercise_id_muscle_id_fkey"
    FOREIGN KEY ("exercise_id", "muscle_id") REFERENCES "exercise_secondary_muscles"("exercise_id", "muscle_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "exercise_secondary_contribution_reviews_exercise_id_muscle_id_mesocycle_id_key"
  ON "exercise_secondary_contribution_reviews"("exercise_id", "muscle_id", "mesocycle_id");
