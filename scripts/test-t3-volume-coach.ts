import assert from "node:assert/strict";
import { validateT3Review, type DecisionValidationContext } from "../lib/coaching/t3-review-validation";
import { previewT3Prescription, assertT3WeeklyBudget, type T3PrescriptionInput } from "../lib/coaching/t3-prescription-preview";
import type { ProgrammingRecommendations, ProgrammingOption } from "../lib/ai/programming-decision-schema";
import {
  initialT3Range,
  nextT3CoachTarget,
  shouldRunT3Evaluation,
  suggestedT3Priority,
} from "../lib/coaching/t3-volume-policy";
import {
  MesocycleRecommendationSchema,
} from "../lib/ai/mesocycle-recommendation-schema";

assert.equal(suggestedT3Priority({ programPriority: true, baselineWeeklySets: 4 }), "SPECIALIZE");
assert.equal(suggestedT3Priority({ programPriority: false, baselineWeeklySets: 6 }), "GROW");
assert.equal(suggestedT3Priority({ programPriority: false, baselineWeeklySets: 0 }), "INDIRECT_ONLY");
assert.deepEqual(initialT3Range("MAINTAIN", 4), { minimum: 4, maximum: 4 });

const now = new Date("2026-09-23T12:00:00Z");
const activatedAt = new Date("2026-09-10T12:00:00Z");
const due = (lastEvaluatedAt: Date | null, adverseSignal: boolean, hasNewEvidence = true) =>
  shouldRunT3Evaluation({
    activatedAt,
    lastEvaluatedAt,
    completedWorkoutsSinceActivation: 2,
    hasNewEvidence,
    adverseSignal,
    now,
  });

assert.equal(due(null, false), true);
assert.equal(due(new Date("2026-09-19T12:00:00Z"), false), false);
assert.equal(due(new Date("2026-09-15T12:00:00Z"), false), true);
assert.equal(due(new Date("2026-09-20T12:00:00Z"), true), true);
assert.equal(due(new Date("2026-09-22T12:00:00Z"), true), false);
assert.equal(due(null, true, false), false);
assert.equal(shouldRunT3Evaluation({ activatedAt, lastEvaluatedAt: null, completedWorkoutsSinceActivation: 0, hasNewEvidence: true, adverseSignal: false, now }), false);

assert.equal(nextT3CoachTarget({ current: 8, delta: 2, minimum: 6, maximum: 10, priority: "GROW" }), 10);
assert.equal(nextT3CoachTarget({ current: 13, delta: -2, minimum: 6, maximum: 10, priority: "GROW" }), 11);
assert.equal(nextT3CoachTarget({ current: 0, delta: 0, minimum: 0, maximum: 0, priority: "INDIRECT_ONLY" }), 0);
assert.throws(() => nextT3CoachTarget({ current: 8, delta: 3, minimum: 6, maximum: 12, priority: "GROW" }));
assert.throws(() => nextT3CoachTarget({ current: 8, delta: 1, minimum: 6, maximum: 12, priority: "INDIRECT_ONLY" }));
assert.equal(nextT3CoachTarget({ current: 8, delta: 2, minimum: 5, maximum: 9, priority: "GROW" }), 10,
  "An estimated useful range is evidence, not a hard prescription cap");

const review = MesocycleRecommendationSchema.safeParse({
  summary: "Keep the next block conservative.",
  confidence: "MODERATE",
  historyMode: "FIRST_MESOCYCLE",
  currentBlockAssessment: "Productive but still a short history.",
  bodyMetricInterpretation: "Bodyweight and waist declined together.",
  nextPriorities: [{
    muscleName: "Chest", action: "KEEP", currentPriority: "GROW",
    suggestedPriority: "GROW", rationale: "Response is adequate.",
  }],
  movementRecommendations: [], symptomPrecautions: [],
  templateImplications: [], cautionNotes: [],
});
assert.equal(review.success, true);
const legacyField = MesocycleRecommendationSchema.safeParse({
  ...review.data,
  volumeRecommendations: [],
});
assert.equal(legacyField.success, true);
assert.equal(Object.hasOwn(legacyField.data ?? {}, "volumeRecommendations"), false);

console.log("T3 priority volume policy and next-block schema tests passed.");

const option: ProgrammingOption = { optionKey: "OPTION_A", title: "One additional set", action: "INCREASE_VOLUME", deltaWeeklySets: 1,
  movementChanges: [{ movementPatternId: "press", movementPatternName: "Press", deltaSets: 1 }], preferredExerciseType: "EITHER",
  placementPreference: "KEEP_CURRENT", rationale: "Supported test", expectedBenefit: "More stimulus", mainRisk: "More fatigue" };
const assessment: ProgrammingRecommendations["assessments"][number] = { muscleId: "chest", muscleName: "Chest", priority: "GROW", status: "BELOW_EXPECTED_RESPONSE", confidence: "MODERATE",
  recommendedRangeMinimum: 0, recommendedRangeMaximum: 18, rationale: "A revised estimate", evidence: ["Repeated response"] };
