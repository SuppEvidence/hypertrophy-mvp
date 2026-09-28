CREATE TABLE "weekly_coach_plans" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "program_id" UUID NOT NULL,
  "mesocycle_id" UUID,
  "week_start" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "proposal" JSONB NOT NULL,
  "allocation" JSONB,
  "unallocated" INTEGER NOT NULL DEFAULT 0,
  "missed_ids" JSONB,
  "approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "weekly_coach_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "weekly_coach_plans_program_id_week_start_key" ON "weekly_coach_plans"("program_id", "week_start");
CREATE INDEX "weekly_coach_plans_user_id_week_start_idx" ON "weekly_coach_plans"("user_id", "week_start");
ALTER TABLE "weekly_coach_plans" ADD CONSTRAINT "weekly_coach_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "weekly_coach_plans" ADD CONSTRAINT "weekly_coach_plans_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
