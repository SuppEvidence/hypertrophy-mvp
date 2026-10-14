import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { activeExerciseWhere, exerciseAccessWhere, exerciseArchivedWhere } from "../lib/server/exercise-catalog-policy";
const user = "a";
assert.deepEqual(exerciseAccessWhere(user), { OR: [{ userId: null }, { userId: user }] });
assert.deepEqual(activeExerciseWhere(user), { OR: [{ userId: null }, { userId: user }], isActive: true, isArchived: false, coachingProfiles: { none: { userId: user, isArchived: true } } });
assert.deepEqual(exerciseArchivedWhere(user), { OR: [{ isArchived: true }, { coachingProfiles: { some: { userId: user, isArchived: true } } }] });
const seed: { userId: string | null; isActive: boolean; isArchived: boolean; profiles: Array<{userId: string; isArchived: boolean}> } = { userId: null, isActive: true, isArchived: false, profiles: [{ userId: "a", isArchived: true }] };
const visible = (row: typeof seed, userId: string) => (row.userId === null || row.userId === userId) && row.isActive && !row.isArchived && !row.profiles.some((p) => p.userId === userId && p.isArchived);
assert.equal(visible(seed, "a"), false);
assert.equal(visible(seed, "b"), true, "One user's archive must not change another user's shared catalog");
assert.equal(visible({ ...seed, userId: "a", profiles: [] }, "b"), false);
assert.equal(visible({ ...seed, profiles: [{ userId: "a", isArchived: false }] }, "a"), true);
for (const file of ["prescriptions", "templates", "workouts", "pre-workout-coach", "weekly-coach", "ai-programming-decisions", "ai-mesocycle-recommendations", "secondary-contribution-assessment", "mesocycle-adjustments"]) {
  assert.ok(readFileSync(`lib/server/${file}.ts`, "utf8").includes("activeExerciseWhere(userId)"), `${file} uses the scoped active catalog`);
}
const actions = readFileSync("lib/server/exercises.ts", "utf8");
assert.ok(actions.includes('update: { isArchived: archived }'));
assert.ok(!actions.slice(actions.indexOf("async function setExerciseArchived")).includes("delete"));
assert.ok(!readFileSync("lib/server/coaching-evidence.ts", "utf8").includes("activeExerciseWhere"), "Historical coach evidence is not limited by catalog visibility");
const seedUpdate = readFileSync("prisma/seed.ts", "utf8").split("const saved = await prisma.exercise.upsert")[1]?.split("create:")[0];
assert.ok(seedUpdate && !seedUpdate.includes("isArchived: false"), "Reseeding must not unarchive existing records");
assert.ok(readFileSync("lib/server/exercise-choice-memory.ts", "utf8").includes("!item.exercise.coachingProfiles[0]?.isArchived"));
assert.ok(readFileSync("lib/server/workouts.ts", "utf8").includes("available.length !== plannedIds.length"), "Saved plans cannot start with archived choices");
console.log("Scoped archive/restore catalog, ownership, historical evidence, reseeding and stale saved plan guards passed.");
