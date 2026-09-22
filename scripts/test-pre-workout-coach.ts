import assert from "node:assert/strict";
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
];
const readiness = [
  { ...inferLocalReadiness(localBase), movementGroupId: "mg1" },
  { ...inferLocalReadiness(localBase), movementGroupId: "mg2" },
  { ...inferLocalReadiness(localBase), movementGroupId: "mg3" },
  { ...inferLocalReadiness(localBase), movementGroupId: "mg4" },
];
const keep = {
  decision: "KEEP" as const, confidence: "MODERATE" as const, baseTemplateId: "ta", summary: "Keep.", constraintsApplied: [],
  items: [
    { sourceSlotId: "s1", exerciseId: "e1", sets: 3, minReps: 8, maxReps: 12, targetRir: 1, reason: "Keep." },
    { sourceSlotId: "s2", exerciseId: "e3", sets: 2, minReps: 10, maxReps: 15, targetRir: 1, reason: "Keep." },
  ],
};
const config = { requestedTemplateId: "ta", templateIds: ["ta", "tb"], slots, localizedReadiness: readiness };

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
      { sourceSlotId: "s3", exerciseId: "e2", sets: 2, minReps: 8, maxReps: 12, targetRir: 1, reason: "Use alternate press." },
      { sourceSlotId: "s4", exerciseId: "e4", sets: 2, minReps: 12, maxReps: 20, targetRir: 1, reason: "Use alternate session." },
      { sourceSlotId: "s5", exerciseId: "e5", sets: 1, minReps: 10, maxReps: 15, targetRir: 1, reason: "Use alternate session." },
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
      { sourceSlotId: "s3", exerciseId: "e2", sets: 1, minReps: 8, maxReps: 12, targetRir: 1, reason: "Import." },
      { sourceSlotId: "s4", exerciseId: "e4", sets: 1, minReps: 12, maxReps: 20, targetRir: 1, reason: "Import." },
      { sourceSlotId: "s5", exerciseId: "e5", sets: 1, minReps: 10, maxReps: 15, targetRir: 1, reason: "Import." },
    ],
  };
  assert.equal(validatePreWorkoutPlan(plan, config).ok, false);
});

console.log(`${checks} pre-workout coaching policy checks passed.`);
