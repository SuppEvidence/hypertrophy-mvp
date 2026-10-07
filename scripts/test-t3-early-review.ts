import assert from "node:assert/strict";
import type { WorkoutAnalysis } from "../lib/ai/workout-analysis-schema";
import { hasT3EarlyReviewEvidence } from "../lib/coaching/t3-early-review";
import { shouldRunT3Evaluation } from "../lib/coaching/t3-volume-policy";

const pattern: WorkoutAnalysis["movementPatternAssessments"][number] = {
  movementPatternId: "lateral", movementPatternName: "Lateral raise",
  overallStimulus: "HIGH", overallFatigueCost: "HIGH", progressionSignal: "POSITIVE",
  exerciseConsistency: "CONSISTENT", implementationInterpretation: "PATTERN_PRODUCTIVE",
  confidence: "HIGH", notableSignals: [], rationale: "Productive EDT fatigue",
};
const analysis: WorkoutAnalysis = {
  workoutSummary: "Productive pain-free session", overallFatigueSignal: "MODERATE", confidence: "HIGH",
  movementPatternAssessments: [pattern], exerciseAssessments: [{
    sessionExerciseId: "slot", exerciseName: "Cable lateral", overallStimulus: "HIGH",
    overallFatigueCost: "HIGH", performanceDecay: "NORMAL_FOR_EXERCISE", confidence: "HIGH",
    notableSignals: [], rationale: "", sets: [],
  }],
};
const make = () => ({ analysis: structuredClone(analysis), exercises: [{ id: "slot", exerciseId: "cable", movementGroupId: "lateral" }] });
const current = make();
assert.equal(hasT3EarlyReviewEvidence(current, [], false), false, "Productive EDT fatigue alone stays on weekly cadence");
current.analysis.movementPatternAssessments.push({ ...pattern, movementPatternId: "press", overallFatigueCost: "LOW", progressionSignal: "NEGATIVE" });
assert.equal(hasT3EarlyReviewEvidence(current, [], false), false, "Unrelated deterioration cannot corroborate lateral fatigue");
current.analysis.movementPatternAssessments[0].progressionSignal = "NEGATIVE";
assert.equal(hasT3EarlyReviewEvidence(current, [], false), true);
current.analysis.movementPatternAssessments[0].confidence = "LOW";
assert.equal(hasT3EarlyReviewEvidence(current, [], false), false);
const stalled = make();
stalled.analysis.movementPatternAssessments[0].implementationInterpretation = "PATTERN_WIDE_STALL";
assert.equal(hasT3EarlyReviewEvidence(stalled, [], false), false, "Single stall is insufficient");
assert.equal(hasT3EarlyReviewEvidence(stalled, [structuredClone(stalled)], false), true);
assert.equal(hasT3EarlyReviewEvidence(stalled, [make(), structuredClone(stalled)], false), false, "Do not skip a recovered exposure");
const decayed = make();
decayed.analysis.exerciseAssessments[0].performanceDecay = "HIGHER_THAN_USUAL";
assert.equal(hasT3EarlyReviewEvidence(decayed, [], false), false, "One-session decay is insufficient");
const previous = structuredClone(decayed);
previous.exercises[0].id = "old-slot";
previous.analysis.exerciseAssessments[0].sessionExerciseId = "old-slot";
assert.equal(hasT3EarlyReviewEvidence(decayed, [previous], false), true, "Match exercise across different session-slot IDs");
previous.exercises[0].exerciseId = "dumbbell";
assert.equal(hasT3EarlyReviewEvidence(decayed, [previous], false), false, "Different exercise is not comparable decay evidence");
assert.equal(hasT3EarlyReviewEvidence(decayed, [{ ...make(), analysis: null }, structuredClone(decayed)], false), false, "Missing latest evidence must not revive older deterioration");
assert.equal(hasT3EarlyReviewEvidence({ analysis: null, exercises: [] }, [], true), true);
const systemic = make(); systemic.analysis.overallFatigueSignal = "HIGH";
assert.equal(hasT3EarlyReviewEvidence(systemic, [], false), true);
const now = new Date("2026-10-07T12:00:00Z");
const due = (hours: number, adverseSignal: boolean, hasNewEvidence = true) => shouldRunT3Evaluation({
  now, activatedAt: new Date("2026-09-01"), lastEvaluatedAt: new Date(+now - hours * 3600000),
  completedWorkoutsSinceActivation: 2, hasNewEvidence, adverseSignal,
});
assert.equal(due(72, hasT3EarlyReviewEvidence(make(), [], false)), false);
assert.equal(due(47.99, true), false);
assert.equal(due(48, true), true);
assert.equal(due(168, false), true);
assert.equal(due(168, true, false), false);
console.log("T3 early-review regressions passed.");
