-- AlterTable
ALTER TABLE "workout_sessions" ADD COLUMN     "ai_analysis" JSONB,
ADD COLUMN     "ai_analysis_model" TEXT,
ADD COLUMN     "ai_analyzed_at" TIMESTAMP(3);
