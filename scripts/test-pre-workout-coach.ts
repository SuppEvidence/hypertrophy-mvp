import assert from "node:assert/strict";
import { isEdtSetType } from "../lib/coaching/set-type-classification";
import {
  inferBodyCompositionTrend,
  inferLocalReadiness,
  summarizeGlobalRecovery,
  validatePreWorkoutPlan,
  type PreWorkoutSlotCandidate,
} from "../lib/coaching/pre-workout-coach-policy";

let checks = 0;
function check(name: string, fn: () => void) {
  fn(); checks += 1; console.log(`PASS ${name}`);
}

const day = (offset: number) => new Date(Date.UTC(2026, 7, 1 + offset));

check("paired downward bodyweight and waist trend identifies likely fat loss", () => {
  const trend = inferBodyCompositionTrend([
    { loggedAt: day(0), bodyweight: 76.8, waist: 765 },
    { loggedAt: day(4), bodyweight: 76.5, waist: 764 },
    { loggedAt: day(8), bodyweight: 76.6, waist: 762 },
    { loggedAt: day(12), bodyweight: 76.1, waist: 760 },
    { loggedAt: day(16), bodyweight: 76.2, waist: 758 },
    { loggedAt: day(20), bodyweight: 75.8, waist: 756 },
  ]);
  assert.equal(trend.status, "FAT_LOSS_LIKELY");
  assert.ok((trend.bodyweightWeeklyChangePct ?? 0) < 0);
  assert.ok((trend.waistWeeklyChange ?? 0) < 0);
});

check("bodyweight gain with non-falling waist identifies likely gain phase", () => {
  const trend = inferBodyCompositionTrend([
    { loggedAt: day(0), bodyweight: 74, waist: 750 },
    { loggedAt: day(5), bodyweight: 74.2, waist: 750 },
    { loggedAt: day(10), bodyweight: 74.4, waist: 751 },
    { loggedAt: day(15), bodyweight: 74.6, waist: 751 },
    { loggedAt: day(20), bodyweight: 74.8, waist: 752 },
  ]);
  assert.equal(trend.status, "GAIN_LIKELY");
});

check("stable paired metrics identify likely maintenance", () => {
  const trend = inferBodyCompositionTrend([
    { loggedAt: day(0), bodyweight: 75, waist: 755 },
    { loggedAt: day(5), bodyweight: 75.1, waist: 755 },
    { loggedAt: day(10), bodyweight: 74.9, waist: 754.5 },
    { loggedAt: day(15), bodyweight: 75, waist: 755 },
  ]);
  assert.equal(trend.status, "MAINTENANCE_LIKELY");
});

check("short metric history stays insufficient", () => {
  assert.equal(inferBodyCompositionTrend([
    { loggedAt: day(0), bodyweight: 75, waist: 755 },
    { loggedAt: day(5), bodyweight: 74.8, waist: 753 },
  ]).status, "INSUFFICIENT_DATA");
});

check("conflicting bodyweight and waist trends stay mixed", () => {
  const trend = inferBodyCompositionTrend([
    { loggedAt: day(0), bodyweight: 75, waist: 755 },
    { loggedAt: day(5), bodyweight: 74.8, waist: 757 },
    { loggedAt: day(10), bodyweight: 74.6, waist: 759 },
    { loggedAt: day(15), bodyweight: 74.4, waist: 761 },
  ]);
  assert.equal(trend.status, "MIXED");
});

check("favorable recovery inputs do not imply adding work", () => {
  const recovery = summarizeGlobalRecovery([
    { loggedAt: day(20), sleepDuration: 8, sleepQuality: 5, stress: 1, readiness: 5, manualFatigue: 1, sorenessJointIrritation: 1 },
    { loggedAt: day(19), sleepDuration: 7.5, sleepQuality: 4, stress: 1, readiness: 5, manualFatigue: 1, sorenessJointIrritation: 1 },
  ], day(21));
  assert.equal(recovery.status, "GOOD");
  assert.match(recovery.interpretation, /not a reason to add/i);
});

