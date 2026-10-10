import assert from "node:assert/strict";
import { PhaseRecommendationSchema } from "../lib/ai/phase-recommendation-schema";
import { validatePhaseRecommendation } from "../lib/coaching/phase-recommendation";
import { ProgrammingRecommendationsSchema } from "../lib/ai/programming-decision-schema";
const advice = PhaseRecommendationSchema.parse({ sourcePhaseStartDate: "2026-08-19", suggestedPhase: "MAINTAINING", confidence: "MODERATE",
  recommendation: "Consider a period at maintenance; the persistent decline may be related to the deficit.",
  evidence: ["Repeated comparable pressing exposures declined.", "Repeated comparable leg exposures declined while weight fell."],
  affectedMovementPatternIds: ["press", "squat"], reassessWhen: "Compare subsequent matched exposures and recovery after changing phase." });
const phase = { phase: "CUTTING", startDate: "2026-08-19" };
assert.equal(validatePhaseRecommendation(null, phase, ["press", "squat"]), null);
assert.deepEqual(validatePhaseRecommendation(advice, phase, ["press", "squat"]), advice);
assert.equal(validatePhaseRecommendation(advice, null, ["press", "squat"]), null);
assert.equal(validatePhaseRecommendation(advice, { ...phase, phase: "MAINTAINING" }, ["press", "squat"]), null);
assert.equal(validatePhaseRecommendation(advice, { ...phase, startDate: "2026-10-01" }, ["press", "squat"]), null);
assert.equal(validatePhaseRecommendation({ ...advice, affectedMovementPatternIds: ["press", "press"] }, phase, ["press"]), null);
assert.equal(validatePhaseRecommendation(advice, phase, ["press"]), null);
assert.equal(PhaseRecommendationSchema.safeParse({ ...advice, confidence: "LOW" }).success, false);
assert.equal(ProgrammingRecommendationsSchema.shape.phaseRecommendation.safeParse(undefined).success, true);
assert.equal(ProgrammingRecommendationsSchema.shape.phaseRecommendation.safeParse(null).success, true);
console.log("Phase advice tests passed: advisory validation, legacy compatibility, no-op, changed-phase invalidation and communication policy.");
