import assert from "node:assert/strict";
import { selectMesocycleCheckins } from "../lib/coaching/mesocycle-checkins";

const d = (value: string) => new Date(`${value}T12:00:00Z`);
const startDate = d("2026-01-08");
const endDate = d("2026-03-04");
const priorEndDate = d("2026-01-07");
const prior = { loggedAt: d("2026-01-07"), logType: "MESOCYCLE_END", chest: 990 };
const end = { loggedAt: d("2026-03-02"), logType: "MESOCYCLE_END", chest: 1000 };
const run = (logs: Array<{loggedAt: Date; logType: string; chest?: number; arms?: number}>, now = d("2026-03-04")) =>
  selectMesocycleCheckins({ logs, startDate, endDate, priorEndDate, now });
assert.equal(run([prior, end]).ready, true);
assert.equal(run([prior, end]).startSource, "PRIOR_END");
assert.equal(run([prior, end, { loggedAt: d("2026-01-08"), logType: "MESOCYCLE_START", chest: 995 }]).startSource, "EXPLICIT");
assert.equal(run([end]).ready, false);
assert.equal(run([prior, { ...end, loggedAt: d("2026-02-20") }]).ready, false);
assert.equal(run([prior, { ...end, logType: "DAILY" }]).ready, false);
assert.equal(run([prior, { ...end, chest: undefined, arms: 300 }]).ready, false);
assert.equal(run([prior, { ...end, loggedAt: d("2026-03-06") }], d("2026-03-04")).ready, false);
console.log("Mesocycle check-in boundaries passed.");
