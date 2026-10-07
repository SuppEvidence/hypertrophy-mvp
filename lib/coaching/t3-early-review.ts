import type { WorkoutAnalysis } from "../ai/workout-analysis-schema";

type Exposure = {
  analysis: WorkoutAnalysis | null;
  exercises: { id: string; exerciseId: string; movementGroupId: string | null }[];
};

/** History must be newest first, from recent completed sessions in this mesocycle. */
export function hasT3EarlyReviewEvidence(
  current: Exposure,
  history: Exposure[],
  hasPain: boolean,
): boolean {
  // Preserve the existing symptom and whole-session escalation routes.
  if (hasPain || current.analysis?.overallFatigueSignal === "HIGH") return true;
  if (!current.analysis) return false;

  return current.analysis.movementPatternAssessments.some((pattern) => {
    if (pattern.overallFatigueCost !== "HIGH" || pattern.confidence === "LOW") return false;
    // NEGATIVE is the historical pattern trend, not ordinary within-set fatigue.
    if (pattern.progressionSignal === "NEGATIVE") return true;

    const previousExposure = history.find((session) => session.exercises.some(
      (exercise) => exercise.movementGroupId === pattern.movementPatternId,
    ));
    const previousPattern = previousExposure?.analysis?.movementPatternAssessments.find(
      (row) => row.movementPatternId === pattern.movementPatternId,
    );
    if (pattern.implementationInterpretation === "PATTERN_WIDE_STALL" &&
        previousPattern?.implementationInterpretation === "PATTERN_WIDE_STALL" &&
        previousPattern.confidence !== "LOW") return true;

    // Require unusual decay on consecutive exposures of the SAME exercise.
    // A normal EDT drop-off or deterioration in another pattern cannot corroborate.
    return current.exercises.filter((exercise) => exercise.movementGroupId === pattern.movementPatternId)
      .some((exercise) => {
        const assessment = current.analysis!.exerciseAssessments.find(
          (row) => row.sessionExerciseId === exercise.id,
        );
        if (assessment?.performanceDecay !== "HIGHER_THAN_USUAL" || assessment.confidence === "LOW") return false;
        const previous = history.find((session) => session.exercises.some(
          (row) => row.exerciseId === exercise.exerciseId,
        ));
        const previousExercise = previous?.exercises.find((row) => row.exerciseId === exercise.exerciseId);
        const previousAssessment = previous?.analysis?.exerciseAssessments.find(
          (row) => row.sessionExerciseId === previousExercise?.id,
        );
        return previousAssessment?.performanceDecay === "HIGHER_THAN_USUAL" && previousAssessment.confidence !== "LOW";
      });
  });
}
