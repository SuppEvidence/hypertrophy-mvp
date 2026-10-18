import assert from "node:assert/strict";
import { build } from "esbuild";
import Module from "node:module";
import path from "node:path";
const mocks = {
  "@/lib/server/effective-exercise-data":
    "export const getUserExercisePrisma = () => globalThis.__t3DB;",
  "@/lib/db/prisma": "export const prisma = globalThis.__t3DB;",
  "@/lib/auth/user": 'export const requireUserId = async () => "user";',
  "@/lib/server/prescriptions":
    "export const buildProgramPrescription = async () => globalThis.__t3Prescription;",
  "@/lib/ai/openai":
    'export const getOpenAIClient = () => { throw Error("Unexpected AI call during decision acceptance"); };',
  "next/cache": "export const revalidatePath = () => {};",
  "server-only": "",
};
const result = await build({
  stdin: {
    contents: `export { getCurrentProgrammingDecisionPreviews, selectProgrammingDecisionAction } from './lib/server/ai-programming-decisions'; export * from './scripts/test-t3-decision-refresh'; export { generateMesocyclePrescriptionWithQuickOverrides as generate } from './lib/planning/mesocycleQuickOverrides'; export { t3PreviewEffectsSignature, previewT3Prescription } from './lib/coaching/t3-prescription-preview';`,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  packages: "external",
  plugins: [
    {
      name: "boundaries",
      setup(b) {
        b.onResolve({ filter: /.*/ }, ({ path }) =>
          Object.hasOwn(mocks, path) ? { path, namespace: "mock" } : undefined,
        );
        b.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({
          contents: mocks[path],
          loader: "js",
        }));
      },
    },
  ],
});
const now = new Date();
const generation = "generation-1";
let optionState = "PENDING",
  writes = 0,
  forceRace = false;
const assessment = (id) => ({
  muscleId: id,
  muscleName: id,
  priority: "GROW",
  status: "RECOVERABILITY_CONCERN",
  confidence: "MODERATE",
  recommendedRangeMinimum: 2,
  recommendedRangeMaximum: 12,
  rationale: "Observe response",
  evidence: ["Repeated exposure evidence"],
});
const priorities = [
  {
    id: "priority-chest",
    muscleId: "chest",
    priority: "GROW",
    coachTargetWeeklySets: 3,
    rangeMinimumSets: 2,
    rangeMaximumSets: 12,
  },
  {
    id: "priority-triceps",
    muscleId: "triceps",
    priority: "GROW",
    coachTargetWeeklySets: 8,
    rangeMinimumSets: 2,
    rangeMaximumSets: 12,
  },
];
let decision, source, block, lastOutcome, lastIntervention, lastTarget;
globalThis.__t3DB = {
  program: { findFirst: async () => ({ id: "program" }) },
  programMesocycle: {
    findFirst: async () => block,
    updateMany: async () => {
      return { count: forceRace ? 0 : 1 };
    },
    update: async () => {
      writes++;
    },
  },
  aiProgrammingDecision: {
    findFirst: async (args) =>
      args.where.id ? { ...decision, status: optionState } : { id: source.id },
    findMany: async (args) => {
      assert.equal(args.where.userId, "user");
      assert.equal(args.where.mesocycleId, "block");
      return args.where.generationId
        ? [{ ...decision, status: optionState }, source]
        : [source];
    },
    updateMany: async (args) => {
      assert.equal(args.where.status, "PENDING");
      if (optionState !== "PENDING") return { count: 0 };
      optionState = "SELECTED";
      lastOutcome = args.data.outcome;
      writes++;
      return { count: 1 };
    },
  },
  mesocycleMusclePriority: {
    findUnique: async () => priorities[1],
    update: async (args) => {
      lastTarget = args.data.coachTargetWeeklySets;
      writes++;
    },
  },
  mesocycleMovementVolumeTarget: {
    upsert: async () => {
      writes++;
    },
  },
  coachingIntervention: {
    create: async (args) => {
      lastIntervention = args.data;
      writes++;
    },
  },
  $transaction: async (fn) => fn(globalThis.__t3DB),
};
const filename = path.resolve("scripts/t3-refresh-actions.cjs");
const mod = new Module(filename);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(path.dirname(filename));
mod._compile(result.outputFiles[0].text, filename);
const api = mod.exports;
const current = api.afterAcceptance();
globalThis.__t3Prescription = {
  generationInput: current,
  generated: api.generate(current),
};
block = {
  programId: "program",
  startDate: new Date(now.getTime() - 7 * 86400000),
  lengthWeeks: 8,
  updatedAt: now,
  t3Assessment: {
    generationId: generation,
    assessments: [assessment("chest"), assessment("triceps")],
  },
  musclePriorities: priorities,
};
decision = {
  id: "decision-triceps",
  generationId: generation,
  mesocycleId: "block",
  targetMuscleId: "triceps",
  options: [api.tricepsOption],
  context: {
    assessment: assessment("triceps"),
    optionPreviews: { OPTION_A: api.reviewed },
  },
};
source = {
  id: "decision-chest",
  generationId: generation,
  mesocycleId: "block",
  targetMuscleId: "chest",
  status: "SELECTED",
  selectedOptionKey: "OPTION_A",
  selectedAt: now,
  options: [api.reduce],
  outcome: { appliedPreview: api.accepted, appliedOption: api.reduce },
  context: { assessment: assessment("chest") },
};
let refreshed = await api.getCurrentProgrammingDecisionPreviews(
  "block",
  generation,
);
assert.equal(refreshed[decision.id].OPTION_A.status, "READY");
assert.equal(refreshed[decision.id].OPTION_A.option.deltaWeeklySets, -1);
assert.equal(writes, 0, "Viewing remaining cards must perform no writes");
const form = (signature) => {
  const f = new FormData();
  f.set("decisionId", decision.id);
  f.set("selectionKey", "OPTION_A");
  f.set("previewSignature", signature);
  return f;
};
await assert.rejects(
  () =>
    api.selectProgrammingDecisionAction(
      form(api.t3PreviewEffectsSignature(api.reviewed)),
    ),
  /Refresh the volume page/,
);
assert.equal(writes, 0, "Stale screen must not write");
forceRace = true;
await assert.rejects(
  () =>
    api.selectProgrammingDecisionAction(
      form(
        api.t3PreviewEffectsSignature(refreshed[decision.id].OPTION_A.preview),
      ),
    ),
  /block changed/,
);
assert.equal(writes, 0, "Concurrent changes abort before prescription writes");
forceRace = false;
await api.selectProgrammingDecisionAction(
  form(api.t3PreviewEffectsSignature(refreshed[decision.id].OPTION_A.preview)),
);
assert.equal(optionState, "SELECTED");
assert.equal(lastOutcome.appliedOption.deltaWeeklySets, -1);
assert.equal(
  lastTarget,
  6,
  "Approved coach target accounts for compound work already removed",
);
assert.equal(
  lastIntervention.proposal.selectedOption.deltaWeeklySets,
  -1,
  "Coaching history records the actual remaining change",
);
const completedWrites = writes;
await assert.rejects(
  () => api.selectProgrammingDecisionAction(form("stale")),
  /no longer pending/,
);
assert.equal(writes, completedWrites, "Duplicate approval cannot apply twice");
optionState = "PENDING";
block.t3Assessment.generationId = "generation-2";
await assert.rejects(
  () => api.selectProgrammingDecisionAction(form("old")),
  /newer volume review/,
);
assert.equal(writes, completedWrites);
console.log(
  "T3 action integration: live previews, no view writes/AI, stale-screen rejection, race guard, overlapping remainder approval, actual target/history, duplicate and newer-generation guards passed.",
);