check("poor recent recovery inputs identify high fatigue", () => {
  const recovery = summarizeGlobalRecovery([
    { loggedAt: day(20), sleepDuration: 5, sleepQuality: 1, stress: 5, readiness: 1, manualFatigue: 5, sorenessJointIrritation: 5 },
    { loggedAt: day(19), sleepDuration: 5.5, sleepQuality: 1, stress: 5, readiness: 1, manualFatigue: 5, sorenessJointIrritation: 5 },
  ], day(21));
  assert.equal(recovery.status, "HIGH_FATIGUE");
});

check("missing recovery fields stay insufficient", () => {
  assert.equal(summarizeGlobalRecovery([{ loggedAt: day(20) }], day(21)).status, "INSUFFICIENT_DATA");
});

const localBase = {
  movementGroupId: "mg1", movementGroupName: "Incline press", hoursSinceLastExposure: 72,
  effectiveSetsLast48h: 0, effectiveSetsLast72h: 0, performanceExposureCount: 6,
  downwardExerciseSignals: 0, recentPainSets: 0, recentCompromisedSets: 0,
  globalRecoveryStatus: "NORMAL" as const,
};

check("local pain creates caution", () => {
  assert.equal(inferLocalReadiness({ ...localBase, recentPainSets: 1 }).status, "CAUTION");
});

check("recent local workload creates recovering status", () => {
  assert.equal(inferLocalReadiness({ ...localBase, hoursSinceLastExposure: 30, effectiveSetsLast48h: 2, effectiveSetsLast72h: 2 }).status, "RECOVERING");
});

check("adequate history without warning signals reports ready", () => {
  assert.equal(inferLocalReadiness(localBase).status, "READY");
});

check("sparse local history remains insufficient", () => {
  assert.equal(inferLocalReadiness({ ...localBase, performanceExposureCount: 1 }).status, "INSUFFICIENT_DATA");
});

const slots: PreWorkoutSlotCandidate[] = [
  { id: "s1", templateId: "ta", sortOrder: 0, movementGroupId: "mg1", prescribedSets: 3, maxSets: 4, minReps: 8, maxReps: 12, targetRir: 1, defaultExerciseId: "e1", allowedExerciseIds: ["e1", "e2"] },
  { id: "s2", templateId: "ta", sortOrder: 1, movementGroupId: "mg2", prescribedSets: 2, maxSets: 2, minReps: 10, maxReps: 15, targetRir: 1, defaultExerciseId: "e3", allowedExerciseIds: ["e3"] },
  { id: "s3", templateId: "tb", sortOrder: 0, movementGroupId: "mg1", prescribedSets: 2, maxSets: 3, minReps: 8, maxReps: 12, targetRir: 1, defaultExerciseId: "e2", allowedExerciseIds: ["e1", "e2"] },
  { id: "s4", templateId: "tb", sortOrder: 1, movementGroupId: "mg3", prescribedSets: 2, maxSets: 2, minReps: 12, maxReps: 20, targetRir: 1, defaultExerciseId: "e4", allowedExerciseIds: ["e4"] },
  { id: "s5", templateId: "tb", sortOrder: 2, movementGroupId: "mg4", prescribedSets: 1, maxSets: 1, minReps: 10, maxReps: 15, targetRir: 1, defaultExerciseId: "e5", allowedExerciseIds: ["e5"] },
].map((slot) => ({ ...slot, prescribedSetTypeIds: Array(slot.prescribedSets).fill("normal") }));
const readiness = [
  { ...inferLocalReadiness(localBase), movementGroupId: "mg1" },
  { ...inferLocalReadiness(localBase), movementGroupId: "mg2" },
  { ...inferLocalReadiness(localBase), movementGroupId: "mg3" },
  { ...inferLocalReadiness(localBase), movementGroupId: "mg4" },
];
const keep = {
  decision: "KEEP" as const, confidence: "MODERATE" as const, baseTemplateId: "ta", summary: "Keep.", constraintsApplied: [],
  items: [
    { sourceSlotId: "s1", exerciseId: "e1", sets: 3, setTypeIds: ["normal", "normal", "normal"], minReps: 8, maxReps: 12, targetRir: 1, reason: "Keep." },
    { sourceSlotId: "s2", exerciseId: "e3", sets: 2, setTypeIds: ["normal", "normal"], minReps: 10, maxReps: 15, targetRir: 1, reason: "Keep." },
  ],
};
const config = { requestedTemplateId: "ta", templateIds: ["ta", "tb"], slots, localizedReadiness: readiness,
  setTypes: [
    { id: "normal", slug: "normal", name: "Normal", multiplier: 1, isIntensifier: false },
    { id: "partials", slug: "lengthened-partials", name: "Lengthened partials", multiplier: 1.2, isIntensifier: true },
    { id: "myo", slug: "myo-reps", name: "Myo-reps", multiplier: 1.3, isIntensifier: true },
    { id: "edt", slug: "edt", name: "EDT", multiplier: 1.2, isIntensifier: false },
  ],
  exercises: [
    { id: "e1", movementGroupName: "Squat pattern", primaryMuscleIds: ["quads"], secondaryMuscleIds: ["glutes"] },
    { id: "e2", movementGroupName: "Lateral raise", primaryMuscleIds: ["delts"], secondaryMuscleIds: [] },
    { id: "e3", movementGroupName: "Leg curl", primaryMuscleIds: ["hamstrings"], secondaryMuscleIds: [] },
    { id: "e4", movementGroupName: "Knee extension", primaryMuscleIds: ["quads"], secondaryMuscleIds: [] },
    { id: "e5", movementGroupName: "Hammer curl", primaryMuscleIds: ["biceps"], secondaryMuscleIds: [] },
  ],
  secondaryContribution: 0.5,
};

