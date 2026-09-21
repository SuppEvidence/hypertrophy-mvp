// Offline integration tests: real engine, mocked database/provider. No credentials or paid API calls.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const { Prisma } = require("@prisma/client");
const compiled = await build({ entryPoints: ["lib/server/workout-coach-engine.ts"], bundle: true,
  write: false, platform: "node", format: "cjs", packages: "external", plugins: [{ name: "offline-dependencies", setup(b) {
    b.onResolve({ filter: /^(server-only|@\/lib\/db\/prisma|@\/lib\/ai\/openai|@\/lib\/server\/live-coaching-context)$/ }, args => ({ path: args.path, namespace: "mock" }));
    b.onLoad({ filter: /.*/, namespace: "mock" }, args => ({ contents: args.path === "server-only" ? "" :
      args.path.endsWith("prisma") ? "export const prisma = globalThis.__coachTest.prisma;" :
      args.path.endsWith("openai") ? "export const getOpenAIClient = () => globalThis.__coachTest.client; export const getOpenAIModel = () => 'test-model';" :
      "export const buildLiveExerciseCoachingContext = (...args) => globalThis.__coachTest.context(...args);", loader: "js" }));
  } }] });

let state;
let calls;
let decision;
let onModel;
const clone = value => structuredClone(value);
const now = () => new Date();
function reset() {
  const updatedAt = now();
  const prescription = { original: { minReps: 8, maxReps: 12, targetRir: 1 }, current: { minReps: 8, maxReps: 12, targetRir: 1 } };
  const sets = [1, 2, 3].map(n => ({ id: `s${n}`, setNumber: n, setTypeId: "straight", setType: { isIntensifier: false },
    isCompleted: n === 1, weight: n === 1 ? 80 : null, reps: n === 1 ? 6 : null, rir: n === 1 ? 0 : 1,
    startedAt: null, endedAt: null, updatedAt, prescription: clone(prescription), painFlag: false }));
  state = { exercise: { id: "slot", sessionId: "session", userId: "owner", status: "DRAFT", exerciseId: "exercise", updatedAt,
    exercise: { name: "Machine press", minimumWeightIncrement: 2.5 },
    prescribedMinReps: 8, prescribedMaxReps: 12, sets }, actions: [] };
  calls = 0;
  decision = { action: "ADJUST", confidence: "MODERATE", reason: "Reduce load slightly.", suggestedLoad: 77.5, minReps: null, maxReps: null, targetRir: null };
  onModel = null;
}
function hydrate(action) {
  return action ? { ...clone(action), triggerSet: clone(state.exercise.sets.find(s => s.id === action.triggerSetId)), sessionExercise: clone(state.exercise) } : null;
}
const actionMatches = (a, w) => (!w.id || typeof w.id !== "string" || a.id === w.id) && (!w.userId || a.userId === w.userId) &&
  (!w.status || typeof w.status !== "string" || a.status === w.status) && (!w.session || state.exercise.status === w.session.status);
