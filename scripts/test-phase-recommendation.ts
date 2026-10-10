import assert from "node:assert/strict";
import { PhaseRecommendationSchema, ModelPhaseRecommendationSchema } from "../lib/ai/phase-recommendation-schema";
import { validatePhaseRecommendation } from "../lib/coaching/phase-recommendation";
import { ProgrammingRecommendationsSchema } from "../lib/ai/programming-decision-schema";
const advice = PhaseRecommendationSchema.parse({ sourcePhaseStartDate: "2026-08-19", suggestedPhase: "MAINTAINING", confidence: "MODERATE",
  recommendation: "Consider a period at maintenance; the persistent decline may be related to the deficit.",
  evidence: ["Repeated comparable pressing exposures declined.", "Repeated comparable leg exposures declined while weight fell."],
  affectedMovementPatternIds: ["press", "squat"], reassessWhen: "Compare subsequent matched exposures and recovery after changing phase." });
const phase = { phase: "CUTTING", startDate: "2026-08-19" };
assert.equal(validatePhaseRecommendation(null, phase, ["press", "squat"]), null);
assert.deepEqual(validatePhaseRecommendation(advice, phase, ["press", "squat"]), { ...advice, sourcePhase: "CUTTING" });
assert.equal(validatePhaseRecommendation(advice, null, ["press", "squat"]), null);
assert.equal(validatePhaseRecommendation(advice, { ...phase, phase: "MAINTAINING" }, ["press", "squat"]), null);
assert.equal(validatePhaseRecommendation(advice, { ...phase, startDate: "2026-10-01" }, ["press", "squat"]), null);
assert.equal(validatePhaseRecommendation({ ...advice, affectedMovementPatternIds: ["press", "press"] }, phase, ["press"]), null);
assert.equal(validatePhaseRecommendation(advice, phase, ["press"]), null);
assert.equal(PhaseRecommendationSchema.safeParse({ ...advice, confidence: "LOW" }).success, false);
assert.equal(ProgrammingRecommendationsSchema.shape.phaseRecommendation.safeParse(undefined).success, true);
assert.equal(ProgrammingRecommendationsSchema.shape.phaseRecommendation.safeParse(null).success, true);
const gainAdvice = ModelPhaseRecommendationSchema.parse({ ...advice, sourcePhase: "GAINING",
  recommendation: "Consider maintenance while reassessing the gain-phase tradeoff.",
  evidence: ["Repeated waist measurements rose while weight increased modestly.", "Comparable pressing and leg performance flattened across repeated exposures."],
});
const gaining = { ...phase, phase: "GAINING" };
assert.deepEqual(validatePhaseRecommendation(gainAdvice, gaining, ["press", "squat"]), gainAdvice);
assert.equal(validatePhaseRecommendation(gainAdvice, phase, ["press", "squat"]), null);
assert.equal(validatePhaseRecommendation(advice, gaining, ["press", "squat"]), null); // legacy cut advice must not transfer to gaining
assert.equal(validatePhaseRecommendation(gainAdvice, { ...gaining, startDate: "2026-10-01" }, ["press", "squat"]), null);
assert.equal(validatePhaseRecommendation(gainAdvice, { ...gaining, phase: "MAINTAINING" }, ["press", "squat"]), null);
assert.equal(validatePhaseRecommendation({ ...gainAdvice, affectedMovementPatternIds: ["press", "press"] }, gaining, ["press"]), null);
assert.equal(validatePhaseRecommendation(gainAdvice, gaining, ["press"]), null);
assert.equal(ModelPhaseRecommendationSchema.safeParse(advice).success, false); // generated advice must identify its source
assert.equal(ModelPhaseRecommendationSchema.safeParse({ ...gainAdvice, suggestedPhase: "CUTTING" }).success, false);
console.log("Phase advice tests passed: cutting/gaining, no-op, changed phase/date, distinct observed patterns and legacy compatibility.");
