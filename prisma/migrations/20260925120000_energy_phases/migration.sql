CREATE TYPE "EnergyPhaseType" AS ENUM ('CUTTING', 'MAINTAINING', 'GAINING');

CREATE TABLE "energy_phases" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "phase" "EnergyPhaseType" NOT NULL,
  "start_date" DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "energy_phases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "energy_phases_user_id_start_date_key" ON "energy_phases"("user_id", "start_date");
CREATE INDEX "energy_phases_user_id_start_date_idx" ON "energy_phases"("user_id", "start_date");
ALTER TABLE "energy_phases" ADD CONSTRAINT "energy_phases_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