const prisma = {
  workoutSessionExercise: {
    findFirst: async ({ where }) => where.id === state.exercise.id && where.sessionId === state.exercise.sessionId &&
      where.session.userId === state.exercise.userId && where.session.status === state.exercise.status ? clone(state.exercise) : null,
    update: async ({ data }) => Object.assign(state.exercise, data),
  },
  workoutCoachAction: {
    findUnique: async ({ where }) => clone(state.actions.find(a => a.triggerSetId === where.triggerSetId) ?? null),
    findFirst: async ({ where }) => hydrate(state.actions.find(a => actionMatches(a, where)) ?? null),
    findMany: async () => [],
    create: async ({ data }) => {
      if (state.actions.some(a => a.triggerSetId === data.triggerSetId)) throw new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" });
      const action = { ...clone(data), id: `a${state.actions.length + 1}`, createdAt: now(), status: "PROPOSED" };
      state.actions.push(action); return clone(action);
    },
    update: async ({ where, data }) => clone(Object.assign(state.actions.find(a => a.id === where.id), data)),
    updateMany: async ({ where, data }) => {
      const rows = state.actions.filter(a => actionMatches(a, where) && (!where.createdAt || a.createdAt < where.createdAt.lt));
      rows.forEach(a => Object.assign(a, data)); return { count: rows.length };
    },
  },
  workoutSet: {
    updateMany: async ({ where, data }) => {
      const s = state.exercise.sets.find(s => s.id === where.id && !s.startedAt && !s.isCompleted && +s.updatedAt === +where.updatedAt);
      if (s) Object.assign(s, clone(data), { updatedAt: now() }); return { count: s ? 1 : 0 };
    },
    deleteMany: async ({ where }) => {
      const s = state.exercise.sets.find(s => s.id === where.id && !s.startedAt && !s.isCompleted && +s.updatedAt === +where.updatedAt);
      if (s) state.exercise.sets = state.exercise.sets.filter(s => s.id !== where.id); return { count: s ? 1 : 0 };
    },
  },
  $queryRaw: async () => [],
  $transaction: async fn => { const before = clone(state); try { return await fn(prisma); } catch (error) { state = before; throw error; } },
};
globalThis.__coachTest = { prisma, client: { responses: { parse: async () => {
  calls++; if (onModel) await onModel(); return { output_parsed: clone(decision), usage: { total_tokens: 20 } };
} } }, context: async () => {
  const sets = state.exercise.sets.filter(s => s.isCompleted).map(s => ({ id: s.id, setNumber: s.setNumber, weight: s.weight,
    reps: s.reps, rir: s.rir, setTypeId: s.setTypeId, isIntensifier: false, pain: s.painFlag, executionCompromised: false }));
  return { eligibility: { shouldCheck: true }, exercise: { name: "Machine press", pain: false }, currentSets: sets,
    history: { exposures: Array.from({ length: 5 }, () => [{ ...sets[0], reps: 10, rir: 1 }]) } };
} };
const testModule = { exports: {} };
new Function("require", "module", "exports", "__filename", "__dirname", compiled.outputFiles[0].text)(require, testModule, testModule.exports, path.resolve("coach-test.cjs"), process.cwd());
const { runLiveWorkoutCoach, applyCoachActionForUser } = testModule.exports;
const input = { sessionId: "session", sessionExerciseId: "slot", triggerSetId: "s1" };
let checks = 0;
async function check(name, fn) { reset(); await fn(); checks++; console.log(`PASS ${name}`); }