check("exact requested template is a valid KEEP plan", () => {
  assert.equal(validatePreWorkoutPlan(keep, config).ok, true);
});

check("KEEP cannot hide a structural adjustment", () => {
  const plan = structuredClone(keep); plan.items[0].sets = 2;
  assert.equal(validatePreWorkoutPlan(plan, config).ok, false);
});

check("another existing template is a valid approved adjustment", () => {
  const plan = {
    ...keep, decision: "ADJUST" as const, baseTemplateId: "tb",
    items: [
      { sourceSlotId: "s3", exerciseId: "e2", sets: 2, setTypeIds: ["normal", "normal"], minReps: 8, maxReps: 12, targetRir: 1, reason: "Use alternate press." },
      { sourceSlotId: "s4", exerciseId: "e4", sets: 2, setTypeIds: ["normal", "normal"], minReps: 12, maxReps: 20, targetRir: 1, reason: "Use alternate session." },
      { sourceSlotId: "s5", exerciseId: "e5", sets: 1, setTypeIds: ["normal"], minReps: 10, maxReps: 15, targetRir: 1, reason: "Use alternate session." },
    ],
  };
  assert.equal(validatePreWorkoutPlan(plan, config).ok, true);
});

check("pre-workout plan cannot increase total physical sets", () => {
  const plan = { ...structuredClone(keep), decision: "ADJUST" as const }; plan.items[0].sets = 4;
  assert.equal(validatePreWorkoutPlan(plan, config).ok, false);
});

check("exercise must belong to the source movement slot", () => {
  const plan = { ...structuredClone(keep), decision: "ADJUST" as const }; plan.items[0].exerciseId = "e4";
  assert.equal(validatePreWorkoutPlan(plan, config).ok, false);
});

check("rep target change is limited to two reps per endpoint", () => {
  const plan = { ...structuredClone(keep), decision: "ADJUST" as const }; plan.items[0].minReps = 5;
  assert.equal(validatePreWorkoutPlan(plan, config).ok, false);
});

