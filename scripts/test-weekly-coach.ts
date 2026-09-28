import assert from "node:assert/strict";
import { validateWeeklyCoachPlan, weeklyExerciseIssues, type WeeklyCoachPlan } from "../lib/coaching/weekly-coach-policy";
import { reallocateMissedWeeklyWork } from "../lib/coaching/weekly-coach-runtime";
import { coachedWeek, helsinkiDate } from "../lib/coaching/weekly-coach-calendar";
import { completedWeekBaseline } from "../lib/coaching/weekly-coach-baseline";
import { applyWeeklyCoachDelta, carryForwardWeek } from "../lib/coaching/weekly-coach-continuity";
import { regularWeeklySetTypeIds, weeklyIntroducibleSetTypes } from "../lib/coaching/weekly-set-types";

const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const c = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const template = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const exercise = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const type = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const day = (id: string, date: string, sets: number) => ({ id, date, templateId: template, durationMinutes: 60,
  rationale: "A session of the recurring full-body template", items: [{ sourceSlotId: "slot-1", exerciseId: exercise, sets, setTypeIds: Array(sets).fill(type), reason: "Quad work" }] });
const plan: WeeklyCoachPlan = { version: "W1", weekStart: "2026-09-28", summary: "Three full-body sessions", workouts: [
  day(a, "2026-09-28", 3), day(b, "2026-09-30", 3), day(c, "2026-10-02", 3),
] };
const evidence = { weekStart: plan.weekStart, availability: plan.workouts.map((workout) => ({ date: workout.date, minutes: 60 })),
  templateIds: [template], candidates: [{ id: "slot-1", templateId: template, movementGroupId: "quads", exerciseId: exercise, sets: 3,
    setTypeIds: [type, type, type], primaryMuscleIds: ["quads"], secondaryMuscles: [] }],
  exercises: [{ id: exercise, movementGroupId: "quads", primaryMuscleIds: ["quads"], secondaryMuscles: [], avoided: false }],
  regularSetTypeIds: [type], multipliers: { [type]: 1 } };
assert.equal(validateWeeklyCoachPlan(plan, evidence).ok, true);
const drop = "11111111-1111-4111-8111-111111111111";
const edt = "22222222-2222-4222-8222-222222222222";
const kinds = [
  { id: type, name: "Regular", slug: "regular", multiplier: 1, isIntensifier: false },
  { id: drop, name: "Drop set", slug: "drop-set", multiplier: 1.25, isIntensifier: true },
  { id: edt, name: "EDT", slug: "edt", multiplier: 1, isIntensifier: false },
];
const lateral = { id: exercise, movementGroupName: "Lateral raise", primaryMuscleIds: ["side-delts"],
  secondaryMuscleIds: [], preference: "NEUTRAL" as const, intensifierPreference: "DEFAULT" as const, allowedIntensifierIds: [] };
const eligible = weeklyIntroducibleSetTypes([lateral], kinds);
assert.deepEqual(eligible[exercise], [drop], "EDT needs explicit per-exercise selection, even if categorized as a base type");
assert.deepEqual(regularWeeklySetTypeIds(kinds), [type], "EDT should not be counted as a regular set");
const intensifierEvidence = { ...evidence, introducibleSetTypeIdsByExercise: eligible,
  multipliers: { [type]: 1, [drop]: 1.25, [edt]: 1 } };
const withDrop: WeeklyCoachPlan = { ...plan, workouts: plan.workouts.map((row, index) => index ? row : {
  ...row, items: [{ ...row.items[0], setTypeIds: [type, type, drop] }],
}) };
assert.equal(validateWeeklyCoachPlan(withDrop, intensifierEvidence).ok, true);
const tooMany = { ...withDrop, workouts: withDrop.workouts.map((row, index) => index ? row : {
  ...row, items: [{ ...row.items[0], setTypeIds: [type, drop, drop] }],
}) };
assert.match(validateWeeklyCoachPlan(tooMany, intensifierEvidence).errors.join(" "), /at most one new intensifier/);
assert.equal(validateWeeklyCoachPlan(withDrop, evidence).ok, false, "Unapproved intensifiers cannot be introduced");
assert.deepEqual(weeklyIntroducibleSetTypes([{ ...lateral, movementGroupName: "Squat" }], kinds)[exercise], []);
assert.deepEqual(weeklyIntroducibleSetTypes([{ ...lateral, intensifierPreference: "NONE" }], kinds)[exercise], []);
assert.deepEqual(weeklyIntroducibleSetTypes([{ ...lateral, intensifierPreference: "ONLY_SELECTED", allowedIntensifierIds: [edt] }], kinds)[exercise], [edt]);
const carriedIntensity = carryForwardWeek({ previous: withDrop, weekStart: "2026-10-05",
  availability: [{ id: a, date: "2026-10-05", minutes: 60 }], templates: [template],
  candidates: evidence.candidates, exercises: evidence.exercises,
  regularSetTypeIds: [type], introducibleSetTypeIdsByExercise: eligible, missedIds: [],
  actual: [{ occurrenceId: a, items: [{ exerciseId: exercise, sourceSlotId: "slot-1", setTypeIds: [type, type, drop] }] }] });
