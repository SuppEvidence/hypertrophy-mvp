import assert from "node:assert/strict";
import {
  refreshT3Option,
  readAppliedOption,
} from "../lib/coaching/t3-decision-refresh";
import {
  previewT3Prescription,
  t3PreviewEffectsSignature,
  assertT3WeeklyBudget,
  type T3PrescriptionInput,
} from "../lib/coaching/t3-prescription-preview";
import { generateMesocyclePrescriptionWithQuickOverrides as generate } from "../lib/planning/mesocycleQuickOverrides";
import { nextT3CoachTarget } from "../lib/coaching/t3-volume-policy";
import type { ProgrammingOption } from "../lib/ai/programming-decision-schema";

export const compound = {
  exerciseId: "press",
  exerciseName: "Machine press",
  movementGroupId: "pressing",
  movementGroupName: "Pressing",
  movementGroupSortOrder: 0,
  primaryMuscles: [{ muscleId: "chest", muscleName: "Chest", sortOrder: 0 }],
  secondaryMuscles: [
    {
      muscleId: "triceps",
      muscleName: "Triceps",
      sortOrder: 1,
      contributionEstimate: 1,
    },
  ],
};
export const isolation = {
  exerciseId: "extension",
  exerciseName: "Triceps extension",
  movementGroupId: "extensions",
  movementGroupName: "Extensions",
  movementGroupSortOrder: 1,
  primaryMuscles: [
    { muscleId: "triceps", muscleName: "Triceps", sortOrder: 1 },
  ],
  secondaryMuscles: [],
};
const slot = (exercise: typeof compound | typeof isolation, index: number) => ({
  ...exercise,
  id: `slot-${index}`,
  templateId: "a",
  templateName: "A",
  templateSequenceIndex: 0,
  expectedOccurrences: 1,
  sortOrder: index,
  plannedSets: 4,
  minSets: 1,
  maxSets: 8,
  autoAdjustable: false,
  defaultSetTypeId: "normal",
  defaultSetTypeMultiplier: 1,
  setPlans: [],
  slotRole: index ? "ISOLATION" : "COMPOUND",
  repBucket: "ISOLATION",
});
export const input: T3PrescriptionInput = {
  program: { volumeWindowDays: 7, volumeTargets: [] },
  mesocycle: {
    id: "block",
    volumeTargets: [
      {
        muscleId: "chest",
        muscleName: "Chest",
        sortOrder: 0,
        targetSets: 4,
        explicitTarget: true,
      },
      {
        muscleId: "triceps",
        muscleName: "Triceps",
        sortOrder: 1,
        targetSets: 8,
        explicitTarget: true,
      },
    ],
    repPolicies: [],
  },
  templateExercises: [slot(compound, 0), slot(isolation, 1)],
  templates: [{ id: "a", name: "A", sequenceIndex: 0, expectedOccurrences: 1 }],
  movementDefaults: [compound, isolation],
  setTypes: [
    {
      id: "normal",
      name: "Normal",
      slug: "normal",
      multiplier: 1,
      isIntensifier: false,
    },
  ],
};
export const reduce: ProgrammingOption = {
  optionKey: "OPTION_A",
  title: "Reduce pressing",
  action: "DECREASE_VOLUME",
  deltaWeeklySets: -1,
  movementChanges: [
    {
      movementPatternId: "pressing",
      movementPatternName: "Pressing",
      deltaSets: -1,
    },
  ],
  preferredExerciseType: "COMPOUND",
  placementPreference: "KEEP_CURRENT",
  rationale: "Assess lower dose",
  expectedBenefit: "Recover",
  mainRisk: "Monitor response",
};
export const tricepsOption: ProgrammingOption = {
  ...reduce,
  title: "Reduce extensions",
  deltaWeeklySets: -2,
  preferredExerciseType: "ISOLATION",
  movementChanges: [
    {
      movementPatternId: "extensions",
      movementPatternName: "Extensions",
      deltaSets: -2,
    },
  ],
};
export const reviewed = previewT3Prescription(
  input,
  "triceps",
  tricepsOption,
  "MODERATE",
  "RECOVERABILITY_CONCERN",
);
export const accepted = previewT3Prescription(
  input,
  "chest",
  reduce,
  "MODERATE",
  "RECOVERABILITY_CONCERN",
);
export function afterAcceptance(
  acceptedPreview = accepted,
): T3PrescriptionInput {
  const next = structuredClone(input);
  next.mesocycle!.structureOverrides = acceptedPreview.structureOverrides;
  next.mesocycle!.volumeTargets[0].targetSets = 3;
  next.mesocycle!.movementVolumeTargets = acceptedPreview.movementTargets.map(
    (row) => ({ ...row, movementGroupName: row.movementGroupId, sortOrder: 0 }),
  );
  return next;
}
const current = afterAcceptance();
assert.equal(
  generate(current).volumeRows.find((row) => row.muscleId === "triceps")
    ?.planned,
  7,
);
export const refreshed = refreshT3Option(
  current,
  "triceps",
  tricepsOption,
  reviewed,
  "MODERATE",
  "RECOVERABILITY_CONCERN",
);
assert.equal(refreshed.status, "READY");
assert.equal(refreshed.option.deltaWeeklySets, -1);
assert.equal(
  refreshed.preview?.muscles.find((row) => row.muscleId === "triceps")?.after,
  6,
  "Preserve reviewed target instead of repeating the whole reduction",
);
assert.deepEqual(
  refreshed.preview?.slots.map((row) => [row.before, row.after]),
  [[4, 3]],
);
assert.notEqual(
  t3PreviewEffectsSignature(refreshed.preview!),
  t3PreviewEffectsSignature(reviewed),
  "Old page cannot approve changed effects",
);
assert.equal(
  refreshT3Option(
    current,
    "chest",
    reduce,
    accepted,
    "MODERATE",
    "RECOVERABILITY_CONCERN",
  ).status,
  "SATISFIED",
  "A fully covered request must not be applied twice",
);
assert.equal(
  refreshT3Option(
    input,
    "triceps",
    tricepsOption,
    reviewed,
    "MODERATE",
    "RECOVERABILITY_CONCERN",
  ).note,
  null,
  "No gratuitous change before an approval",
);
assert.equal(
  readAppliedOption({ appliedOption: refreshed.option })?.deltaWeeklySets,
  -1,
);
assert.equal(
  nextT3CoachTarget({
    current: 7,
    delta: -0.5,
    allowFractionalDelta: true,
    minimum: 2,
    maximum: 10,
    priority: "GROW",
  }),
  6.5,
);
assert.throws(
  () =>
    nextT3CoachTarget({
      current: 7,
      delta: -0.5,
      minimum: 2,
      maximum: 10,
      priority: "GROW",
    }),
  "Model proposals still require integer increments",
);
assert.throws(() =>
  nextT3CoachTarget({
    current: 7,
    delta: Infinity,
    allowFractionalDelta: true,
    minimum: 2,
    maximum: 10,
    priority: "GROW",
  }),
);
assert.throws(
  () =>
    assertT3WeeklyBudget(refreshed.preview!, Array(7).fill(refreshed.preview!)),
  "Combined weekly limits still apply",
);
const fractional = {
  ...refreshed.option,
  deltaWeeklySets: -0.5,
  movementChanges: refreshed.option.movementChanges.map((row) => ({
    ...row,
    deltaSets: -0.5,
  })),
};
assert.equal(
  readAppliedOption({ appliedOption: fractional })?.deltaWeeklySets,
  -0.5,
  "Applied history retains deterministic fractional remainder",
);
assert.equal(
  input.templateExercises[0].plannedSets,
  4,
  "Base templates remain intact",
);
console.log(
  "T3 remaining decisions: compound overlap, partial remainder, goal already met, unchanged previews, budgets, fractional history and template isolation passed.",
);

const symptomReduction = refreshT3Option(
  current,
  "triceps",
  tricepsOption,
  reviewed,
  "MODERATE",
  "RECOVERABILITY_CONCERN",
  true,
);
assert.equal(symptomReduction.status, "READY");
assert.equal(
  symptomReduction.preview?.slots[0].after,
  2,
  "A symptom-specific movement reduction is not cancelled by less work in another movement",
);
assert.equal(
  symptomReduction.preview?.muscles.find((row) => row.muscleId === "triceps")
    ?.after,
  5,
);
console.log(
  "Symptom-specific movement intent remains intact after compound changes.",
);