check("locally cautioned movement cannot be made harder", () => {
  const caution = [{ ...readiness[0], status: "CAUTION" as const }, ...readiness.slice(1)];
  const plan = { ...structuredClone(keep), decision: "ADJUST" as const }; plan.items[0].sets = 4; plan.items[1].sets = 1;
  assert.equal(validatePreWorkoutPlan(plan, { ...config, localizedReadiness: caution }).ok, false);
});

check("at most two slots can be imported into a base template", () => {
  const plan = {
    ...keep, decision: "ADJUST" as const,
    items: [
      { ...keep.items[0], sets: 1 },
      { sourceSlotId: "s3", exerciseId: "e2", sets: 1, setTypeIds: ["normal"], minReps: 8, maxReps: 12, targetRir: 1, reason: "Import." },
      { sourceSlotId: "s4", exerciseId: "e4", sets: 1, setTypeIds: ["normal"], minReps: 12, maxReps: 20, targetRir: 1, reason: "Import." },
      { sourceSlotId: "s5", exerciseId: "e5", sets: 1, setTypeIds: ["normal"], minReps: 10, maxReps: 15, targetRir: 1, reason: "Import." },
    ],
  };
  assert.equal(validatePreWorkoutPlan(plan, config).ok, false);
});

check("a squat cannot gain lengthened partials even when another set is removed", () => {
  const plan = { ...structuredClone(keep), decision: "ADJUST" as const };
  plan.items[0].setTypeIds[0] = "partials";
  plan.items[1].sets = 1;
  plan.items[1].setTypeIds = ["normal"];
  assert.ok(validatePreWorkoutPlan(plan, config).errors.some((error) => error.includes("unsuitable")));
});

check("effective volume cannot rise with an unchanged physical set count", () => {
  const plan = { ...structuredClone(keep), decision: "ADJUST" as const };
  plan.items[1].setTypeIds[0] = "myo";
  assert.ok(validatePreWorkoutPlan(plan, config).errors.some((error) => error.includes("total effective sets")));
});

check("partial reps on a leg curl are rejected despite local budget", () => {
  const plan = { ...structuredClone(keep), decision: "ADJUST" as const };
  plan.items[1].setTypeIds[0] = "partials";
  plan.items[0].sets = 2;
  plan.items[0].setTypeIds = ["normal", "normal"];
  assert.ok(validatePreWorkoutPlan(plan, config).errors.some((error) => error.includes("unsuitable")));
});

check("one myo-rep set on a supported isolation exercise is valid with matching dose reduction", () => {
  const plan = { ...structuredClone(keep), decision: "ADJUST" as const };
  plan.items[0].sets = 2;
  plan.items[0].setTypeIds = ["normal", "normal"];
  plan.items[1].setTypeIds[1] = "myo";
  assert.equal(validatePreWorkoutPlan(plan, config).ok, true);
});

check("exercise profile blocks new intensifiers even with matching dose reduction", () => {
  const plan = { ...structuredClone(keep), decision: "ADJUST" as const };
  plan.items[0].sets = 2;
  plan.items[0].setTypeIds = ["normal", "normal"];
  plan.items[1].setTypeIds[1] = "myo";
  const exercises = config.exercises.map((exercise) => exercise.id === "e3"
    ? { ...exercise, intensifierPreference: "NONE" as const } : exercise);
  assert.ok(validatePreWorkoutPlan(plan, { ...config, exercises }).errors.some((error) => error.includes("unsuitable")));
});

