import type { PhaseRecommendation } from "../ai/phase-recommendation-schema";

/** Reject invalid context/IDs without blocking the otherwise valid training review. */
export function validatePhaseRecommendation(
  recommendation: PhaseRecommendation | null | undefined,
  phase: { phase: string; startDate: string } | null,
  observedPatternIds: Iterable<string>,
): (PhaseRecommendation & { sourcePhase: "CUTTING" | "GAINING" }) | null {
  if (!recommendation || !phase || phase.phase !== (recommendation.sourcePhase ?? "CUTTING") || recommendation.sourcePhaseStartDate !== phase.startDate) return null;
  const known = new Set(observedPatternIds);
  const ids = [...new Set(recommendation.affectedMovementPatternIds)];
  if (ids.length < 2 || ids.some((id) => !known.has(id))) return null;
  return { ...recommendation, sourcePhase: recommendation.sourcePhase ?? "CUTTING", affectedMovementPatternIds: ids };
}