// An already-covered option can be explicitly accepted without another set edit.
block.t3Assessment.generationId = generation;
optionState = "PENDING";
const oneStep = {
  ...api.tricepsOption,
  deltaWeeklySets: -1,
  movementChanges: api.tricepsOption.movementChanges.map((row) => ({
    ...row,
    deltaSets: -1,
  })),
};
decision.options = [oneStep];
decision.context.optionPreviews.OPTION_A = api.previewT3Prescription(
  api.input,
  "triceps",
  oneStep,
  "MODERATE",
  "RECOVERABILITY_CONCERN",
);
refreshed = await api.getCurrentProgrammingDecisionPreviews(
  "block",
  generation,
);
assert.equal(refreshed[decision.id].OPTION_A.status, "SATISFIED");
assert.equal(refreshed[decision.id].OPTION_A.coveredDose, 7);
const coveredForm = new FormData();
coveredForm.set("decisionId", decision.id);
coveredForm.set("selectionKey", "KEEP_AS_IS");
coveredForm.set("coveredOptionKey", "OPTION_A");
coveredForm.set("coveredDose", "6");
await assert.rejects(
  () => api.selectProgrammingDecisionAction(coveredForm),
  /current dose changed/,
);
coveredForm.set("coveredDose", "7");
await api.selectProgrammingDecisionAction(coveredForm);
assert.equal(
  lastTarget,
  7,
  "Explicit covered-dose acceptance aligns the approved target with the accepted prescription",
);
assert.equal(lastOutcome.coveredDose, 7);
assert.equal(lastOutcome.appliedOption.deltaWeeklySets, 0);
assert.equal(lastIntervention.status, "ACCEPTED");
assert.equal(
  lastIntervention.proposal.appliedPreview,
  null,
  "No additional physical change is applied",
);
console.log(
  "Covered-dose acceptance updates the coach target/history without an additional set change.",
);