check("selected intensifier profile remains subject to movement safety", () => {
  const plan = { ...structuredClone(keep), decision: "ADJUST" as const };
  plan.items[0].sets = 2;
  plan.items[0].setTypeIds = ["normal", "normal"];
  plan.items[1].setTypeIds[1] = "myo";
  const selected = config.exercises.map((exercise) => exercise.id === "e3"
    ? { ...exercise, intensifierPreference: "ONLY_SELECTED" as const, allowedIntensifierIds: ["myo"] } : exercise);
  assert.equal(validatePreWorkoutPlan(plan, { ...config, exercises: selected }).ok, true);
  const unselected = selected.map((exercise) => exercise.id === "e3" ? { ...exercise, allowedIntensifierIds: ["partials"] } : exercise);
  assert.ok(validatePreWorkoutPlan(plan, { ...config, exercises: unselected }).errors.some((error) => error.includes("unsuitable")));
  const squat = { ...structuredClone(keep), decision: "ADJUST" as const };
  squat.items[0].setTypeIds[0] = "partials";
  squat.items[1].sets = 1;
  squat.items[1].setTypeIds = ["normal"];
  const squatSelected = config.exercises.map((exercise) => exercise.id === "e1"
    ? { ...exercise, intensifierPreference: "ONLY_SELECTED" as const, allowedIntensifierIds: ["partials"] } : exercise);
  assert.ok(validatePreWorkoutPlan(squat, { ...config, exercises: squatSelected }).errors.some((error) => error.includes("unsuitable")));
});

check("EDT classification recognizes custom names without marking every extended set", () => {
  assert.equal(isEdtSetType({ slug: "edt", name: "EDT" }), true);
  assert.equal(isEdtSetType({ slug: "extended-density-training", name: "Extended Density Training" }), true);
  assert.equal(isEdtSetType({ slug: "extended-set", name: "Extended set" }), false);
});

check("EDT remains a base set but requires explicit opt-in and a suitable movement", () => {
  const plan = { ...structuredClone(keep), decision: "ADJUST" as const };
  plan.items[0].sets = 2;
  plan.items[0].setTypeIds = ["normal", "normal"];
  plan.items[1].setTypeIds[1] = "edt";
  assert.ok(validatePreWorkoutPlan(plan, config).errors.some((error) => error.includes("unsuitable")));
  const optedIn = config.exercises.map((exercise) => exercise.id === "e3"
    ? { ...exercise, intensifierPreference: "ONLY_SELECTED" as const, allowedIntensifierIds: ["edt"] } : exercise);
  assert.equal(validatePreWorkoutPlan(plan, { ...config, exercises: optedIn }).ok, true);
  const squat = { ...structuredClone(keep), decision: "ADJUST" as const };
  squat.items[0].setTypeIds[0] = "edt";
  squat.items[1].sets = 1;
  squat.items[1].setTypeIds = ["normal"];
  const squatOptIn = config.exercises.map((exercise) => exercise.id === "e1"
    ? { ...exercise, intensifierPreference: "ONLY_SELECTED" as const, allowedIntensifierIds: ["edt"] } : exercise);
  assert.ok(validatePreWorkoutPlan(squat, { ...config, exercises: squatOptIn }).errors.some((error) => error.includes("unsuitable")));
});

check("local caution forbids an intensifier even if another set is removed", () => {
  const plan = { ...structuredClone(keep), decision: "ADJUST" as const };
  plan.items[0].sets = 2;
  plan.items[0].setTypeIds = ["normal", "normal"];
  plan.items[1].setTypeIds[1] = "myo";
  const caution = readiness.map((item) => item.movementGroupId === "mg2" ? { ...item, status: "CAUTION" as const } : item);
  assert.ok(validatePreWorkoutPlan(plan, { ...config, localizedReadiness: caution }).errors.some((error) => error.includes("unsuitable")));
});

check("a set-type-only change counts as a plan adjustment", () => {
  const base = structuredClone(keep);
  base.items[1].setTypeIds[0] = "myo";
  assert.ok(validatePreWorkoutPlan(base, config).errors.some((error) => error.includes("KEEP must preserve")));
});

check("two new intensifiers cannot be offset by dropping a different set", () => {
  const plan = { ...structuredClone(keep), decision: "ADJUST" as const };
  plan.items[0].sets = 1;
  plan.items[0].setTypeIds = ["normal"];
  plan.items[1].setTypeIds = ["myo", "myo"];
  assert.ok(validatePreWorkoutPlan(plan, config).errors.some((error) => error.includes("At most one new intensifier")));
});