const context: DecisionValidationContext = { validMuscleIds: new Set(["chest"]), canonicalMuscleNames: new Map([["chest", "Chest"]]),
  targetByMuscle: new Map([["chest", { target: 3, minimum: 2, maximum: 5, priority: "GROW" }]]), currentMovementSets: new Map([["press", 3]]),
  validPatternsByMuscle: new Map([["chest", new Map([["press", { movementPatternId: "press", movementPatternName: "Press", primaryExerciseCount: 1, secondaryExerciseCount: 0, availableExerciseTypes: ["ISOLATION"], exampleExercises: ["Fly"] }]])]]) };
const response: ProgrammingRecommendations = { globalSummary: "Review", bodyCompositionContext: "Stable", assessments: [assessment],
  decisions: [{ targetMuscleId: "chest", targetMuscleName: "Chest", confidence: "MODERATE", decisionSummary: "Try a small change", evidence: ["Repeated response"],
    recommendedOptionKey: "OPTION_A", options: [option], keepAsIsRationale: "Keep if preferred" }] };
assert.equal(validateT3Review(response, context).parsed.assessments[0].recommendedRangeMaximum, 18, "Range revisions are independent of dose-step limits");
assert.equal(validateT3Review(response, context).parsed.decisions.length, 1);
const badOption = structuredClone(response);
badOption.decisions[0].options[0].movementChanges[0].movementPatternId = "unknown";
const recovered = validateT3Review(badOption, context);
assert.equal(recovered.parsed.assessments.length, 1);
assert.equal(recovered.parsed.decisions.length, 0);
assert.ok(recovered.notes.length);
const low = structuredClone(response); low.assessments[0].confidence = "LOW";
assert.equal(validateT3Review(low, context).parsed.decisions.length, 0);
const removal = structuredClone(response);
removal.decisions[0].options[0] = { ...option, action: "DECREASE_VOLUME", deltaWeeklySets: -2, movementChanges: [{ movementPatternId: "press", movementPatternName: "Press", deltaSets: -4 }] };
assert.equal(validateT3Review(removal, context).parsed.decisions.length, 0, "Cannot remove more work than is prescribed");
assert.equal(nextT3CoachTarget({ current: 20, delta: 4, minimum: 10, maximum: 30, priority: "GROW", confidence: "HIGH" }), 24);
assert.equal(nextT3CoachTarget({ current: 20, delta: -5, minimum: 10, maximum: 30, priority: "GROW", confidence: "MODERATE", status: "RECOVERABILITY_CONCERN" }), 15);
assert.throws(() => nextT3CoachTarget({ current: NaN, delta: 1, minimum: 0, maximum: 30, priority: "GROW" }));

const fixture: T3PrescriptionInput = {
  program: { secondaryContribution: 0.5, volumeWindowDays: 7, volumeTargets: [{ muscleId: "chest", muscleName: "Chest", sortOrder: 0, weeklyTargetSets: 3 }] },
  mesocycle: { id: "block", volumeTargets: [{ muscleId: "chest", muscleName: "Chest", sortOrder: 0, targetSets: 3, explicitTarget: true }], repPolicies: [] },
  templateExercises: [{ id: "slot", templateId: "template", templateName: "A", templateSequenceIndex: 0, expectedOccurrences: 1,
    exerciseId: "fly", exerciseName: "Fly", movementGroupId: "press", movementGroupName: "Press", movementGroupSortOrder: 0,
    sortOrder: 0, plannedSets: 3, minSets: 1, maxSets: 5, autoAdjustable: true, defaultSetTypeId: "straight", defaultSetTypeMultiplier: 1,
    slotPriority: "STANDARD", slotRole: "ISOLATION", repBucket: "ISOLATION", setPlans: [],
    primaryMuscles: [{ muscleId: "chest", muscleName: "Chest", sortOrder: 0 }], secondaryMuscles: [] }],
  setTypes: [{ id: "straight", name: "Straight", multiplier: 1, isIntensifier: false }],
};
const preview = previewT3Prescription(fixture, "chest", option, "MODERATE", "BELOW_EXPECTED_RESPONSE");
assert.equal(preview.slots[0].before, 3); assert.equal(preview.slots[0].after, 4);
assert.equal(preview.muscles[0].after, 4);
const blocked = structuredClone(fixture); blocked.templateExercises[0].autoAdjustable = false;
assert.throws(() => previewT3Prescription(blocked, "chest", option, "MODERATE", "BELOW_EXPECTED_RESPONSE"), /cannot be implemented/);
assert.doesNotThrow(() => assertT3WeeklyBudget(preview, [preview, preview, preview]));
assert.throws(() => assertT3WeeklyBudget(preview, [preview, preview, preview, preview]), /seven days/);
console.log("T3 range, option recovery, adaptive limits, prescription preview and rolling budget regressions passed.");