assert.deepEqual(carriedIntensity?.workouts[0].items[0].setTypeIds, [type, type, drop]);
assert.equal(validateWeeklyCoachPlan(carriedIntensity!, { ...intensifierEvidence, weekStart: "2026-10-05",
  availability: [{ date: "2026-10-05", minutes: 60 }] }).ok, true);
const carry = carryForwardWeek({ previous: plan, weekStart: "2026-10-05",
  availability: [{ id: a, date: "2026-10-05", minutes: 60 }, { id: b, date: "2026-10-07", minutes: 60 }],
  templates: [template], candidates: evidence.candidates, exercises: evidence.exercises,
  regularSetTypeIds: [type], missedIds: [], actual: [{ occurrenceId: a,
    items: [{ exerciseId: exercise, sourceSlotId: "slot-1", setTypeIds: [type, type] }] }] });
assert.ok(carry);
assert.equal(carry.workouts[0].items[0].sets, 2, "Reuse actual completed work rather than last week's proposed set count");
assert.equal(carry.workouts[1].items[0].sets, 3, "Reuse the accepted Wednesday structure when it was not completed");
const changed = applyWeeklyCoachDelta(carry, { version: "WD1", weekStart: carry.weekStart, summary: "Progress warrants a small trial",
  changes: [{ date: "2026-10-07", templateId: template, rationale: "Modest increase", items: [{ ...carry.workouts[1].items[0], sets: 4,
    setTypeIds: [type, type, type, type] }] }] });
assert.equal(changed?.workouts[0].items[0].sets, 2, "An unchanged day must remain fixed");
assert.equal(changed?.workouts[1].items[0].sets, 4);
assert.equal(applyWeeklyCoachDelta(carry, { version: "WD1", weekStart: carry.weekStart, summary: "Invalid",
  changes: [{ date: "2026-10-10", templateId: template, rationale: "Unknown date", items: carry.workouts[0].items }] }), null);
assert.equal(carryForwardWeek({ previous: plan, weekStart: "2026-10-05",
  availability: [{ id: a, date: "2026-10-05", minutes: 60 }], templates: [template], candidates: evidence.candidates,
  exercises: evidence.exercises, regularSetTypeIds: [type], missedIds: [], actual: [] }), null);
const mislabeledOriginal = { ...evidence, candidates: [{ ...evidence.candidates[0], movementGroupId: "programmed-pattern" }] };
assert.equal(validateWeeklyCoachPlan(plan, mislabeledOriginal).ok, true,
  "Keeping the exercise already in a slot must work even if its template movement label differs");
const wrongExercise = { ...plan, workouts: [{ ...plan.workouts[0], items: [{ ...plan.workouts[0].items[0], exerciseId: b }] }, ...plan.workouts.slice(1)] };
const wrongEvidence = { ...evidence, exercises: [...evidence.exercises, { ...evidence.exercises[0], id: b, name: "Chest fly", movementGroupId: "chest" }] };
assert.match(validateWeeklyCoachPlan(wrongExercise, wrongEvidence).errors[0], /Chest fly.*slot/,
  "A different movement in a template slot should identify the exact exercise");
assert.match(validateWeeklyCoachPlan(wrongExercise, evidence).errors[0], /unavailable/);
assert.equal(validateWeeklyCoachPlan(wrongExercise, { ...evidence, allowUnavailableDraft: true }).ok, true,
  "A missing exercise can be shown in a reviewable draft");