check("a substituted exercise cannot inherit an unsuitable template intensifier", () => {
  const slot = slots[2];
  slot.prescribedSetTypeIds = ["partials", "normal"];
  try {
    const changed = { ...structuredClone(keep), decision: "ADJUST" as const, baseTemplateId: "tb",
      items: [
        { ...keep.items[0], sourceSlotId: "s3", exerciseId: "e1", sets: 2, setTypeIds: ["partials", "normal"] },
        { ...keep.items[1], sourceSlotId: "s4", exerciseId: "e4", setTypeIds: ["normal", "normal"] },
        { ...keep.items[1], sourceSlotId: "s5", exerciseId: "e5", sets: 1, setTypeIds: ["normal"] },
      ],
    };
    assert.ok(validatePreWorkoutPlan(changed, config).errors.some((error) => error.includes("unsuitable")));
  } finally {
    slot.prescribedSetTypeIds = ["normal", "normal"];
  }
});

const prioritized = {
  ...config,
  slots: slots.map((slot) => ({ ...slot, primaryMuscleIds: slot.id === "s1" ? ["quads"] : slot.id === "s2" ? ["hamstrings"] : [] })),
  musclePriorities: [
    { muscleId: "quads", priority: "SPECIALIZE" as const },
    { muscleId: "hamstrings", priority: "MAINTAIN" as const },
  ],
};

check("routine trims keep specialization work until lower-priority work is reduced", () => {
  const plan = { ...structuredClone(keep), decision: "ADJUST" as const };
  plan.items[0].sets = 2;
  plan.items[0].setTypeIds = ["normal", "normal"];
  assert.ok(validatePreWorkoutPlan(plan, prioritized).errors.some((error) => error.includes("lower-priority work")));
  plan.items[1].sets = 1;
  plan.items[1].setTypeIds = ["normal"];
  assert.equal(validatePreWorkoutPlan(plan, prioritized).ok, true);
});

check("local caution permits a priority exercise to be reduced first", () => {
  const plan = { ...structuredClone(keep), decision: "ADJUST" as const };
  plan.items[0].sets = 2;
  plan.items[0].setTypeIds = ["normal", "normal"];
  const caution = prioritized.localizedReadiness.map((row) => row.movementGroupId === "mg1" ? { ...row, status: "CAUTION" as const } : row);
  assert.equal(validatePreWorkoutPlan(plan, { ...prioritized, localizedReadiness: caution }).ok, true);
});

check("a stated equipment constraint can justify reducing otherwise protected work", () => {
  const plan = { ...structuredClone(keep), decision: "ADJUST" as const };
  plan.items[0].sets = 2;
  plan.items[0].setTypeIds = ["normal", "normal"];
  assert.equal(validatePreWorkoutPlan(plan, { ...prioritized, athleteConstraints: "Squat machine unavailable." }).ok, true);
});

check("a general time constraint still trims lower-priority work first", () => {
  const plan = { ...structuredClone(keep), decision: "ADJUST" as const };
  plan.items[0].sets = 2;
  plan.items[0].setTypeIds = ["normal", "normal"];
  assert.ok(validatePreWorkoutPlan(plan, { ...prioritized, athleteConstraints: "Only 40 minutes today." }).errors.some((error) => error.includes("lower-priority work")));
});

check("a priority exercise can move earlier but cannot be moved behind lower-priority work", () => {
  const reversed = { ...structuredClone(keep), decision: "ADJUST" as const, items: [...keep.items].reverse() };
  assert.ok(validatePreWorkoutPlan(reversed, prioritized).errors.some((error) => error.includes("reorder cannot")));
  const lowerFirst = {
    ...prioritized,
    musclePriorities: [
      { muscleId: "quads", priority: "MAINTAIN" as const },
      { muscleId: "hamstrings", priority: "SPECIALIZE" as const },
    ],
  };
  assert.equal(validatePreWorkoutPlan(reversed, lowerFirst).ok, true);
});

console.log(`${checks} pre-workout coaching policy checks passed.`);
