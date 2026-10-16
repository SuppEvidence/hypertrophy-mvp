// In-memory DB and AI adapters: no database connection or paid request is made.
// Run: node scripts/test-exercise-mechanics-service.mjs
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { fixtureProfile } from "./test-exercise-mechanics";
import { getOpenAIClient } from "../lib/ai/openai";
const userId = "22222222-2222-4222-8222-222222222222";
const exerciseId = "33333333-3333-4333-8333-333333333333";
const muscleId = fixtureProfile.targets[0].muscleId;
let profile: Record<string, unknown> | undefined;
let modelOutput = fixtureProfile;
let mutateDuringAnalysis: (() => void) | undefined;
let calls = 0; let writes = 0; let lastRequest = "";
const exercise = { id: exerciseId, name: "Cable lateral", setupNotes: null as string | null, movementGroupId: "abduction",
  movementGroup: { name: "Abduction" }, isActive: true, isArchived: false,
  primaryMuscles: [{ muscleId, muscle: { name: "Side delts" } }], secondaryMuscles: [] };
const fake = {
  programMesocycle: { findFirst: async () => null },
  exercise: { findFirst: async (args: { where: Record<string, unknown>; include: { coachingProfiles: { where: { userId: string } } } }) => {
    assert.equal(args.where.id, exerciseId); assert.equal(args.include.coachingProfiles.where.userId, userId);
    assert.ok(JSON.stringify(args.where).includes(userId), "Exercise access is scoped");
    return { ...exercise, coachingProfiles: profile ? [{ ...profile }] : [] };
  } },
  muscle: { findMany: async () => [{ id: muscleId, name: "Side delts" }] },
  workoutSessionExercise: { findMany: async (args: { where: { session: { userId: string } } }) => { assert.equal(args.where.session.userId, userId); return []; } },
  exerciseCoachingProfile: {
    create: async ({ data }: { data: Record<string, unknown> }) => { assert.equal(profile, undefined); writes++; profile = { id: "profile", ...data }; return profile; },
    updateMany: async ({ where, data }: { where: { mechanicsRevision: number; userId: string }; data: Record<string, unknown> }) => {
      assert.equal(where.userId, userId);
      if (!profile || profile.mechanicsRevision !== where.mechanicsRevision) return { count: 0 };
      writes++; const revision = Number(profile.mechanicsRevision) + 1;
      profile = { ...profile, ...data, mechanicsRevision: revision };
      for (const key of ["mechanicsProfile", "mechanicsDraft"]) if (profile[key] === Prisma.DbNull) profile[key] = null;
      return { count: 1 };
    },
  },
  $transaction: async (fn: (tx: unknown) => Promise<void>, opts: { isolationLevel: string }) => { assert.equal(opts.isolationLevel, "Serializable"); await fn(fake); },
};
async function main() {
  process.env.DATABASE_URL = "postgresql://localhost:5432/test_unused";
  process.env.OPENAI_API_KEY = "test-unused-not-a-real-key";
  (globalThis as unknown as { prisma: unknown }).prisma = fake;
  const client = getOpenAIClient();
  (client.responses as unknown as { parse: (input: unknown) => Promise<unknown> }).parse = async input => {
    calls++; const serialized = JSON.stringify(input); lastRequest = serialized;
    assert.ok(serialized.includes('"store":false')); assert.ok(serialized.includes("exercise_mechanics"));
    mutateDuringAnalysis?.(); return { output_parsed: modelOutput, status: "completed" };
  };
  const { runExerciseMechanicsCoach: run } = await import("../lib/server/exercise-mechanics-coach");
  await run(userId, exerciseId, { operation: "ANALYZE", revision: 0 });
  assert.equal(profile?.mechanicsRevision, 1); assert.ok(profile?.mechanicsDraft); assert.equal(profile?.mechanicsProfile, undefined);
  await run(userId, exerciseId, { operation: "ACCEPT", revision: 1 });
  assert.equal(calls, 1, "Acceptance never calls AI"); assert.equal(profile?.mechanicsRevision, 2);
  const accepted = profile?.mechanicsProfile; assert.ok(accepted);
  assert.equal((profile?.appliedClassification as {source:string}).source,"COACH");
  assert.equal(profile?.classificationSyncedRevision,2);
  await run(userId, exerciseId, { operation: "ANALYZE", revision: 2, setup: "Low pulley" });
  assert.deepEqual(profile?.mechanicsProfile, accepted, "New proposals preserve accepted profile");
  await run(userId, exerciseId, { operation: "DISCARD", revision: 3 }); assert.equal(profile?.mechanicsDraft, null);
  await assert.rejects(run(userId, exerciseId, { operation: "ANALYZE", revision: 1 }), /Profile changed/);
  const baselineWrites = writes;
  modelOutput = { ...fixtureProfile, targets: [{ ...fixtureProfile.targets[0], muscleId: "44444444-4444-4444-8444-444444444444" }] };
  const beforeRepair = { ...profile };
  const beforeRepairCalls = calls;
  await run(userId, exerciseId, { operation: "ANALYZE", revision: 4 });
  const repaired = profile!.mechanicsDraft as { profile: typeof fixtureProfile };
  assert.equal(repaired.profile.targets[0].muscleId, muscleId, "Exact name repairs an unknown ID without a second AI call");
  assert.equal(calls, beforeRepairCalls + 1);
  profile = beforeRepair; writes = baselineWrites;
  modelOutput = { ...fixtureProfile, targets: [{ ...fixtureProfile.targets[0], muscleName: "Unlisted target", muscleId: null }] };
  await run(userId, exerciseId, { operation: "ANALYZE", revision: 4 });
  assert.equal((profile!.mechanicsDraft as { profile: typeof fixtureProfile }).profile.targets[0].muscleId, null);
  assert.equal((profile!.mechanicsDraft as { profile: typeof fixtureProfile }).profile.summary, fixtureProfile.summary);
  profile = beforeRepair; writes = baselineWrites;
  modelOutput = fixtureProfile; mutateDuringAnalysis = () => { exercise.setupNotes = "Changed during AI"; };
  await assert.rejects(run(userId, exerciseId, { operation: "ANALYZE", revision: 4 }), /Exercise changed/);
  assert.equal(writes, baselineWrites); exercise.setupNotes = null;
  mutateDuringAnalysis = () => { profile!.mechanicsRevision = 5; };
  await assert.rejects(run(userId, exerciseId, { operation: "ANALYZE", revision: 4 }), /Profile changed/);
  assert.equal(writes, baselineWrites); mutateDuringAnalysis = undefined;
  exercise.isArchived = true;
  await assert.rejects(run(userId, exerciseId, { operation: "ANALYZE", revision: 5 }), /Restore/);
  exercise.isArchived = false;
  mutateDuringAnalysis = undefined;
  modelOutput = { ...fixtureProfile, observedExecution: ["Observed shoulder abduction"] };
  await assert.rejects(run(userId, exerciseId, { operation: "ANALYZE", revision: 5 }), /without video/);
  const frames = [1, 2, 3, 4].map(seconds => ({ seconds, image: "data:image/jpeg;base64,/9j/2Q==" }));
  await assert.rejects(run(userId, exerciseId, { operation: "ANALYZE", revision: 5, frames: frames.slice(0, 3) }), /at least four/);
  await run(userId, exerciseId, { operation: "ANALYZE", revision: 5, frames });
  assert.equal((profile?.mechanicsDraft as { source: string }).source, "VIDEO_FRAMES");
  // Simulate the already-deployed video envelope, which had no provenance/history fields.
  delete (profile!.mechanicsDraft as Record<string, unknown>).videoEvidence;
  const originalVideo = JSON.parse(JSON.stringify(profile!.mechanicsDraft));
  const callsBefore = calls;
  modelOutput = { ...fixtureProfile, summary: "The pulley position is now clarified.", questions: [], observedExecution: ["Invented fresh observation"] };
  await run(userId, exerciseId, { operation: "CLARIFY", revision: 6, clarification: "The pulley is at floor level." });
  const refined = profile!.mechanicsDraft as typeof originalVideo;
  assert.equal(calls, callsBefore + 1, "Clarifying uses exactly one explicit text request");
  assert.equal(lastRequest.includes('"input_image"'), false, "Refinement never resends images");
  assert.ok(lastRequest.includes("previousAnalysis")); assert.ok(lastRequest.includes("Observed shoulder abduction"));
  assert.ok(lastRequest.includes("What is the pulley height?"));
  assert.equal(refined.source, "VIDEO_FRAMES");
  assert.deepEqual(refined.profile.observedExecution, originalVideo.profile.observedExecution, "Saved observations cannot be erased or replaced by model text");
  assert.equal(refined.videoEvidence.assessedAt, originalVideo.assessedAt);
  assert.deepEqual(refined.videoEvidence.profile, originalVideo.profile, "Full original analysis remains available for review");
  assert.equal(refined.clarifications[0].answer, "The pulley is at floor level.");
  assert.deepEqual(refined.clarifications[0].questions, originalVideo.profile.questions);
  assert.deepEqual(refined.profile.questions, [], "Resolved questions are removed from the new proposal");
  assert.equal(profile!.mechanicsProfile, accepted, "Clarification does not auto-accept");
  await run(userId, exerciseId, { operation: "ACCEPT", revision: 7 });
  assert.equal(calls, callsBefore + 1, "Acceptance does not call AI");
  const acceptedVideo = profile!.mechanicsProfile;
  await run(userId, exerciseId, { operation: "CLARIFY", revision: 8, clarification: "The cable starts slightly behind my torso." });
  const twice = profile!.mechanicsDraft as typeof originalVideo;
  assert.equal(twice.clarifications.length, 2);
  assert.ok(lastRequest.includes("The pulley is at floor level."), "Earlier answers reach later refinements");
  assert.equal(twice.videoEvidence.assessedAt, originalVideo.assessedAt);
  assert.deepEqual(twice.videoEvidence.profile, originalVideo.profile);
  assert.deepEqual(twice.profile.observedExecution, originalVideo.profile.observedExecution);
  const safeCalls = calls;
  await assert.rejects(run(userId, exerciseId, { operation: "ANALYZE", revision: 9, setup: "Only an answer" }), /Use Answer/);
  assert.equal(calls, safeCalls, "Description-only replacement is blocked before any AI call");
  await assert.rejects(run(userId, exerciseId, { operation: "CLARIFY", revision: 9, clarification: "Answer", frames }), /without new video/);
  await assert.rejects(run(userId, exerciseId, { operation: "CLARIFY", revision: 9, clarification: "Answer", setup: "changed" }), /saved setup/);
  exercise.setupNotes = "Different machine geometry";
  await assert.rejects(run(userId, exerciseId, { operation: "CLARIFY", revision: 9, clarification: "Answer" }), /outdated/);
  exercise.setupNotes = null;
  const savedDraft = profile!.mechanicsDraft;
  mutateDuringAnalysis = () => { throw new Error("Provider failed"); };
  await assert.rejects(run(userId, exerciseId, { operation: "CLARIFY", revision: 9, clarification: "Answer" }), /Provider failed/);
  assert.equal(profile!.mechanicsDraft, savedDraft); assert.equal(profile!.mechanicsProfile, acceptedVideo);
  mutateDuringAnalysis = undefined;
  await run(userId, exerciseId, { operation: "CLEAR", revision: 9 }); assert.equal(profile?.mechanicsProfile, null);
  assert.equal(profile?.mechanicsRevision, 10);
  console.log("Exercise coach proposal/accept/discard/clear, ownership, archive, catalog validation and concurrent edit guards passed.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
