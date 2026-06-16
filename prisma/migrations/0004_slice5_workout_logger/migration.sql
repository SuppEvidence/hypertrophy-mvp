CREATE TYPE "WorkoutSessionStatus" AS ENUM ('DRAFT', 'COMPLETED');

CREATE TABLE "workout_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "program_id" UUID NOT NULL,
  "template_id" UUID,
  "name" TEXT NOT NULL,
  "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "WorkoutSessionStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workout_session_exercises" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "session_id" UUID NOT NULL,
  "exercise_id" UUID NOT NULL,
  "template_exercise_id" UUID,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_substitution" BOOLEAN NOT NULL DEFAULT false,
  "substituted_from_exercise_id" UUID,
  "pain_flag" BOOLEAN NOT NULL DEFAULT false,
  "pain_note" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workout_session_exercises_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workout_sets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "session_exercise_id" UUID NOT NULL,
  "set_number" INTEGER NOT NULL,
  "weight" DECIMAL(7,2),
  "reps" INTEGER,
  "rir" DECIMAL(4,1),
  "set_type_id" UUID NOT NULL,
  "is_completed" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workout_sets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workout_sessions_user_id_status_performed_at_idx" ON "workout_sessions"("user_id", "status", "performed_at");
CREATE INDEX "workout_sessions_program_id_performed_at_idx" ON "workout_sessions"("program_id", "performed_at");
CREATE INDEX "workout_sessions_template_id_idx" ON "workout_sessions"("template_id");
CREATE INDEX "workout_session_exercises_session_id_sort_order_idx" ON "workout_session_exercises"("session_id", "sort_order");
CREATE INDEX "workout_session_exercises_exercise_id_idx" ON "workout_session_exercises"("exercise_id");
CREATE INDEX "workout_session_exercises_template_exercise_id_idx" ON "workout_session_exercises"("template_exercise_id");
CREATE UNIQUE INDEX "workout_sets_session_exercise_id_set_number_key" ON "workout_sets"("session_exercise_id", "set_number");
CREATE INDEX "workout_sets_set_type_id_idx" ON "workout_sets"("set_type_id");

ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "workout_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workout_session_exercises" ADD CONSTRAINT "workout_session_exercises_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_session_exercises" ADD CONSTRAINT "workout_session_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workout_session_exercises" ADD CONSTRAINT "workout_session_exercises_substituted_from_exercise_id_fkey" FOREIGN KEY ("substituted_from_exercise_id") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workout_session_exercises" ADD CONSTRAINT "workout_session_exercises_template_exercise_id_fkey" FOREIGN KEY ("template_exercise_id") REFERENCES "template_exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_session_exercise_id_fkey" FOREIGN KEY ("session_exercise_id") REFERENCES "workout_session_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_set_type_id_fkey" FOREIGN KEY ("set_type_id") REFERENCES "set_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
