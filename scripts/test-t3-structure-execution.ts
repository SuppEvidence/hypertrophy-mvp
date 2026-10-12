import assert from "node:assert/strict";
import { previewT3Prescription, readAppliedPreview, t3PreviewEffectsSignature, type T3PrescriptionInput } from "../lib/coaching/t3-prescription-preview";
import { generateMesocyclePrescriptionWithQuickOverrides as generate } from "../lib/planning/mesocycleQuickOverrides";
import { parseMesocycleStructureOverrides } from "../lib/planning/mesocycleStructure";
import { reconcileT3ApprovalSummary } from "../lib/coaching/t3-review-summary";
import { t3ExerciseType } from "../lib/coaching/t3-exercise-type";
import type { ProgrammingOption, ProgrammingRecommendations } from "../lib/ai/programming-decision-schema";

const exercise = { exerciseId: "hammer", exerciseName: "Hammer curl", movementGroupId: "curl", movementGroupName: "Hammer curl", movementGroupSortOrder: 0,
  primaryMuscles: [{ muscleId: "arms", muscleName: "Brachialis", sortOrder: 0 }], secondaryMuscles: [{ muscleId: "biceps", muscleName: "Biceps", sortOrder: 1, contributionEstimate: .5 }] };
const slot = { ...exercise, id: "curl-slot", templateId: "a", templateName: "A", templateSequenceIndex: 0, expectedOccurrences: 1,
  sortOrder: 2, plannedSets: 3, minSets: 3, maxSets: 3, autoAdjustable: false, defaultSetTypeId: "normal", defaultSetTypeMultiplier: 1,
  setPlans: [], slotRole: "ISOLATION", repBucket: "ISOLATION" };
const input: T3PrescriptionInput = { program: { volumeWindowDays: 7, volumeTargets: [] },
  mesocycle: { id: "block", volumeTargets: [{ muscleId: "arms", muscleName: "Brachialis", sortOrder: 0, targetSets: 3, explicitTarget: true }], repPolicies: [] },
  templateExercises: [slot], templates: [{ id: "a", name: "A", sequenceIndex: 0, expectedOccurrences: 1 }], movementDefaults: [exercise],
  setTypes: [{ id: "normal", name: "Normal", slug: "normal", multiplier: 1, isIntensifier: false }, { id: "drop", name: "Drop", slug: "drop-set", multiplier: 1.5, isIntensifier: true }] };
const reduce: ProgrammingOption = { optionKey: "OPTION_A", title: "Reduce hammer curls", action: "DECREASE_VOLUME", deltaWeeklySets: -1,
  movementChanges: [{ movementPatternId: "curl", movementPatternName: "Hammer curl", deltaSets: -1 }], preferredExerciseType: "ISOLATION",
  placementPreference: "KEEP_CURRENT", rationale: "Supported monitored maintenance reduction", expectedBenefit: "Free capacity", mainRisk: "Observe preservation" };
const preview = previewT3Prescription(input, "arms", reduce, "MODERATE", "ABOVE_NEEDED_DOSE");
assert.deepEqual(preview.slots.map((row) => [row.before, row.after]), [[3, 2]], "Fixed template bounds no longer suppress a one-set trial");
assert.equal(preview.muscles.find((row) => row.muscleId === "arms")?.after, 2);
assert.equal(preview.muscles.find((row) => row.muscleId === "biceps")?.after, 1);
assert.equal(preview.weeklyPhysicalSetsRemoved, 1, "A replacement is one removed set, not three removed plus two added");
assert.equal(preview.weeklyPhysicalSetsAdded, 0);
assert.deepEqual(preview, previewT3Prescription(input, "arms", reduce, "MODERATE", "ABOVE_NEEDED_DOSE"), "Preview is deterministic for approval rechecks");
assert.deepEqual(parseMesocycleStructureOverrides(preview.structureOverrides), preview.structureOverrides);
assert.equal(readAppliedPreview({ appliedPreview: JSON.parse(JSON.stringify(preview)) })[0].implementationKind, "MESOCYCLE_STRUCTURE");

const persisted = structuredClone(input);
persisted.mesocycle!.structureOverrides = JSON.parse(JSON.stringify(preview.structureOverrides));
persisted.mesocycle!.volumeTargets[0].targetSets = 2;
persisted.mesocycle!.movementVolumeTargets = [{ movementGroupId: "curl", movementGroupName: "Hammer curl", sortOrder: 0, targetSets: 2 }];
const active = generate(persisted).items.filter((row) => !row.isMesocycleSuppressed && row.adjustedPlannedSets);
assert.equal(active.length, 1); assert.equal(active[0].adjustedPlannedSets, 2); assert.equal(active[0].sortOrder, 2);
const second = previewT3Prescription(persisted, "arms", reduce, "MODERATE", "ABOVE_NEEDED_DOSE");
assert.deepEqual(second.slots.map((row) => [row.before, row.after]), [[2, 1]], "Later T3 reviews can adjust an already approved structural dose");
const remove = { ...reduce, deltaWeeklySets: -2, movementChanges: [{ ...reduce.movementChanges[0], deltaSets: -2 }] };
const zero = previewT3Prescription(persisted, "arms", remove, "MODERATE", "ABOVE_NEEDED_DOSE");
assert.equal(zero.slots[0].after, 0, "A movement slot can be removed without editing the base template");
assert.equal(input.templateExercises[0].plannedSets, 3, "The input/base template is unchanged");

