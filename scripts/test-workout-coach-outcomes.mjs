import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let set;
let outcome;
globalThis.__outcomeTest = {
  workoutSet: { findFirst: async () => set },
  workoutCoachAction: {
    findMany: async () => [{ id: "a", appliedState: { targetSetIds: ["target"], prescription: { suggestedLoad: 77.5, minReps: 8, maxReps: 12, targetRir: 1 } }, triggerSet: { painFlag: false } }],
    update: async ({ data }) => { outcome = data.outcome; },
  },
};
const compiled = await build({ entryPoints: ["lib/server/workout-coach-outcomes.ts"], bundle: true,
  write: false, platform: "node", format: "cjs", packages: "external", plugins: [{ name: "mock-db", setup(b) {
    b.onResolve({ filter: /^@\/lib\/db\/prisma$/ }, () => ({ path: "db", namespace: "mock" }));
    b.onLoad({ filter: /.*/, namespace: "mock" }, () => ({ contents: "export const prisma = globalThis.__outcomeTest;", loader: "js" }));
  } }] });
const testModule = { exports: {} };
new Function("require", "module", "exports", compiled.outputFiles[0].text)(require, testModule, testModule.exports);
let checks = 0;
async function check(name, patch, expected) {
  set = { id: "target", sessionExerciseId: "slot", setNumber: 2, isCompleted: true,
    weight: 77.5, reps: 10, rir: 1, painFlag: false, intensifierDetails: {}, sessionExercise: { painFlag: false }, ...patch };
  await testModule.exports.evaluatePendingWorkoutCoachActionsForSet({ userId: "owner", setId: set.id });
  assert.equal(outcome.classification, expected);
  assert.equal(outcome.causalBenefitEstablished, false);
  checks++; console.log(`PASS ${name}`);
}
await check("targets met is not causal benefit", {}, "TARGETS_MET");
await check("different performed load is inconclusive", { weight: 80 }, "INCONCLUSIVE");
await check("missing observed RIR is inconclusive", { rir: null }, "INCONCLUSIVE");
await check("compromised execution is inconclusive", { intensifierDetails: { executionCompromised: true } }, "INCONCLUSIVE");
await check("pain has separate classification", { painFlag: true }, "PAIN_REPORTED");
await check("missed targets are recorded", { reps: 5 }, "TARGETS_MISSED");
await check("unchecking completion invalidates attainment", { isCompleted: false }, "INCONCLUSIVE");
console.log(`${checks} outcome checks passed.`);
