ALTER TABLE "program_mesocycles"
ADD COLUMN "actual_end_date" DATE;

CREATE INDEX "program_mesocycles_program_id_actual_end_date_start_date_idx"
ON "program_mesocycles"("program_id", "actual_end_date", "start_date");
