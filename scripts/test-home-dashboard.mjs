import assert from "node:assert/strict";
import { build } from "esbuild";
import Module from "node:module";
import path from "node:path";
import fs from "node:fs";
const result = await build({
  stdin: {
    contents: `export * from './lib/server/home-dashboard'; export * from './lib/dashboard/overview'; export { HomeDashboard } from './components/dashboard/HomeDashboard';`,
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  packages: "external",
  metafile: true,
  jsx: "automatic",
  plugins: [
    {
      name: "read-only-boundaries",
      setup(b) {
        b.onResolve(
          { filter: /^(@\/lib\/db\/prisma|server-only|next\/link)$/ },
          ({ path }) => ({ path, namespace: "mock" }),
        );
        b.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({
          contents:
            path === "server-only"
              ? ""
              : path === "next/link"
                ? `import React from 'react'; export default function Link({prefetch,...props}) { if(prefetch!==false) throw Error('Home links must not prefetch'); return React.createElement('a',props); }`
                : "export const prisma = globalThis.__homePrisma;",
          loader: "js",
          resolveDir: process.cwd(),
        }));
      },
    },
  ],
});
assert(
  !Object.keys(result.metafile.inputs).some((p) =>
    /lib\/(ai\/|server\/(workouts|templates|nutrition-coach|automatic-coaching))/.test(
      p,
    ),
  ),
  "Home must not load AI/write orchestration",
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const now = new Date("2026-10-17T09:00:00Z");
let state = {};
let calls = [];
globalThis.__homePrisma = new Proxy(
  {},
  {
    get: (_, model) =>
      new Proxy(
        {},
        {
          get: (_, method) => async (args) => {
            assert(
              ["findFirst", "findMany", "findUnique", "count"].includes(method),
              `Unexpected write ${model}.${method}`,
            );
            assert.equal(
              args.where.userId ?? args.where.OR?.find((x) => x.userId)?.userId,
              "user",
              `${model} must be scoped`,
            );
            calls.push([model, method, args]);
            if (model === "metricLog")
              return method === "findMany"
                ? (state.metrics ?? [])
                : (state.latest ?? null);
            if (model === "workoutSession")
              return method === "findFirst"
                ? (state.draft ?? null)
                : args.where.status
                  ? (state.recent ?? [])
                  : (state.sessions ?? []);
            if (model === "programMesocycle")
              return method === "findMany"
                ? (state.blocks ?? [])
                : (state.review ?? null);
            if (model === "aiProgrammingDecision")
              return state.pendingVolume ?? 0;
            return state[model] ?? (method === "findMany" ? [] : null);
          },
        },
      ),
  },
);
const filename = path.resolve("scripts/home-dashboard-test.cjs");
const mod = new Module(filename);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(path.dirname(filename));
mod._compile(result.outputFiles[0].text, filename);
const {
  getHomeDashboardData,
  workoutHero,
  metricOverview,
  blockStatus,
  HomeDashboard,
} = mod.exports;
const empty = await getHomeDashboardData("user", now);
assert.equal(empty.hero.kind, "SETUP");
assert.equal(empty.nutrition.configured, false);
const program = {
  id: id(1),
  name: "Balanced growth",
  rotationStyle: "FIXED_SEQUENCE",
  rotationSequence: null,
  weeklyPlan: null,
  templates: [
    { id: id(2), name: "Upper A", sequenceIndex: 0, weekday: null },
    { id: id(3), name: "Lower A", sequenceIndex: 1, weekday: null },
  ],
};
const workout = {
  id: id(4),
  date: "2026-10-17",
  templateId: id(3),
  durationMinutes: 55,
  rationale: "Recovery spacing",
  items: [
    {
      sourceSlotId: "slot",
      exerciseId: id(5),
      sets: 2,
      setTypeIds: [id(6), id(6)],
      reason: "Quad focus",
    },
  ],
};
const block = {
  id: id(7),
  name: "Autumn growth",
  phase: "PUSH",
  startDate: new Date("2026-09-14T00:00Z"),
  lengthWeeks: 6,
  actualEndDate: null,
  t3EvaluationStatus: "COMPLETE",
  t3LastEvaluatedAt: now,
  musclePriorities: [
    { priority: "SPECIALIZE", muscle: { name: "Lateral delts" } },
    { priority: "GROW", muscle: { name: "Upper chest" } },
  ],
};
state = {
  program,
  programMesocycle: null,
  blocks: [block],
  review: {
    t3Assessment: {
      generationId: "generation-current",
      globalSummary:
        "Maintain the accepted volume while assessing performance.",
    },
    aiRecommendation: null,
    aiRecommendedAt: null,
  },
  pendingVolume: 2,
  mesocycleDesign: { id: id(10), updatedAt: now },
  energyPhase: [{ phase: "CUTTING", startDate: new Date("2026-09-01T00:00Z") }],
  nutritionState: { draft: null, requestToken: null, requestStartedAt: null },
  nutritionEvent: {
    kind: "ACCEPTED",
    createdAt: new Date("2026-10-03T09:00Z"),
    details: {
      summary: "Add 25 g carbs to the meal before training.",
      reviewDueOn: "2026-10-17",
      reviewCriteria: "Review weight trend, visuals and training performance.",
    },
  },
  physiqueCheckin: {
    takenOn: new Date("2026-10-01T00:00Z"),
    analysisDraft: null,
    _count: { photos: 6 },
  },
  weeklyCoachPlan: {
    status: "APPROVED",
    proposal: {
      version: "W1",
      weekStart: "2026-10-12",
      summary: "Saved weekly plan",
      workouts: [workout],
    },
    allocation: null,
    missedIds: [],
    mesocycleId: id(7),
    unallocated: 0,
  },
  exercise: [{ id: id(5) }],
  metrics: [
    { loggedAt: now, bodyweight: 74.2, waist: 721 },
    { loggedAt: new Date("2026-10-16T06:00Z"), bodyweight: 74.4, waist: 722 },
    { loggedAt: new Date("2026-10-09T06:00Z"), bodyweight: 74.7, waist: 725 },
    { loggedAt: new Date("2026-10-08T06:00Z"), bodyweight: 74.9, waist: 726 },
  ],
  latest: { loggedAt: now, bodyweight: 74.2, waist: 721 },
};
let data = await getHomeDashboardData("user", now);
assert.equal(data.hero.kind, "WEEKLY");
assert(data.hero.href.includes(`occurrenceId=${id(4)}`));
assert.equal(data.hero.title, "Lower A");
assert.equal(data.physique.dueOn, "2026-10-15");
assert.equal(data.physique.intervalDays, 14);
assert(data.actions.some((a) => a.id === "nutrition-due"));
assert.equal(data.metrics.bodyweight.days, 2);
assert(
  calls.some(
    ([m, , a]) =>
      m === "aiProgrammingDecision" &&
      a.where.generationId === "generation-current",
  ),
);
const render = mod.require("react-dom/server").renderToStaticMarkup;
const React = mod.require("react");
const html = render(React.createElement(HomeDashboard, { data }));
assert(html.includes("Nutrition &amp; phase"));
assert(html.includes("For review"));
if (process.env.HOME_QA_DIR) {
  fs.mkdirSync(process.env.HOME_QA_DIR, { recursive: true });
  fs.writeFileSync(path.join(process.env.HOME_QA_DIR, "populated.html"), html);
  fs.writeFileSync(
    path.join(process.env.HOME_QA_DIR, "empty.html"),
    render(React.createElement(HomeDashboard, { data: empty })),
  );
}
state.exercise = [];
assert.equal((await getHomeDashboardData("user", now)).hero.kind, "REVIEW");
state.draft = {
  id: id(8),
  name: "Saved upper session",
  programId: program.id,
  performedAt: now,
};
assert.equal((await getHomeDashboardData("user", now)).hero.kind, "RESUME");
state.draft = null;
state.exercise = [{ id: id(5) }];
state.sessions = [
  { status: "COMPLETED", prescriptionSummary: { weeklyOccurrenceId: id(4) } },
];
assert.equal((await getHomeDashboardData("user", now)).hero.kind, "REST");
state.weeklyCoachPlan.status = "PROPOSED";
assert(
  (await getHomeDashboardData("user", now)).actions.some(
    (a) => a.id === "weekly-draft",
  ),
);
state.nutritionEvent = {
  kind: "BASELINE",
  createdAt: now,
  details: { summary: "Baseline changed" },
};
assert.equal((await getHomeDashboardData("user", now)).nutrition.dueOn, null);
state.program = null;
data = await getHomeDashboardData("user", now);
assert.equal(data.hero.kind, "SETUP");
assert.equal(data.physique.intervalDays, 14);
assert.equal(data.nutrition.configured, true);
state.energyPhase = [
  { phase: "GAINING", startDate: new Date("2026-09-01T00:00Z") },
];
state.userSettings = {
  physiqueTrainingLevel: "LATE_INTERMEDIATE_ADVANCED",
  physiqueGainWeeks: 12,
  physiqueMaintenanceWeeks: 6,
};
assert.equal(
  (await getHomeDashboardData("user", now)).physique.intervalDays,
  84,
);
state.userSettings.physiqueTrainingLevel = "BEGINNER_MID_INTERMEDIATE";
assert.equal(
  (await getHomeDashboardData("user", now)).physique.intervalDays,
  28,
);
assert.equal(blockStatus(block, "2026-10-26").status, "Completed");
assert.equal(blockStatus(block, "2026-09-01").status, "Upcoming");
assert.equal(
  workoutHero({
    today: "2026-10-17",
    program: { ...program, rotationStyle: "WEEKDAY_BASED" },
    draft: null,
    week: null,
    completed: [],
  }).kind,
  "REST",
);
const point = (date, weight) => ({
  loggedAt: new Date(date),
  bodyweight: weight,
  waist: null,
});
const sparse = metricOverview(
  [
    point("2026-10-16T23:00Z", 74),
    point("2026-10-17T05:00Z", 75),
    point("2026-10-18T05:00Z", 99),
    point("2026-10-09T05:00Z", 76),
  ],
  "bodyweight",
  null,
  now,
);
assert.equal(sparse.days, 1);
assert.equal(sparse.average, 75);
assert.equal(sparse.change, null);
assert.equal(
  metricOverview([], "bodyweight", point("2026-09-01T05:00Z", 76), now)
    .latestOn,
  "2026-09-01",
);
console.log(
  "Home dashboard: read-only boundaries, user scoping, weekly recovery, saved coaching reminders, phase cadence, sparse metrics and rendering passed.",
);
