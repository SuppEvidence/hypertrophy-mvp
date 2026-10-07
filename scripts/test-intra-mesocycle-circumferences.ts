import assert from "node:assert/strict";
import { summarizeIntraMesocycleCircumferences } from "../lib/coaching/intra-mesocycle-circumferences";

const args = { startDate: new Date("2026-09-28"), endDate: new Date("2026-11-22"),
  priorEndDate: new Date("2026-09-27"), now: new Date("2026-10-07T05:00:00Z") };
const baseline = { loggedAt: new Date("2026-09-27T12:00:00Z"), logType: "MESOCYCLE_CHECKIN", arms: 400, chest: 960 };
const optional = { loggedAt: new Date("2026-10-07T12:00:00Z"), logType: "OPTIONAL_CHECKIN", arms: 402, waist: 732, bodyweight: 75 };
const result = summarizeIntraMesocycleCircumferences({ ...args, logs: [optional, baseline,
  { ...optional, loggedAt: new Date("2026-10-08"), arms: 999 },
  { ...optional, loggedAt: new Date("2026-09-20"), arms: 999 },
] });
assert.equal(result.observationCount, 1, "Today's date-only check-in included before noon; future/pre-block excluded");
assert.equal(result.baselineSource, "PRIOR_END");
const arms = result.fields.find((row) => row.field === "arms")!;
assert.equal(arms.changeMm, 2); assert.equal(arms.elapsedDays, 10);
assert.equal(result.fields.find((row) => row.field === "chest")!.latestMm, null, "Missing circumference is unknown");
assert.equal(result.recentObservations[0].waistMm, 732);
const missing = summarizeIntraMesocycleCircumferences({ ...args, logs: [optional] });
assert.equal(missing.baseline, null);
assert.equal(missing.fields.find((row) => row.field === "arms")!.referenceSource, "FIRST_IN_BLOCK_OBSERVATION");
assert.equal(missing.fields.find((row) => row.field === "arms")!.changeMm, null, "Single observation cannot establish change");
const many = Array.from({ length: 10 }, (_, i) => ({
  ...optional, loggedAt: new Date(+args.startDate + i * 86400000), arms: 400 + i,
}));
const capped = summarizeIntraMesocycleCircumferences({ ...args, logs: many });
assert.equal(capped.observationCount, 10); assert.equal(capped.recentObservations.length, 8);
assert.equal(capped.fields.find((row) => row.field === "arms")!.changeMm, 9, "Summary retains full interval despite payload cap");
assert.equal(summarizeIntraMesocycleCircumferences({ ...args, logs: [{ ...optional, arms: 0, chest: "bad" }] }).observationCount, 0);
console.log("Intra-mesocycle circumference regressions passed.");
