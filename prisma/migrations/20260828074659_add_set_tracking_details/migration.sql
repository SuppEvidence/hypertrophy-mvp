-- AlterTable
ALTER TABLE "workout_sets" ADD COLUMN     "ended_at" TIMESTAMP(3),
ADD COLUMN     "intensifier_details" JSONB,
ADD COLUMN     "started_at" TIMESTAMP(3);
