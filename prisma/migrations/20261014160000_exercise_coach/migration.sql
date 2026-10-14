ALTER TABLE "exercise_coaching_profiles"
  ADD COLUMN "mechanics_profile" JSONB,
  ADD COLUMN "mechanics_draft" JSONB,
  ADD COLUMN "mechanics_revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "execution_setup" VARCHAR(1600);
