import assert from "node:assert/strict";
import { auditWeeklyPriorities, readMaintenanceBases } from "../lib/coaching/priority-dose-policy";
import { approvedWeekDose } from "../lib/coaching/weekly-coach-dose";
import { carryForwardWeek, preserveWeeklyExerciseChoices } from "../lib/coaching/weekly-coach-continuity";
import { WeeklyCoachPlanSchema, type WeeklyCoachPlan } from "../lib/coaching/weekly-coach-policy";
import { assertT3PriorityEffects, validateT3Review, type DecisionValidationContext } from "../lib/coaching/t3-review-validation";
import type { ProgrammingRecommendations } from "../lib/ai/programming-decision-schema";

const id = (n: number) => `${String(n).padStart(8, "0")}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;
const regular = id(1), intensified = id(2), press = id(3), alternative = id(4), curl = id(5), template = id(6);
const exercises = [
  { id: press, name: "Established press", movementGroupId: "press", primaryMuscleIds: ["upper"], secondaryMuscles: [{ muscleId: "mid", fraction: .5 }], avoided: false },
  { id: alternative, name: "New press", movementGroupId: "press", primaryMuscleIds: ["upper"], secondaryMuscles: [{ muscleId: "mid", fraction: .5 }], avoided: false },
  { id: curl, name: "Curl", movementGroupId: "curl", primaryMuscleIds: ["arms"], secondaryMuscles: [], avoided: false },
];
const item = (exerciseId: string, sourceSlotId: string, sets: number) => ({ exerciseId, sourceSlotId, sets, setTypeIds: Array(sets).fill(regular), reason: "Established work" });
const previous: WeeklyCoachPlan = { version: "W1", weekStart: "2026-10-05", summary: "Approved", workouts: [
  { id: id(7), date: "2026-10-05", templateId: template, durationMinutes: 60, rationale: "Established", items: [item(press, "press-slot", 3), item(curl, "curl-slot", 3)] },
] };
const candidates = previous.workouts[0].items.map((row) => ({ ...row, id: row.sourceSlotId, templateId: template,
  movementGroupId: exercises.find((exercise) => exercise.id === row.exerciseId)!.movementGroupId,
  primaryMuscleIds: exercises.find((exercise) => exercise.id === row.exerciseId)!.primaryMuscleIds, secondaryMuscles: [] }));
const input = { previous, weekStart: "2026-10-12", availability: [{ id: id(8), date: "2026-10-12", minutes: 60 }],
  templates: [template], candidates, exercises, regularSetTypeIds: [regular], actual: [], missedIds: [],
  priorities: { upper: "SPECIALIZE", arms: "MAINTAIN" } };
const carried = carryForwardWeek(input)!;
assert.ok(carried, "An approved structure can be reused without completed occurrences");
assert.equal(carried.workouts[0].items[0].exerciseId, press);
assert.equal(previous.workouts[0].items[0].sets, 3, "Carry forward must not mutate the source");
const proposed = structuredClone(carried);
proposed.workouts[0].items[0] = { ...proposed.workouts[0].items[0], exerciseId: alternative, setTypeIds: [regular, intensified, intensified] };
const retained = preserveWeeklyExerciseChoices(carried, proposed, exercises);
assert.equal(retained.plan.workouts[0].items[0].exerciseId, press, "No weekly novelty without a reason");
assert.deepEqual(retained.plan.workouts[0].items[0].setTypeIds, [regular, intensified, intensified], "Dose edits survive choice preservation");
assert.equal(retained.restored.length, 1);
proposed.exerciseChanges = [{ date: "2026-10-12", sourceSlotId: "press-slot", fromExerciseId: press, toExerciseId: alternative,
  basis: "PAIN_OR_TOLERANCE", reason: "Repeated shoulder irritation with the established press." }];
assert.equal(preserveWeeklyExerciseChoices(carried, proposed, exercises).plan.workouts[0].items[0].exerciseId, alternative);
proposed.exerciseChanges[0].date = "2026-10-13";
assert.equal(preserveWeeklyExerciseChoices(carried, proposed, exercises).plan.workouts[0].items[0].exerciseId, press, "Reasons apply only to the exact replacement");
const unavailable = exercises.map((row) => row.id === press ? { ...row, avoided: true } : row);
assert.equal(preserveWeeklyExerciseChoices(carried, proposed, unavailable).plan.workouts[0].items[0].exerciseId, alternative, "Do not restore an avoided exercise");
const virtualSwap = structuredClone(proposed); virtualSwap.workouts[0].items[0].sourceSlotId = `exercise:${alternative}`;
assert.equal(preserveWeeklyExerciseChoices(carried, virtualSwap, exercises).plan.workouts[0].items[0].exerciseId, press, "A virtual slot cannot bypass continuity");
const typedDose = approvedWeekDose({ plan: retained.plan, missedIds: [], startedIds: [], completedOccurrenceIds: [], completed: [],
  exercises, multipliers: { [regular]: 1, [intensified]: 1.5 } });
assert.equal(typedDose.notCompleted.muscleDose.upper, 4);
assert.equal(typedDose.notCompleted.primaryMuscleDose.upper, 4);
assert.equal(typedDose.notCompleted.secondaryMuscleDose.mid, 2);

// Carry-forward must not underdose based on a generic minutes-per-physical-set guess.
const dense = structuredClone(previous); dense.workouts[0].items = [item(curl, "curl-slot", 8), item(press, "press-slot", 8)];
const trimmed = carryForwardWeek({ ...input, previous: dense, availability: [{ id: id(8), date: "2026-10-12", minutes: 20 }] })!;
assert.equal(trimmed.workouts[0].items.find((row) => row.exerciseId === press)?.sets, 8);
assert.equal(trimmed.workouts[0].items.find((row) => row.exerciseId === curl)?.sets, 8);

const checks = auditWeeklyPriorities([
  { id: "lats", name: "Lats", priority: "GROW", target: 20.5, weekly: 16.5, directRemaining: 16.5, secondaryRemaining: 0 },
  { id: "mid", name: "Mid chest", priority: "MAINTAIN", target: 4, weekly: 8, directRemaining: 4, secondaryRemaining: 4 },
  { id: "erectors", name: "Erectors", priority: "INDIRECT_ONLY", target: 2, weekly: 0, directRemaining: 0, secondaryRemaining: 0 },
]);
assert.ok(checks.some((row) => row.code === "UNEXPLAINED_PRIORITY_SHORTFALL"));
assert.ok(checks.some((row) => row.code === "MAINTENANCE_SURPLUS_WITH_PRIORITY_GAP"));
assert.ok(checks.some((row) => row.code === "UNREVIEWED_MAINTENANCE_BUDGET"));
assert.ok(!checks.some((row) => row.muscleId === "erectors"), "Incidental shortfalls create no volume debt");
assert.deepEqual(auditWeeklyPriorities([
  { id: "special", name: "Upper chest", priority: "SPECIALIZE", target: 11, weekly: 11, directRemaining: 11, secondaryRemaining: 0 },
  { id: "maintain", name: "Upper back", priority: "MAINTAIN", target: 20, weekly: 20, directRemaining: 0, secondaryRemaining: 20 },
]), [], "Absolute numeric ordering and unavoidable overlap are not errors");
assert.equal(WeeklyCoachPlanSchema.safeParse(previous).success, true, "Older plans remain readable");

const assessment = { muscleId: "arms", muscleName: "Arms", priority: "MAINTAIN" as const, status: "ON_TRACK" as const, confidence: "MODERATE" as const,
  recommendedRangeMinimum: 16, recommendedRangeMaximum: 20, priorityReview: { maintenanceBasis: "UNREVIEWED_BASELINE" as const },
  rationale: "High volume has supported growth.", evidence: ["Stable performance at the current growth dose."] };
const review: ProgrammingRecommendations = { globalSummary: "Review", bodyCompositionContext: "Cutting", assessments: [assessment], decisions: [{
  targetMuscleId: "arms", targetMuscleName: "Arms", confidence: "MODERATE", decisionSummary: "Add for growth", evidence: assessment.evidence,
  recommendedOptionKey: "OPTION_A", keepAsIsRationale: "Keep", options: [{ optionKey: "OPTION_A", title: "Add", action: "INCREASE_VOLUME", deltaWeeklySets: 1,
    movementChanges: [{ movementPatternId: "curl", movementPatternName: "Curl", deltaSets: 1 }], preferredExerciseType: "EITHER", placementPreference: "KEEP_CURRENT",
    rationale: "Growth plateau", expectedBenefit: "More growth", mainRisk: "Extra work" }],
}] };
const validation: DecisionValidationContext = { validMuscleIds: new Set(["arms"]), canonicalMuscleNames: new Map([["arms", "Arms"]]),
  targetByMuscle: new Map([["arms", { target: 15, minimum: 12, maximum: 16, priority: "MAINTAIN" }]]), currentMovementSets: new Map([["curl", 15]]),
  validPatternsByMuscle: new Map([["arms", new Map([["curl", { movementPatternId: "curl", movementPatternName: "Curl", primaryExerciseCount: 1,
    secondaryExerciseCount: 0, availableExerciseTypes: ["ISOLATION"], exampleExercises: ["Curl"] }]])]]) };
const rejected = validateT3Review(review, validation);
assert.equal(rejected.parsed.decisions.length, 0, "Growth success does not justify a maintenance increase");
assert.equal(rejected.parsed.assessments[0].recommendedRangeMaximum, 16);
assert.ok(rejected.notes.length);
const widerEstimate = structuredClone(review);
widerEstimate.assessments[0].recommendedRangeMinimum = 10;
widerEstimate.assessments[0].recommendedRangeMaximum = 30;
widerEstimate.assessments[0].priorityReview = { maintenanceBasis: "LOWER_DOSE_HISTORY" };
widerEstimate.decisions = [];
assert.equal(validateT3Review(widerEstimate, validation).parsed.assessments[0].recommendedRangeMaximum, 30,
  "A wider uncertainty interval is not an increase to a maintenance requirement or a new dose cap");
const preservation = structuredClone(review);
preservation.assessments[0].priorityReview = { maintenanceBasis: "PRESERVATION_CONCERN" };
preservation.assessments[0].status = "BELOW_EXPECTED_RESPONSE";
preservation.assessments[0].evidence = ["Repeated comparable decline after reduced arm work on dated exposures; sleep, effort and exercise setup were stable."];
assert.equal(validateT3Review(preservation, validation).parsed.decisions.length, 1, "Supported preservation concerns can increase maintenance work");
const trial = structuredClone(review);
trial.assessments[0] = { ...trial.assessments[0], priorityReview: { maintenanceBasis: "REDUCTION_TRIAL" }, status: "ABOVE_NEEDED_DOSE", recommendedRangeMinimum: 10, recommendedRangeMaximum: 15 };
trial.decisions[0].options[0] = { ...trial.decisions[0].options[0], action: "DECREASE_VOLUME", deltaWeeklySets: -1,
  movementChanges: [{ movementPatternId: "curl", movementPatternName: "Curl", deltaSets: -1 }] };
assert.equal(validateT3Review(trial, validation).parsed.decisions.length, 1, "A supported staged efficiency test remains possible");
const priorityContext = { targetByMuscle: new Map([...validation.targetByMuscle,
  ["upper", { target: 11, minimum: 8, maximum: 15, priority: "SPECIALIZE" as const }] as const]) };
assert.throws(() => assertT3PriorityEffects([{ muscleId: "upper", before: 11, after: 9 }], "arms", review, priorityContext), /growth-priority/);
const protectedReview = { assessments: [...review.assessments, { ...assessment, muscleId: "upper", muscleName: "Upper chest", priority: "SPECIALIZE" as const,
  status: "RECOVERABILITY_CONCERN" as const }] };
assert.doesNotThrow(() => assertT3PriorityEffects([{ muscleId: "upper", before: 11, after: 9 }], "arms", protectedReview, priorityContext));
assert.equal(readMaintenanceBases({ assessments: trial.assessments }).arms, "REDUCTION_TRIAL");
assert.deepEqual(readMaintenanceBases(null), {});
console.log("Priority allocation, maintenance evidence, realized overlap, exercise continuity and trimming tests passed.");
