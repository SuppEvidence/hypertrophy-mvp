import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { summarizeWeeklySetTypeEvidence } from "../lib/coaching/weekly-set-type-evidence";
import { weeklyIntroducibleSetTypes } from "../lib/coaching/weekly-set-types";
import { validateWeeklyCoachPlan, WeeklyCoachPlanSchema } from "../lib/coaching/weekly-coach-policy";
import { carryForwardWeek, applyWeeklyCoachDelta } from "../lib/coaching/weekly-coach-continuity";
import type { ToleranceExposure } from "../lib/coaching/exposure-tolerance";

const id = (n: number) => `${String(n).padStart(8, "0")}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;
const [exercise, day, template, normal, edt] = [1, 2, 3, 4, 5].map(id);
const types = [{ id: normal, name: "Normal", slug: "normal", isIntensifier: false, multiplier: 1 },
  { id: edt, name: "EDTx3", slug: "edt-x3", isIntensifier: false, multiplier: 3 }];
const choices = weeklyIntroducibleSetTypes([{ id: exercise, movementGroupName: "Lateral raise", primaryMuscleIds: ["delts"],
  secondaryMuscleIds: ["traps"], intensifierPreference: "NONE" }], types);
assert.deepEqual(choices[exercise], [normal, edt], "High multiplier, secondary muscle and preference do not hard-block a user-reviewed format");
const plan = WeeklyCoachPlanSchema.parse({ version: "W1", weekStart: "2026-10-12", summary: "",
  workouts: [{ id: day, date: "2026-10-12", templateId: template, durationMinutes: 20, estimatedMinutes: 27,
    rationale: "Time tradeoff for approval", items: [{ sourceSlotId: `exercise:${exercise}`, exerciseId: exercise,
      sets: 1, setTypeIds: [edt], reason: "Previously productive density work" }] }] });
const exercises = [{ id: exercise, movementGroupId: template, primaryMuscleIds: ["delts"], secondaryMuscles: [{ muscleId: "traps", fraction: .25 }], avoided: false }];
const input = { weekStart: plan.weekStart, availability: [{ date: "2026-10-12", minutes: 20 }], templateIds: [template], candidates: [],
  exercises, regularSetTypeIds: [normal], multipliers: { [normal]: 1, [edt]: 3 } };
assert.equal(validateWeeklyCoachPlan(plan, input).ok, true, "Time estimate overrun is reviewable, not a generic time formula rejection");
const unknown = structuredClone(plan); unknown.workouts[0].items[0].setTypeIds = [id(8)];
assert.equal(validateWeeklyCoachPlan(unknown, input).ok, false, "Unknown catalog IDs remain invalid");
const mismatched = structuredClone(plan); mismatched.workouts[0].items[0].sets = 2;
assert.equal(validateWeeklyCoachPlan(mismatched, input).ok, false, "Every physical set still needs a type");
const dense = structuredClone(plan);
dense.workouts[0].items = Array.from({ length: 2 }, (_, i) => ({ ...plan.workouts[0].items[0],
  sourceSlotId: `exercise:${id(20 + i)}`, exerciseId: id(20 + i), sets: 8, setTypeIds: Array(8).fill(normal) }));
const denseExercises = dense.workouts[0].items.map((item) => ({ ...exercises[0], id: item.exerciseId, primaryMuscleIds: [item.exerciseId], secondaryMuscles: [] }));
assert.equal(validateWeeklyCoachPlan(dense, { ...input, exercises: denseExercises }).ok, true,
  "A 20-minute proposal is reviewed using its estimate, not automatically cut by the old physical-set formula");
const carry = carryForwardWeek({ previous: plan, weekStart: "2026-10-19", availability: [{ id: day, date: "2026-10-19", minutes: 30 }],
  templates: [template], candidates: [], exercises, regularSetTypeIds: [normal], introducibleSetTypeIdsByExercise: choices, actual: [], missedIds: [] })!;
assert.deepEqual(carry.workouts[0].items[0].setTypeIds, [edt], "Carry-forward must preserve the accepted EDT format");
assert.equal(carry.workouts[0].estimatedMinutes, 27);
const changed = applyWeeklyCoachDelta(carry, { version: "WD1", weekStart: carry.weekStart, summary: "",
  changes: [{ date: carry.workouts[0].date, templateId: template, rationale: "", estimatedMinutes: 18, items: carry.workouts[0].items }] })!;
assert.equal(changed.workouts[0].estimatedMinutes, 18);
const row: ToleranceExposure = { exerciseId: exercise, painFlag: false,
  exercise: { name: "Cable lateral", movementGroupId: template, primaryMuscles: [{ muscleId: "delts" }], secondaryMuscles: [] },
  session: { performedAt: new Date("2026-10-10") },
  sets: [{ weight: 10, reps: 24, rir: 1, painFlag: false, intensifierDetails: { clusterCount: 3 }, setType: types[1] }] };
const timer = (seconds: number, filmed = false) => ({ startedAt: new Date("2026-10-10T10:00:00Z"),
  endedAt: new Date(Date.parse("2026-10-10T10:00:00Z") + seconds * 1000), intensifierDetails: { filmed }, setType: { slug: "edt-x3" } });
const evidence = summarizeWeeklySetTypeEvidence([row], [{ exerciseId: exercise, sets: [timer(120), timer(180), timer(999, true), timer(-3), timer(4000)] }]);
assert.equal(evidence[0].formats[0].activeSecondsMedian, 150);
assert.equal(evidence[0].formats[0].timingSamples, 2, "Filmed, reversed and interrupted outlier timers are excluded");
assert.deepEqual(evidence[0].formats[0].clusterCounts, [3]);
assert.equal(evidence[0].formats[0].meanEffectiveMultiplier, 3);
assert.equal(summarizeWeeklySetTypeEvidence([row])[0].formats[0].activeSecondsMedian, null, "Absent timing is unknown");
const duplicates = Array.from({ length: 12 }, (_, i) => ({ ...row, session: { performedAt: new Date(Date.UTC(2026, 9, i + 1)) } }));
assert.equal(summarizeWeeklySetTypeEvidence(duplicates)[0].formats[0].exposures, 6, "History payload is bounded and uses the latest exposures");
const source = readFileSync("lib/server/weekly-coach.ts", "utf8");
assert.ok(source.includes("summarizeWeeklySetTypeEvidence"));
assert.ok(source.includes("preferredSetTypeIds"));
assert.ok(!source.includes("normalizeWeeklySetTypes"), "No silent format substitution before dose accounting");
assert.equal((source.match(/responses\.parse\(/g) ?? []).length, 1, "One planning AI call; no extra format analysis request");
console.log("Unrestricted reviewed formats, EDT carry-forward, bounded protocol/timing evidence and honest time estimates passed.");
