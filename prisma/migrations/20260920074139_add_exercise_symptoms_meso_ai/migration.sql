-- AlterTable
ALTER TABLE "program_mesocycles" ADD COLUMN     "ai_recommendation" JSONB,
ADD COLUMN     "ai_recommendation_model" TEXT,
ADD COLUMN     "ai_recommended_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "workout_session_exercises" ADD COLUMN     "pain_impact" TEXT,
ADD COLUMN     "pain_location" TEXT,
ADD COLUMN     "pain_side" TEXT;
