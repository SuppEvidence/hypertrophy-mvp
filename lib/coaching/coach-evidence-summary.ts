import type { WorkoutAnalysis } from "@/lib/ai/workout-analysis-schema";
import { T3MuscleAssessmentSchema } from "@/lib/ai/programming-decision-schema";

/** One compact projection for downstream reasoning; stored analyses retain their full detail. */
export function summarizeCoachAnalysis(analysis: WorkoutAnalysis, movementIds?: Set<string>, includeExercises = true) {
  return {
    overallFatigueSignal: analysis.overallFatigueSignal,
    confidence: analysis.confidence,
    movementPatterns: analysis.movementPatternAssessments.filter((row) => !movementIds || movementIds.has(row.movementPatternId)).map((row) => ({
      movementPatternId: row.movementPatternId, movementPatternName: row.movementPatternName, stimulus: row.overallStimulus, fatigueCost: row.overallFatigueCost,
      progressionSignal: row.progressionSignal, implementationInterpretation: row.implementationInterpretation,
      exerciseConsistency: row.exerciseConsistency, confidence: row.confidence,
      notableSignals: row.notableSignals.slice(0, 2).map((text) => text.slice(0, 160)),
    })),
    ...(includeExercises ? { exercises: analysis.exerciseAssessments.map((row) => ({
      exerciseName: row.exerciseName, stimulus: row.overallStimulus, fatigueCost: row.overallFatigueCost,
      performanceDecay: row.performanceDecay, confidence: row.confidence,
      notableSignals: row.notableSignals.slice(0, 2).map((text) => text.slice(0, 160)),
    })) } : {}),
  };
}

/** Reuse conclusions only when they cover the newest evidence and remain recent. */
export function freshT3Assessment(value: unknown, evaluatedAt: Date | null, latestEvidenceAt: Date, now = new Date()) {
  if (!evaluatedAt || now.getTime() - evaluatedAt.getTime() > 7 * 86400000 ||
    evaluatedAt > now || evaluatedAt < latestEvidenceAt || !value || typeof value !== "object" || Array.isArray(value)) return null;
  const rows = T3MuscleAssessmentSchema.array().safeParse((value as Record<string, unknown>).assessments);
  if (!rows.success || !rows.data.length) return null;
  return { evaluatedAt: evaluatedAt.toISOString(), assessments: rows.data.map((row) => ({
    muscleId: row.muscleId, priority: row.priority, status: row.status, confidence: row.confidence,
    observedUsefulRange: [row.recommendedRangeMinimum, row.recommendedRangeMaximum], rationale: row.rationale.slice(0, 240),
  })) };
}