const typed = structuredClone(input); typed.templateExercises[0].setPlans = [{ setNumber: 3, setTypeId: "drop", multiplier: 1.5 }];
typed.mesocycle!.volumeTargets[0].targetSets = 3.5;
const typedPreview = previewT3Prescription(typed, "arms", reduce, "MODERATE", "ABOVE_NEEDED_DOSE");
assert.equal(typedPreview.muscles.find((row) => row.muscleId === "arms")?.before, 3.5);
assert.equal(typedPreview.muscles.find((row) => row.muscleId === "arms")?.after, 2, "The removed set's actual multiplier is counted");

const increase = { ...reduce, title: "Add", action: "INCREASE_VOLUME" as const, deltaWeeklySets: 1,
  movementChanges: [{ ...reduce.movementChanges[0], deltaSets: 1 }] };
assert.equal(previewT3Prescription(input, "arms", increase, "MODERATE", "BELOW_EXPECTED_RESPONSE").slots[0].after, 4, "Template max=3 is not a physiological coaching ceiling");
const absent = structuredClone(input); absent.templateExercises[0] = { ...slot, movementGroupId: "other", primaryMuscles: [], secondaryMuscles: [], exerciseId: "other", exerciseName: "Other", movementGroupName: "Other" };
absent.mesocycle!.volumeTargets[0].targetSets = 0;
const added = previewT3Prescription(absent, "arms", increase, "MODERATE", "BELOW_EXPECTED_RESPONSE");
assert.ok(added.slots.some((row) => row.exercise === "Hammer curl" && row.before === 0 && row.after === 1), "A compatible missing pattern can receive a new approved slot");
assert.equal(t3ExerciseType("Hammer curl"), "ISOLATION", "Biceps secondary contribution does not make curls compound exercises");
const broad = structuredClone(input); broad.templateExercises[0].plannedSets = 14; broad.templateExercises[0].minSets = 14; broad.templateExercises[0].maxSets = 14;
broad.mesocycle!.volumeTargets[0].targetSets = 14;
assert.equal(previewT3Prescription(broad, "arms", reduce, "MODERATE", "ABOVE_NEEDED_DOSE").slots[0].after, 13, "A sub-15-percent reduction is not swallowed by the old generator tolerance");
const full = structuredClone(input); full.templateExercises[0].plannedSets = 8; full.templateExercises[0].maxSets = 8; full.mesocycle!.volumeTargets[0].targetSets = 8;
assert.throws(() => previewT3Prescription(full, "arms", increase, "HIGH", "BELOW_EXPECTED_RESPONSE"), /discrete|legal/, "Do not duplicate the only available exercise or exceed the application limit");
const variation = structuredClone(full);
variation.movementDefaults!.push({ ...exercise, exerciseId: "cable-hammer", exerciseName: "Cable hammer curl" });
const expanded = previewT3Prescription(variation, "arms", increase, "HIGH", "BELOW_EXPECTED_RESPONSE");
assert.ok(expanded.slots.some((row) => row.exerciseId === "cable-hammer" && row.before === 0 && row.after === 1), "A distinct compatible exercise can supply a needed extra slot");
const empty = structuredClone(input); empty.templateExercises = []; empty.mesocycle!.volumeTargets[0].targetSets = 0;
assert.equal(previewT3Prescription(empty, "arms", increase, "MODERATE", "BELOW_EXPECTED_RESPONSE").slots[0].after, 1, "An empty but active template framework can receive a new slot");
const capacity = structuredClone(absent); capacity.templateExercises[0].plannedSets = 36;
assert.throws(() => previewT3Prescription(capacity, "arms", increase, "MODERATE", "BELOW_EXPECTED_RESPONSE"), /session capacity/);

const reallocation = structuredClone(input);
reallocation.templateExercises.push({ ...slot, id: "other-curl", exerciseId: "other-curl", exerciseName: "Cable curl", movementGroupId: "other-curl", movementGroupName: "Cable curl", plannedSets: 1 });
reallocation.movementDefaults!.push({ ...exercise, exerciseId: "other-curl", exerciseName: "Cable curl", movementGroupId: "other-curl", movementGroupName: "Cable curl" });
reallocation.mesocycle!.volumeTargets[0].targetSets = 4;
const moved = previewT3Prescription(reallocation, "arms", { ...reduce, action: "REALLOCATE_VOLUME", deltaWeeklySets: 0,
  movementChanges: [{ ...reduce.movementChanges[0], deltaSets: -1 }, { movementPatternId: "other-curl", movementPatternName: "Cable curl", deltaSets: 1 }] }, "MODERATE", "ABOVE_NEEDED_DOSE");
