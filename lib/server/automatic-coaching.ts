import { analyzeCompletedWorkoutForUser } from "@/lib/server/ai-workout-analysis";
import { runT3VolumeEvaluationForUser } from "@/lib/server/ai-programming-decisions";

export async function runAutomaticPostWorkoutCoaching(
  sessionId: string,
  userId: string,
) {
  if (process.env.AUTO_WORKOUT_ANALYSIS_ENABLED !== "false") {
    try {
      await analyzeCompletedWorkoutForUser(sessionId, userId);
    } catch (error) {
      console.error("Automatic workout analysis failed", error);
    }
  }

  try {
    await runT3VolumeEvaluationForUser(userId);
  } catch (error) {
    console.error("Automatic T3 volume evaluation failed", error);
  }

  if (process.env.AUTO_MESOCYCLE_REVIEW_ENABLED !== "false") {
    try {
      const { maybeGenerateMesocycleRecommendationForUser } = await import(
        "@/lib/server/ai-mesocycle-recommendations"
      );
      await maybeGenerateMesocycleRecommendationForUser(userId);
    } catch (error) {
      console.error("Automatic final-week mesocycle review failed", error);
    }
  }
}