assert.equal(weeklyExerciseIssues(wrongExercise, evidence.exercises)[0].kind, "UNAVAILABLE");
const avoidedExercise = { ...evidence.exercises[0], avoided: true, name: "User avoided exercise" };
const avoidedEvidence = { ...evidence, exercises: [avoidedExercise] };
assert.match(validateWeeklyCoachPlan(plan, avoidedEvidence).errors[0], /marked Avoid/);
assert.equal(weeklyExerciseIssues(plan, avoidedEvidence.exercises).length, 3);
assert.equal(validateWeeklyCoachPlan(plan, { ...avoidedEvidence, allowAvoidedExerciseIds: [exercise] }).ok, true,
  "An active avoided exercise needs an explicit override before approval");
assert.equal(validateWeeklyCoachPlan(plan, { ...evidence, completedMuscles: [{ quads: 58 }] }).ok, false,
  "Completed work must count toward the whole-week dose ceiling");
assert.equal(validateWeeklyCoachPlan(plan, { ...evidence, completedMuscles: [{ quads: 12 }], priorities: { quads: "MAINTAIN" } }).ok, true,
  "An already completed high-volume exposure cannot be undone by rejecting all future plans");
assert.equal(validateWeeklyCoachPlan(plan, { ...evidence, excludedDates: ["2026-09-28"] }).ok, false,
  "A completed day must not be returned as a new workout");
assert.equal(validateWeeklyCoachPlan({ ...plan, workouts: [plan.workouts[0], plan.workouts[0], plan.workouts[2]] }, evidence).ok, false);

assert.equal(helsinkiDate(new Date("2026-09-27T22:30:00Z")), "2026-09-28");
assert.equal(coachedWeek(new Date("2026-09-27T22:30:00Z")).weekStart, "2026-09-28");
assert.equal(coachedWeek(new Date("2026-03-23T12:00:00Z")).end.toISOString(), "2026-03-29T21:00:00.000Z",
  "Helsinki week boundaries must follow the daylight saving transition");
const logged = [{ id: a, templateId: template, performedAt: new Date("2026-09-28T07:00:00Z"), exercises: [{ id: c, exerciseId: exercise, painFlag: false,
  exercise: { movementGroupId: "quads", primaryMuscles: [{ muscleId: "quads" }], secondaryMuscles: [] },
  sets: [{ id: b, isCompleted: true, setTypeId: type, setType: { multiplier: 1.5 }, weight: 60, reps: 10, rir: 1, painFlag: false }] }] }];
const credited = completedWeekBaseline(logged);
assert.equal(credited.sessions[0].muscles.quads, 1.5);
assert.equal(credited.sessions[0].physicalSets, 1);
assert.notEqual(credited.signature, completedWeekBaseline([{ ...logged[0], exercises: [{ ...logged[0].exercises[0],
  sets: [{ ...logged[0].exercises[0].sets[0], reps: 9 }] }] }]).signature,
  "Approval must reject a changed completed set");

const first = reallocateMissedWeeklyWork(plan, [a], [], new Map([[exercise, "quads"]]), new Set([type]));
assert.equal(first.unallocatedSets, 0);
assert.equal(first.workouts[1].items[0].sets, 5);
assert.equal(first.workouts[2].items[0].sets, 4);
assert.equal(first.workouts[1].items[0].setTypeIds.length, 5);
const second = reallocateMissedWeeklyWork({ ...plan, workouts: first.workouts }, [b], [], new Map([[exercise, "quads"]]), new Set([type]), [a]);
assert.equal(second.workouts[2].items[0].sets, 8);
assert.equal(second.unallocatedSets, 1);
const afterStart = reallocateMissedWeeklyWork(plan, [a], [b], new Map([[exercise, "quads"]]), new Set([type]));
assert.equal(afterStart.workouts[1].items[0].sets, 3);
assert.equal(afterStart.workouts[2].items[0].sets, 6);
const withoutMovement: WeeklyCoachPlan = { ...plan, workouts: [plan.workouts[0],
  { ...plan.workouts[1], items: [{ ...plan.workouts[1].items[0], sourceSlotId: "other", exerciseId: b }] }] };
const carried = reallocateMissedWeeklyWork(withoutMovement, [a], [], new Map([[exercise, "quads"], [b, "chest"]]), new Set([type]));
assert.equal(carried.unallocatedSets, 0);
assert.equal(carried.workouts[1].items[1].sets, 3);
assert.equal(carried.workouts[1].items[1].sourceSlotId, `exercise:${exercise}`);
console.log("Weekly occurrence validation and missed-workout redistribution passed.");