assert.equal(moved.weeklyPhysicalSetsAdded, 1); assert.equal(moved.weeklyPhysicalSetsRemoved, 1);
assert.equal(moved.muscles.length, 0, "A real source/destination reallocation can preserve effective muscle dose");

const independent = structuredClone(input);
independent.templateExercises.push({ ...slot, id: "leg-slot", exerciseId: "leg-curl", exerciseName: "Leg curl", movementGroupId: "leg-curl", movementGroupName: "Leg curl",
  sortOrder: 3, primaryMuscles: [{ muscleId: "hams", muscleName: "Hamstrings", sortOrder: 2 }], secondaryMuscles: [] });
independent.movementDefaults!.push({ ...exercise, exerciseId: "leg-curl", exerciseName: "Leg curl", movementGroupId: "leg-curl", movementGroupName: "Leg curl",
  primaryMuscles: [{ muscleId: "hams", muscleName: "Hamstrings", sortOrder: 2 }], secondaryMuscles: [] });
independent.mesocycle!.volumeTargets.push({ muscleId: "hams", muscleName: "Hamstrings", sortOrder: 2, targetSets: 3, explicitTarget: true });
const legOption = { ...reduce, movementChanges: [{ movementPatternId: "leg-curl", movementPatternName: "Leg curl", deltaSets: -1 }] };
const reviewedLeg = previewT3Prescription(independent, "hams", legOption, "MODERATE", "ABOVE_NEEDED_DOSE");
const approvedArms = previewT3Prescription(independent, "arms", reduce, "MODERATE", "ABOVE_NEEDED_DOSE");
independent.mesocycle!.structureOverrides = approvedArms.structureOverrides;
independent.mesocycle!.volumeTargets[0].targetSets = 2;
independent.mesocycle!.movementVolumeTargets = [{ movementGroupId: "curl", movementGroupName: "Hammer curl", sortOrder: 0, targetSets: 2 }];
const recheckedLeg = previewT3Prescription(independent, "hams", legOption, "MODERATE", "ABOVE_NEEDED_DOSE", reviewedLeg.slots);
assert.notDeepEqual(recheckedLeg.structureOverrides, reviewedLeg.structureOverrides, "Freshly merged overrides preserve the independently approved first option");
assert.equal(t3PreviewEffectsSignature(recheckedLeg), t3PreviewEffectsSignature(reviewedLeg), "Unchanged visible effects permit independent approvals without another AI call");
independent.templateExercises[1].plannedSets = 4;
assert.notEqual(t3PreviewEffectsSignature(previewT3Prescription(independent, "hams", legOption, "MODERATE", "ABOVE_NEEDED_DOSE", reviewedLeg.slots)),
  t3PreviewEffectsSignature(reviewedLeg), "A changed actual baseline requires a new review");

const distribution = structuredClone(absent);
distribution.templates!.push({ id: "b", name: "B", sequenceIndex: 1, expectedOccurrences: 1 });
distribution.templateExercises[0].plannedSets = 1;
distribution.templateExercises.push({ ...distribution.templateExercises[0], id: "other-b", templateId: "b", templateName: "B", templateSequenceIndex: 1, plannedSets: 2 });
const reviewedAddition = previewT3Prescription(distribution, "arms", increase, "MODERATE", "BELOW_EXPECTED_RESPONSE");
assert.equal(reviewedAddition.slots.find((row) => row.before === 0)?.templateId, "a");
distribution.templateExercises[0].plannedSets = 3;
const pinnedAddition = previewT3Prescription(distribution, "arms", increase, "MODERATE", "BELOW_EXPECTED_RESPONSE", reviewedAddition.slots);
assert.equal(pinnedAddition.slots.find((row) => row.before === 0)?.templateId, "a", "Keep the reviewed location when still feasible, even if relative session loads changed");
assert.equal(t3PreviewEffectsSignature(pinnedAddition), t3PreviewEffectsSignature(reviewedAddition));

const review: ProgrammingRecommendations = { globalSummary: "Approve the removed option", bodyCompositionContext: "Stable cut", assessments: [], decisions: [] };
assert.ok(!reconcileT3ApprovalSummary(review, true).includes("Approve the removed option"));
assert.match(reconcileT3ApprovalSummary(review, true), /No implementable changes/);
const partial = { ...review, decisions: [{ targetMuscleId: "arms", targetMuscleName: "Brachialis", decisionSummary: "Trial", confidence: "MODERATE" as const,
  evidence: [], options: [reduce], recommendedOptionKey: "OPTION_A" as const, keepAsIsRationale: "Keep" }] };
assert.match(reconcileT3ApprovalSummary(partial, true), /Reduce hammer curls/);
console.log("T3 structural implementation, persistence, effective work, template-limit bypass, zero slots and final approval guidance tests passed.");