await check("automatic adjustment changes prescription, never observed values", async () => {
  const result = await runLiveWorkoutCoach("owner", input);
  assert.equal(calls, 1); assert.equal(result.action.status, "APPLIED");
  assert.equal(state.exercise.sets[1].prescription.current.suggestedLoad, 77.5);
  assert.equal(state.exercise.sets[1].weight, null); assert.equal(state.exercise.sets[1].reps, null);
  assert.equal(state.exercise.sets[1].prescription.original.targetRir, 1);
  assert.equal(state.exercise.sets[2].prescription.current.suggestedLoad, undefined);
});
await check("cross-user requests do not access coach", async () => {
  await runLiveWorkoutCoach("other", input); assert.equal(calls, 0); assert.equal(state.actions.length, 0);
});
await check("single-set exercise makes no model call", async () => {
  state.exercise.sets = state.exercise.sets.slice(0, 1); await runLiveWorkoutCoach("owner", input); assert.equal(calls, 0);
});
await check("completed session makes no model call", async () => {
  state.exercise.status = "COMPLETED"; await runLiveWorkoutCoach("owner", input); assert.equal(calls, 0);
});
await check("normal targets and history make no model call", async () => {
  state.exercise.sets[0].reps = 10; state.exercise.sets[0].rir = 1;
  await runLiveWorkoutCoach("owner", input); assert.equal(calls, 0);
});
await check("concurrent duplicate triggers make at most one model call", async () => {
  await Promise.all([runLiveWorkoutCoach("owner", input), runLiveWorkoutCoach("owner", input)]);
  assert.equal(calls, 1); assert.equal(state.actions.length, 1);
});
await check("started next set discards late model response", async () => {
  onModel = () => { state.exercise.sets[1].startedAt = now(); };
  const result = await runLiveWorkoutCoach("owner", input);
  assert.equal(result.action, null); assert.equal(state.actions[0].status, "SUPERSEDED");
  assert.equal(state.exercise.sets[1].prescription.current.suggestedLoad, undefined);
});
await check("edited trigger discards late model response", async () => {
  onModel = () => { state.exercise.sets[0].updatedAt = new Date(Date.now() + 1000); };
  assert.equal((await runLiveWorkoutCoach("owner", input)).action, null);
});
await check("finished session discards late model response", async () => {
  onModel = () => { state.exercise.status = "COMPLETED"; };
  assert.equal((await runLiveWorkoutCoach("owner", input)).action, null);
});
await check("provider failure leaves targets unchanged and no automatic retry", async () => {
  onModel = () => { throw new Error("offline provider"); };
  assert.equal((await runLiveWorkoutCoach("owner", input)).unavailable, true);
  await runLiveWorkoutCoach("owner", input); assert.equal(calls, 1);
});
await check("invalid large adjustment does not mutate prescription", async () => {
  decision.suggestedLoad = 50;
  assert.equal((await runLiveWorkoutCoach("owner", input)).action, null);
  assert.equal(state.exercise.sets[1].prescription.current.suggestedLoad, undefined);
});
await check("unconfigured increment prevents automatic load changes", async () => {
  state.exercise.exercise.minimumWeightIncrement = null;
  assert.equal((await runLiveWorkoutCoach("owner", input)).action, null);
  assert.equal(state.exercise.sets[1].prescription.current.suggestedLoad, undefined);
});
await check("load outside configured increment is rejected", async () => {
  decision.suggestedLoad = 76;
  assert.equal((await runLiveWorkoutCoach("owner", input)).action, null);
});
await check("removal remains proposed until explicitly approved", async () => {
  decision.action = "REMOVE_SET"; decision.suggestedLoad = null;
  const result = await runLiveWorkoutCoach("owner", input);
  assert.equal(result.action.status, "PROPOSED"); assert.equal(state.exercise.sets.length, 3);
  assert.equal((await applyCoachActionForUser("owner", result.action.id, false)).ok, false);
  assert.equal((await applyCoachActionForUser("owner", result.action.id, true)).ok, true);
  assert.equal(state.exercise.sets.length, 2); assert.equal(state.exercise.prescribedPlannedSets, 2);
  assert.equal(state.actions[0].outcome.classification, "INCONCLUSIVE");
});
await check("another user cannot approve removal", async () => {
  decision.action = "REMOVE_SET";
  const result = await runLiveWorkoutCoach("owner", input);
  assert.equal((await applyCoachActionForUser("other", result.action.id, true)).ok, false);
  assert.equal(state.exercise.sets.length, 3);
});
await check("started target cannot be removed after approval delay", async () => {
  decision.action = "REMOVE_SET";
  const result = await runLiveWorkoutCoach("owner", input);
  state.exercise.sets[2].startedAt = now();
  assert.equal((await applyCoachActionForUser("owner", result.action.id, true)).ok, false);
  assert.equal(state.exercise.sets.length, 3);
});
await check("stop exercise preserves completed trigger", async () => {
  decision.action = "STOP_EXERCISE";
  const result = await runLiveWorkoutCoach("owner", input);
  assert.equal(state.exercise.sets.length, 3);
  await applyCoachActionForUser("owner", result.action.id, true);
  assert.deepEqual(state.exercise.sets.map(s => s.id), ["s1"]);
});
console.log(`${checks} offline engine checks passed. Database/provider concurrency is mocked, not a live database test.`);
