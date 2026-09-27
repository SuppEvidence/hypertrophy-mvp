import assert from "node:assert/strict";
import { mesocycleCompletedWorkoutWhere } from "../lib/coaching/mesocycle-training-window";

const where = mesocycleCompletedWorkoutWhere({
  userId: "athlete", programId: "program", startDate: new Date("2026-08-03T12:00:00Z"),
  endDate: new Date("2026-09-27T12:00:00Z"),
});
assert.equal(where.status, "COMPLETED");
assert.equal(where.programId, "program");
assert.equal(where.performedAt.gte.toISOString(), "2026-08-03T00:00:00.000Z");
assert.equal(where.performedAt.lt.toISOString(), "2026-09-28T00:00:00.000Z");
const legacyWorkout = { mesocycleId: null, programId: "program", performedAt: new Date("2026-09-10T09:00:00Z") };
assert.ok(legacyWorkout.performedAt >= where.performedAt.gte && legacyWorkout.performedAt < where.performedAt.lt,
  "A completed workout with no stored mesocycle ID still belongs to the block by date and program.");
assert.ok(new Date("2026-09-27T23:00:00Z") < where.performedAt.lt,
  "The block end calendar day must be included in full.");
console.log("Mesocycle workout history uses program and calendar dates.");
