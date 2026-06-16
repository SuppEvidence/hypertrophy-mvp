-- Slice 1 foundation: auth profile mirror, seed catalogs, and exercise classification.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TYPE "PreferredUnit" AS ENUM ('KG', 'LB');

CREATE TABLE "profiles" (
  "id" UUID NOT NULL,
  "email" TEXT UNIQUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "preferred_unit" "PreferredUnit" NOT NULL DEFAULT 'KG',
  "default_secondary_contribution" DECIMAL(4,2) NOT NULL DEFAULT 0.5,
  "advanced_muscle_mode" BOOLEAN NOT NULL DEFAULT false,
  "metric_visibility" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "muscles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "muscles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "movement_groups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "movement_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "set_types" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "multiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.0,
  "is_intensifier" BOOLEAN NOT NULL DEFAULT false,
  "is_editable" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "set_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exercises" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "catalog_key" TEXT NOT NULL,
  "movement_group_id" UUID NOT NULL,
  "default_min_reps" INTEGER,
  "default_max_reps" INTEGER,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "is_seed" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_archived" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exercise_primary_muscles" (
  "exercise_id" UUID NOT NULL,
  "muscle_id" UUID NOT NULL,
  CONSTRAINT "exercise_primary_muscles_pkey" PRIMARY KEY ("exercise_id", "muscle_id")
);

CREATE TABLE "exercise_secondary_muscles" (
  "exercise_id" UUID NOT NULL,
  "muscle_id" UUID NOT NULL,
  CONSTRAINT "exercise_secondary_muscles_pkey" PRIMARY KEY ("exercise_id", "muscle_id")
);

CREATE UNIQUE INDEX "user_settings_user_id_key" ON "user_settings"("user_id");
CREATE UNIQUE INDEX "muscles_name_key" ON "muscles"("name");
CREATE UNIQUE INDEX "muscles_slug_key" ON "muscles"("slug");
CREATE UNIQUE INDEX "movement_groups_name_key" ON "movement_groups"("name");
CREATE UNIQUE INDEX "movement_groups_slug_key" ON "movement_groups"("slug");
CREATE UNIQUE INDEX "set_types_name_key" ON "set_types"("name");
CREATE UNIQUE INDEX "set_types_slug_key" ON "set_types"("slug");
CREATE UNIQUE INDEX "exercises_catalog_key_key" ON "exercises"("catalog_key");
CREATE INDEX "exercises_user_id_slug_idx" ON "exercises"("user_id", "slug");
CREATE INDEX "exercises_name_idx" ON "exercises"("name");
CREATE INDEX "exercises_movement_group_id_idx" ON "exercises"("movement_group_id");

ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_movement_group_id_fkey" FOREIGN KEY ("movement_group_id") REFERENCES "movement_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exercise_primary_muscles" ADD CONSTRAINT "exercise_primary_muscles_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exercise_primary_muscles" ADD CONSTRAINT "exercise_primary_muscles_muscle_id_fkey" FOREIGN KEY ("muscle_id") REFERENCES "muscles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exercise_secondary_muscles" ADD CONSTRAINT "exercise_secondary_muscles_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exercise_secondary_muscles" ADD CONSTRAINT "exercise_secondary_muscles_muscle_id_fkey" FOREIGN KEY ("muscle_id") REFERENCES "muscles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
