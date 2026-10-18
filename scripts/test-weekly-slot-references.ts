import assert from "node:assert/strict";
import {
  normalizeWeeklySlotReferences,
  weeklyValidationMessage,
} from "../lib/coaching/weekly-slot-references";
import {
  consolidateWeeklyExercises,
  validateWeeklyCoachPlan,
  type WeeklyCoachPlan,
  type WeeklyCandidate,
  type WeeklyExercise,
} from "../lib/coaching/weekly-coach-policy";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const item = {
  sourceSlotId: "retired-position",
  exerciseId: id(1),
  sets: 2,
  setTypeIds: [id(2), id(2)],
  reason: "Accepted exercise, adjusted dose",
};
const plan: WeeklyCoachPlan = {
  version: "W1",
  weekStart: "2026-10-19",
  summary: "Review",
  workouts: [
    {
      id: id(3),
      date: "2026-10-19",
      templateId: id(4),
      durationMinutes: 60,
      rationale: "Recovery spacing",
      items: [item],
    },
  ],
  manualSetTypeOverrides: [
    {
      occurrenceId: id(3),
      sourceSlotId: item.sourceSlotId,
      exerciseId: id(1),
      setTypeIds: item.setTypeIds,
    },
  ],
  exerciseChanges: [
    {
      date: "2026-10-19",
      sourceSlotId: item.sourceSlotId,
      fromExerciseId: id(6),
      toExerciseId: id(1),
      basis: "USER_REQUEST",
      reason: "User prefers this exercise",
    },
  ],
};
const candidates: WeeklyCandidate[] = [
  {
    id: "current-position",
    templateId: id(4),
    exerciseId: id(1),
    movementGroupId: "legs",
    sets: 2,
    setTypeIds: item.setTypeIds,
    primaryMuscleIds: ["quads"],
    secondaryMuscles: [],
  },
];
const exercises: WeeklyExercise[] = [
  {
    id: id(1),
    name: "Pendulum squat",
    movementGroupId: "legs",
    primaryMuscleIds: ["quads"],
    secondaryMuscles: [],
    avoided: false,
  },
];
const evidence = {
  weekStart: plan.weekStart,
  availability: [{ id: id(3), date: "2026-10-19", minutes: 60 }],
  templateIds: [id(4)],
  candidates,
  exercises,
  regularSetTypeIds: [id(2)],
  multipliers: { [id(2)]: 1 },
};
assert.equal(validateWeeklyCoachPlan(plan, evidence).ok, false);
const fixed = normalizeWeeklySlotReferences(plan, candidates, exercises);
assert.equal(fixed.repairedCount, 1);
assert.equal(fixed.plan.workouts[0].items[0].sourceSlotId, "current-position");
assert.equal(validateWeeklyCoachPlan(fixed.plan, evidence).ok, true);
assert.equal(
  fixed.plan.manualSetTypeOverrides?.[0].sourceSlotId,
  "current-position",
);
assert.equal(fixed.plan.exerciseChanges?.[0].sourceSlotId, "current-position");
assert.equal(
  plan.workouts[0].items[0].sourceSlotId,
  "retired-position",
  "Do not mutate the saved input",
);
assert.equal(fixed.plan.workouts[0].items[0].exerciseId, item.exerciseId);
assert.deepEqual(fixed.plan.workouts[0].items[0].setTypeIds, item.setTypeIds);
assert.equal(fixed.plan.workouts[0].items[0].sets, 2);
const virtual = normalizeWeeklySlotReferences(plan, [], exercises);
assert.equal(
  virtual.plan.workouts[0].items[0].sourceSlotId,
  `exercise:${id(1)}`,
);
assert.equal(
  validateWeeklyCoachPlan(virtual.plan, { ...evidence, candidates: [] }).ok,
  true,
);
const ambiguous = normalizeWeeklySlotReferences(
  plan,
  [...candidates, { ...candidates[0], id: "other-position" }],
  exercises,
);
assert.equal(
  ambiguous.plan.workouts[0].items[0].sourceSlotId,
  `exercise:${id(1)}`,
  "Do not guess between ambiguous slots",
);
assert.equal(
  normalizeWeeklySlotReferences(fixed.plan, candidates, exercises)
    .repairedCount,
  0,
  "Known references are stable",
);
assert.equal(
  normalizeWeeklySlotReferences(virtual.plan, [], exercises).repairedCount,
  0,
  "Valid virtual references are stable",
);
const unavailable = normalizeWeeklySlotReferences(plan, candidates, []);
assert.equal(
  unavailable.repairedCount,
  0,
  "Do not repair unknown unavailable exercises into active recommendations",
);
assert.match(
  validateWeeklyCoachPlan(unavailable.plan, { ...evidence, exercises: [] })
    .errors[0],
  /2026-10-19.*no longer available.*Restore or replace/,
);
assert.match(
  validateWeeklyCoachPlan(plan, evidence).errors[0],
  /2026-10-19.*Pendulum squat.*workout position/,
);
const duplicate = {
  ...plan,
  workouts: [
    {
      ...plan.workouts[0],
      items: [item, { ...item, sourceSlotId: "another-stale-position" }],
    },
  ],
};
const folded = consolidateWeeklyExercises(
  normalizeWeeklySlotReferences(duplicate, candidates, exercises).plan,
);
assert.equal(folded.workouts[0].items.length, 1);
assert.equal(folded.workouts[0].items[0].sets, 4);
const overflow = {
  ...duplicate,
  workouts: [
    {
      ...duplicate.workouts[0],
      items: duplicate.workouts[0].items.map((row) => ({
        ...row,
        sets: 6,
        setTypeIds: Array(6).fill(id(2)),
      })),
    },
  ],
};
assert.equal(
  validateWeeklyCoachPlan(
    consolidateWeeklyExercises(
      normalizeWeeklySlotReferences(overflow, candidates, exercises).plan,
    ),
    evidence,
  ).ok,
  false,
  "Keep duplicate/over-eight-set safeguards",
);
const wrongDate = {
  ...fixed.plan,
  workouts: [{ ...fixed.plan.workouts[0], date: "2026-10-20" }],
};
assert.equal(
  validateWeeklyCoachPlan(wrongDate, evidence).ok,
  false,
  "Date checks remain intact",
);
const wrongTemplate = {
  ...fixed.plan,
  workouts: [{ ...fixed.plan.workouts[0], templateId: id(99) }],
};
assert.equal(
  validateWeeklyCoachPlan(wrongTemplate, evidence).ok,
  false,
  "Template checks remain intact",
);
const message = weeklyValidationMessage([
  "First actionable issue.",
  "Second issue.",
  "First actionable issue.",
  "Third issue.",
  "Fourth issue.",
]);
assert(message.includes("\n• Second issue."));
assert(message.includes("1 more check"));
assert(!message.includes("Fourth issue."));
console.log(
  "Weekly slot references: retired/generated IDs, exact/ambiguous matches, active catalog fallback, metadata, input isolation, duplicates, availability/template checks and actionable errors passed.",
);
