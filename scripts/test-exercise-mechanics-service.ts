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
let calls = 0; let writes = 0;
const exercise = { id: exerciseId, name: "Cable lateral", setupNotes: null as string | null, movementGroupId: "abduction",
  movementGroup: { name: "Abduction" }, isActive: true, isArchived: false,
  primaryMuscles: [{ muscleId, muscle: { name: "Side delts" } }], secondaryMuscles: [] };
const fake = {
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
    calls++; const serialized = JSON.stringify(input);
    assert.ok(serialized.includes('"store":false')); assert.ok(serialized.includes("exercise_mechanics"));
    mutateDuringAnalysis?.(); return { output_parsed: modelOutput, status: "completed" };
  };
  const { runExerciseMechanicsCoach: run } = await import("../lib/server/exercise-mechanics-coach");
  await run(userId, exerciseId, { operation: "ANALYZE", revision: 0 });
  assert.equal(profile?.mechanicsRevision, 1); assert.ok(profile?.mechanicsDraft); assert.equal(profile?.mechanicsProfile, undefined);
  await run(userId, exerciseId, { operation: "ACCEPT", revision: 1 });
  assert.equal(calls, 1, "Acceptance never calls AI"); assert.equal(profile?.mechanicsRevision, 2);
  const accepted = profile?.mechanicsProfile; assert.ok(accepted);
  await run(userId, exerciseId, { operation: "ANALYZE", revision: 2, setup: "Low pulley" });
  assert.deepEqual(profile?.mechanicsProfile, accepted, "New proposals preserve accepted profile");
  await run(userId, exerciseId, { operation: "DISCARD", revision: 3 }); assert.equal(profile?.mechanicsDraft, null);
  await assert.rejects(run(userId, exerciseId, { operation: "ANALYZE", revision: 1 }), /Profile changed/);
  const baselineWrites = writes;
  modelOutput = { ...fixtureProfile, targets: [{ ...fixtureProfile.targets[0], muscleId: "44444444-4444-4444-8444-444444444444" }] };
  await assert.rejects(run(userId, exerciseId, { operation: "ANALYZE", revision: 4 }), /outside the catalog/);
  assert.equal(writes, baselineWrites);
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
  await run(userId, exerciseId, { operation: "CLEAR", revision: 6 }); assert.equal(profile?.mechanicsProfile, null);
  assert.equal(profile?.mechanicsRevision, 7);
  console.log("Exercise coach proposal/accept/discard/clear, ownership, archive, catalog validation and concurrent edit guards passed.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
