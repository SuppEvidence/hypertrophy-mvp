import assert from "node:assert/strict";
import { generateMesocyclePrescription } from "../lib/planning/mesocycleGenerator";

const muscle = (muscleId: string, muscleName: string) => ({ muscleId, muscleName, sortOrder: 0 });
const base = {
  program: { secondaryContribution: 0.5, volumeWindowDays: 7,
    volumeTargets: [
      { ...muscle("quad", "Quads"), weeklyTargetSets: 0 },
      { ...muscle("chest", "Chest"), weeklyTargetSets: 3 },
    ] },
  templates: [{ id: "day-a", name: "Day A", sequenceIndex: 0, expectedOccurrences: 1 }],
  setTypes: [{ id: "straight", name: "Normal", multiplier: 1, isIntensifier: false }],
  movementDefaults: [{ exerciseId: "extension", exerciseName: "Leg extension",
    movementGroupId: "knee-extension", movementGroupName: "Knee extension", movementGroupSortOrder: 2,
    primaryMuscles: [muscle("quad", "Quads")], secondaryMuscles: [] }],
  templateExercises: [{ id: "press-slot", templateId: "day-a", templateName: "Day A",
    templateSequenceIndex: 0, expectedOccurrences: 1, exerciseId: "press", exerciseName: "Chest press",
    movementGroupId: "press", movementGroupName: "Press", movementGroupSortOrder: 1,
    sortOrder: 0, plannedSets: 3, minSets: 3, maxSets: 3, minReps: 8, maxReps: 12,
    defaultSetTypeId: "straight", defaultSetTypeMultiplier: 1,
    setPlans: [], autoAdjustable: true, primaryMuscles: [muscle("chest", "Chest")], secondaryMuscles: [] }],
  mesocycle: { id: "block", volumeTargets: [
    { ...muscle("quad", "Quads"), targetSets: 2, explicitTarget: true, priority: "SPECIALIZE" as const },
    { ...muscle("chest", "Chest"), targetSets: 3, explicitTarget: true, priority: "MAINTAIN" as const },
  ], repPolicies: [], movementVolumeTargets: [] },
};

const added = generateMesocyclePrescription(base).structureProposals;
assert.equal(added.find((entry) => entry.type === "ADD_SLOT")?.movementGroupId, "knee-extension");
assert.equal(added.find((entry) => entry.type === "ADD_SLOT")?.action.type, "ADD_SLOT");

const reduced = generateMesocyclePrescription({ ...base, mesocycle: { ...base.mesocycle,
  volumeTargets: [
    { ...muscle("quad", "Quads"), targetSets: 0, explicitTarget: true, priority: "INDIRECT_ONLY" as const },
    { ...muscle("chest", "Chest"), targetSets: 0, explicitTarget: true, priority: "INDIRECT_ONLY" as const },
  ] } }).structureProposals;
assert.ok(reduced.some((entry) => entry.type === "REMOVE_SLOT" && entry.movementGroupId === "press"));

const stillNeeded = generateMesocyclePrescription({ ...base,
  templateExercises: [{ ...base.templateExercises[0], secondaryMuscles: [muscle("quad", "Quads")] }],
  movementDefaults: [],
  mesocycle: { ...base.mesocycle, volumeTargets: [
    { ...muscle("quad", "Quads"), targetSets: 1.5, explicitTarget: true, priority: "MAINTAIN" as const },
    { ...muscle("chest", "Chest"), targetSets: 0, explicitTarget: true, priority: "INDIRECT_ONLY" as const },
  ] },
}).structureProposals;
assert.ok(!stillNeeded.some((entry) => entry.type === "REMOVE_SLOT" && entry.movementGroupId === "press"),
  "A secondary muscle still needs this slot");

const twoSlots = { ...base, templateExercises: [base.templateExercises[0],
  { ...base.templateExercises[0], id: "press-slot-2", exerciseId: "press-2", sortOrder: 1 }],
  mesocycle: { ...base.mesocycle, volumeTargets: [
    { ...muscle("quad", "Quads"), targetSets: 0, explicitTarget: true, priority: "INDIRECT_ONLY" as const },
    { ...muscle("chest", "Chest"), targetSets: 0, explicitTarget: true, priority: "INDIRECT_ONLY" as const },
  ] } };
const first = generateMesocyclePrescription(twoSlots).structureProposals.find((entry) => entry.type === "REMOVE_SLOT");
assert.ok(first);
const remaining = generateMesocyclePrescription({ ...twoSlots,
  mesocycle: { ...twoSlots.mesocycle, structureOverrides: { version: 1, actions: [first.action] } },
});
assert.equal(remaining.items.filter((item) => !item.isMesocycleSuppressed).length, 1);
assert.ok(remaining.structureProposals.some((entry) => entry.type === "REMOVE_SLOT" && entry.id !== first.id),
  "After one approval the planner should offer to remove the last unnecessary pattern slot");

console.log("Priority-driven slot add/remove and overlapping-muscle protection passed.");
