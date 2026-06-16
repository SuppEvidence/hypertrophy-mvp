CREATE TYPE "ProgramType" AS ENUM ('FULL_BODY_EOD', 'UPPER_LOWER', 'PPL', 'BRO_SPLIT', 'TORSO_LIMBS', 'CUSTOM');
CREATE TYPE "RotationStyle" AS ENUM ('FIXED_SEQUENCE', 'WEEKDAY_BASED', 'MANUAL');
CREATE TYPE "VolumeWindowType" AS ENUM ('WEEKLY', 'ROLLING_10D', 'ROLLING_14D', 'CUSTOM');
CREATE TYPE "ProgramPhase" AS ENUM ('PUSH', 'HOLD', 'DELOAD', 'MAINTENANCE', 'OTHER');

CREATE TABLE "programs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "program_type" "ProgramType" NOT NULL,
  "template_count" INTEGER NOT NULL DEFAULT 3,
  "rotation_style" "RotationStyle" NOT NULL,
  "volume_window_type" "VolumeWindowType" NOT NULL,
  "custom_window_days" INTEGER,
  "secondary_contribution" DECIMAL(4,2) NOT NULL DEFAULT 0.5,
  "active_phase" "ProgramPhase" NOT NULL DEFAULT 'PUSH',
  "advanced_muscle_mode" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "is_archived" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "program_priority_muscles" (
  "program_id" UUID NOT NULL,
  "muscle_id" UUID NOT NULL,
  CONSTRAINT "program_priority_muscles_pkey" PRIMARY KEY ("program_id", "muscle_id")
);

CREATE TABLE "muscle_volume_targets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "program_id" UUID NOT NULL,
  "muscle_id" UUID NOT NULL,
  "weekly_target_sets" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "minimum_sets" DECIMAL(5,2),
  "maximum_sets" DECIMAL(5,2),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "muscle_volume_targets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "programs_user_id_is_active_idx" ON "programs"("user_id", "is_active");
CREATE INDEX "programs_user_id_is_archived_idx" ON "programs"("user_id", "is_archived");
CREATE INDEX "muscle_volume_targets_muscle_id_idx" ON "muscle_volume_targets"("muscle_id");
CREATE UNIQUE INDEX "muscle_volume_targets_program_id_muscle_id_key" ON "muscle_volume_targets"("program_id", "muscle_id");

ALTER TABLE "programs" ADD CONSTRAINT "programs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "program_priority_muscles" ADD CONSTRAINT "program_priority_muscles_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "program_priority_muscles" ADD CONSTRAINT "program_priority_muscles_muscle_id_fkey" FOREIGN KEY ("muscle_id") REFERENCES "muscles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "muscle_volume_targets" ADD CONSTRAINT "muscle_volume_targets_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "muscle_volume_targets" ADD CONSTRAINT "muscle_volume_targets_muscle_id_fkey" FOREIGN KEY ("muscle_id") REFERENCES "muscles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
