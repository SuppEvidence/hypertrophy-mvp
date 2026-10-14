import assert from "node:assert/strict";
import { exerciseMechanicsSchema, mechanicsBasis, summarizeExerciseMechanics, executionAnalysisInputSchema,
  validateMechanicsTargets, type MechanicsEnvelope } from "../lib/coaching/exercise-mechanics";
const muscleId = "11111111-1111-4111-8111-111111111111";
const statement = { description: "Setup-dependent inference.", confidence: "LOW" as const };
export const fixtureProfile = exerciseMechanicsSchema.parse({ summary: "Lateral raise with setup-dependent resistance.",
  targets: [{ muscleId, muscleName: "Side delts", role: "PRIMARY", region: "lateral deltoid", rationale: "Shoulder abduction.", confidence: "MEDIUM" }],
  movement: statement, resistanceProfile: { ...statement, peak: "UNKNOWN" }, muscleLengthExposure: statement,
  stabilityAndFatigue: statement, setTypeSuitability: statement, observedExecution: [], techniqueAdvice: [],
  questions: ["What is the pulley height?"], limitations: ["Machine geometry is not established."] });
const exercise = { name: "Cable lateral", movementGroupId: "abduction", setupNotes: null,
  primaryMuscles: [{ muscleId }], secondaryMuscles: [] };
const basis = mechanicsBasis(exercise, null);
const envelope: MechanicsEnvelope = { version: 1, source: "DESCRIPTION", model: "test", assessedAt: new Date().toISOString(),
  acceptedAt: null, basis, profile: fixtureProfile };
assert.equal(summarizeExerciseMechanics(envelope, basis), null, "Drafts cannot influence coaching");
const accepted = { ...envelope, acceptedAt: new Date().toISOString() };
assert.equal(summarizeExerciseMechanics(accepted, basis)?.status, "ACCEPTED");
for (const changed of [{ ...exercise, name: "Different machine" }, { ...exercise, setupNotes: "Different angle" },
  { ...exercise, primaryMuscles: [] }, { ...exercise, movementGroupId: "other" }]) {
  assert.equal(summarizeExerciseMechanics(accepted, mechanicsBasis(changed, null))?.status, "STALE");
}
assert.equal(summarizeExerciseMechanics(accepted, mechanicsBasis(exercise, "New pulley position"))?.status, "STALE");
assert.equal(summarizeExerciseMechanics({ ...accepted, version: 2 }, basis), null);
assert.throws(() => validateMechanicsTargets(fixtureProfile, new Set()), /outside the catalog/);
assert.throws(() => validateMechanicsTargets({ ...fixtureProfile, targets: [...fixtureProfile.targets, ...fixtureProfile.targets] }, new Set([muscleId])), /duplicate/);
assert.equal(executionAnalysisInputSchema.safeParse({ operation: "ANALYZE", revision: 0, frames: [{ seconds: 1, image: "https://internal.invalid" }] }).success, false);
assert.equal(executionAnalysisInputSchema.safeParse({ operation: "ANALYZE", revision: -1 }).success, false);
console.log("Accepted-only context, setup/classification staleness, valid target IDs, and bounded media inputs passed.");
