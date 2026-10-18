import assert from "node:assert/strict";
import { build } from "esbuild";
import Module from "node:module";
import path from "node:path";
const now = new Date("2026-10-16T15:00:00Z");
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const workout = (n) => ({
  id: uid(n),
  date: "2026-10-16",
  templateId: uid(10),
  durationMinutes: 50,
  rationale: "",
  items: [
    {
      sourceSlotId: "slot",
      exerciseId: uid(20),
      sets: 1,
      setTypeIds: [uid(30)],
      reason: "",
    },
  ],
});
const proposal = {
  version: "W1",
  weekStart: "2026-10-12",
  summary: "",
  workouts: [workout(1), workout(2)],
};
let record = null,
  sessions = [],
  calls = [];
globalThis.__weeklyAccessDB = {
  weeklyCoachPlan: {
    findFirst: async (args) => {
      assert.deepEqual(args.where, {
        userId: "user",
        programId: "program",
        weekStart: new Date("2026-10-12T00:00Z"),
        status: "APPROVED",
      });
      calls.push("plan");
      return record;
    },
  },
  workoutSession: {
    findMany: async (args) => {
      assert.equal(args.where.userId, "user");
      assert.equal(args.where.programId, "program");
      assert.equal(args.where.status, "COMPLETED");
      assert.equal(
        args.where.performedAt.gte.toISOString(),
        "2026-10-11T21:00:00.000Z",
      );
      assert.equal(
        args.where.performedAt.lt.toISOString(),
        "2026-10-18T21:00:00.000Z",
      );
      assert.equal(args.where.performedAt.lte, now);
      calls.push("sessions");
      return sessions;
    },
  },
};
const result = await build({
  stdin: {
    contents: "export * from './lib/server/weekly-planner-access';",
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  packages: "external",
  metafile: true,
  plugins: [
    {
      name: "read-boundaries",
      setup(b) {
        b.onResolve(
          { filter: /^(server-only|@\/lib\/db\/prisma)$/ },
          ({ path }) => ({ path, namespace: "mock" }),
        );
        b.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({
          contents:
            path === "server-only"
              ? ""
              : "export const prisma = globalThis.__weeklyAccessDB;",
          loader: "js",
        }));
      },
    },
  ],
});
assert(
  !Object.keys(result.metafile.inputs).some((p) =>
    /lib\/ai\/|weekly-coach.ts|prescriptions.ts/.test(p),
  ),
  "Access check must not invoke coaching or prescriptions",
);
const filename = path.resolve("scripts/weekly-access-test.cjs");
const mod = new Module(filename);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(path.dirname(filename));
mod._compile(result.outputFiles[0].text, filename);
const get = () => mod.exports.getWeeklyPlannerAccess("user", "program", now);
assert.equal(
  (await get()).nextAvailable,
  false,
  "No approved week does not unlock early",
);
record = { proposal, allocation: null };
assert.equal((await get()).nextAvailable, false, "No completed sessions");
sessions = [
  { prescriptionSummary: { weeklyOccurrenceId: uid(1) } },
  { prescriptionSummary: { weeklyOccurrenceId: uid(1) } },
  { prescriptionSummary: { weeklyOccurrenceId: uid(99) } },
  { prescriptionSummary: {} },
];
assert.equal(
  (await get()).nextAvailable,
  false,
  "Duplicates/unrelated/manual sessions cannot substitute for a remaining occurrence",
);
sessions.push({ prescriptionSummary: { weeklyOccurrenceId: uid(2) } });
let access = await get();
assert.equal(access.nextAvailable, true);
assert.equal(access.defaultWeek, "2026-10-19");
assert.equal(access.currentWeekCompleted, true);
record = {
  proposal,
  allocation: { ...proposal, workouts: [...proposal.workouts, workout(3)] },
};
assert.equal(
  (await get()).nextAvailable,
  false,
  "Latest approved allocation must be fully completed",
);
record = {
  proposal: { ...proposal, weekStart: "2026-10-05" },
  allocation: null,
};
assert.equal(
  (await get()).nextAvailable,
  false,
  "Stale proposal cannot unlock",
);
record = { proposal, allocation: { ...proposal, weekStart: "2026-10-05" } };
assert.equal(
  (await get()).nextAvailable,
  false,
  "Stale allocation cannot unlock",
);
record = { proposal: { broken: true }, allocation: null };
assert.equal(
  (await get()).nextAvailable,
  false,
  "Invalid saved plan cannot unlock",
);
calls = [];
access = await mod.exports.getWeeklyPlannerAccess(
  "user",
  "program",
  new Date("2026-10-18T09:00:00Z"),
);
assert.equal(access.nextAvailable, true);
assert.deepEqual(calls, [], "Calendar fallback needs no completion reads");
console.log(
  "Weekly planner access: scoped approved allocation, completed occurrence IDs, duplicate isolation, invalid data, calendar fallback and no AI dependencies passed.",
);
