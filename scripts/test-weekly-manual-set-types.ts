import assert from "node:assert/strict";
import { WeeklyCoachPlanSchema, validateWeeklyCoachPlan } from "../lib/coaching/weekly-coach-policy";
import { approvedWeekDose } from "../lib/coaching/weekly-coach-dose";

const day = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const exercise = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const normal = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const special = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const unknown = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const plan = WeeklyCoachPlanSchema.parse({ version: "W1", weekStart: "2026-10-12", summary: "",
  workouts: [{ id: day, date: "2026-10-12", templateId: day, durationMinutes: 60, rationale: "",
    items: [{ sourceSlotId: `exercise:${exercise}`, exerciseId: exercise, sets: 2, setTypeIds: [normal, special], reason: "" }] }] });
const exercises = [{ id: exercise, movementGroupId: day, primaryMuscleIds: ["primary"],
  secondaryMuscles: [{ muscleId: "secondary", fraction: .5 }], avoided: false }];
const input = { weekStart: plan.weekStart, availability: [{ date: "2026-10-12", minutes: 60 }], templateIds: [day],
  candidates: [], exercises, regularSetTypeIds: [normal], introducibleSetTypeIdsByExercise: {},
  multipliers: { [normal]: 1, [special]: 2.5 } };
assert.equal(validateWeeklyCoachPlan(plan, input).ok, false, "AI cannot introduce this type");
const overrides = [{ occurrenceId: day, sourceSlotId: `exercise:${exercise}`, exerciseId: exercise, setTypeIds: [normal, special] }];
const saved = WeeklyCoachPlanSchema.parse({ ...plan, manualSetTypeOverrides: overrides });
assert.equal(validateWeeklyCoachPlan(saved, { ...input, manualSetTypeOverrides: saved.manualSetTypeOverrides }).ok, true);
for (const override of [
  { ...overrides[0], occurrenceId: exercise },
  { ...overrides[0], sourceSlotId: "another-slot" },
  { ...overrides[0], exerciseId: day },
  { ...overrides[0], setTypeIds: [special, normal] },
]) assert.equal(validateWeeklyCoachPlan(saved, { ...input, manualSetTypeOverrides: [override] }).ok, false);
const invalid = { ...saved, workouts: [{ ...saved.workouts[0], items: [{ ...saved.workouts[0].items[0], setTypeIds: [normal, unknown] }] }] };
assert.equal(validateWeeklyCoachPlan(invalid, { ...input, manualSetTypeOverrides: [{ ...overrides[0], setTypeIds: [normal, unknown] }] }).ok, false,
  "Manual choice cannot bypass unknown/invalid set types");
const dose = approvedWeekDose({ plan: saved, exercises, multipliers: input.multipliers,
  missedIds: [], startedIds: [], completedOccurrenceIds: [], completed: [] });
assert.equal(dose.notCompleted.muscleDose.primary, 3.5, "Two slots count as 3.5 effective sets");
assert.equal(dose.notCompleted.muscleDose.secondary, 1.75);
assert.equal("manualSetTypeOverrides" in WeeklyCoachPlanSchema.omit({ userEdited: true, lineage: true, manualSetTypeOverrides: true }).shape, false);
console.log("Manual set-type approval is scoped; AI eligibility and effective-dose accounting remain intact.");
