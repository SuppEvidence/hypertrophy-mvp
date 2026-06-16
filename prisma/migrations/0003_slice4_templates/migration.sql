CREATE TABLE "workout_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "program_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "sequence_index" INTEGER NOT NULL,
  "weekday" INTEGER,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_archived" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workout_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "template_exercises" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "template_id" UUID NOT NULL,
  "exercise_id" UUID NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "planned_sets" INTEGER NOT NULL DEFAULT 2,
  "min_reps" INTEGER,
  "max_reps" INTEGER,
  "rir_target" DECIMAL(4,1),
  "default_set_type_id" UUID NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "template_exercises_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workout_templates_program_id_sequence_index_key" ON "workout_templates"("program_id", "sequence_index");
CREATE INDEX "workout_templates_user_id_is_archived_idx" ON "workout_templates"("user_id", "is_archived");
CREATE INDEX "workout_templates_program_id_is_archived_idx" ON "workout_templates"("program_id", "is_archived");
CREATE INDEX "template_exercises_template_id_sort_order_idx" ON "template_exercises"("template_id", "sort_order");
CREATE INDEX "template_exercises_exercise_id_idx" ON "template_exercises"("exercise_id");
CREATE INDEX "template_exercises_default_set_type_id_idx" ON "template_exercises"("default_set_type_id");

ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "template_exercises" ADD CONSTRAINT "template_exercises_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "workout_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "template_exercises" ADD CONSTRAINT "template_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "template_exercises" ADD CONSTRAINT "template_exercises_default_set_type_id_fkey" FOREIGN KEY ("default_set_type_id") REFERENCES "set_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
