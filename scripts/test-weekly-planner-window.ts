import assert from "node:assert/strict";
import { coachedWeek, plannerWeekOptions, resolvePlannerWeek } from "../lib/coaching/weekly-coach-calendar";

// Summer time: noon in Helsinki is 09:00 UTC.
const before = new Date("2026-10-11T08:59:59Z");
const noon = new Date("2026-10-11T09:00:00Z");
assert.equal(plannerWeekOptions(before).defaultWeek, "2026-10-05");
assert.equal(plannerWeekOptions(before).nextAvailable, false);
assert.throws(() => resolvePlannerWeek("2026-10-12", before));
assert.equal(plannerWeekOptions(noon).defaultWeek, "2026-10-12");
assert.equal(coachedWeek(noon).weekStart, "2026-10-05", "Logger must stay on Sunday’s current week");
const upcoming = resolvePlannerWeek(undefined, noon);
assert.equal(upcoming.today, "2026-10-11", "Planning date must stay real, not pretend it is Monday");
assert.equal(upcoming.isUpcoming, true);
assert.equal(upcoming.start.toISOString(), "2026-10-11T21:00:00.000Z");
assert.equal(upcoming.end.toISOString(), "2026-10-18T21:00:00.000Z");
assert.equal(upcoming.prescriptionAsOf.toISOString(), "2026-10-12T12:00:00.000Z");
assert.equal(resolvePlannerWeek("2026-10-05", noon).isUpcoming, false);
assert.throws(() => resolvePlannerWeek("2026-10-19", noon));
assert.throws(() => resolvePlannerWeek("garbage", noon));

// Sunday’s pinned upcoming plan becomes Monday’s current plan without changing its key.
const monday = new Date("2026-10-11T21:00:00Z");
assert.equal(plannerWeekOptions(monday).defaultWeek, upcoming.weekStart);
assert.equal(resolvePlannerWeek(upcoming.weekStart, monday).isUpcoming, false);
assert.equal(resolvePlannerWeek(upcoming.weekStart, monday).dbWeekStart.toISOString(), upcoming.dbWeekStart.toISOString());
assert.throws(() => resolvePlannerWeek("2026-10-05", monday));

// DST ends on this Sunday: noon is now 10:00 UTC, not 09:00.
assert.equal(plannerWeekOptions(new Date("2026-10-25T09:59:59Z")).nextAvailable, false);
const winter = new Date("2026-10-25T10:00:00Z");
assert.equal(plannerWeekOptions(winter).defaultWeek, "2026-10-26");
assert.equal(coachedWeek(winter).weekStart, "2026-10-19");
assert.equal(resolvePlannerWeek(undefined, winter).start.toISOString(), "2026-10-25T22:00:00.000Z");

// Year boundary and the spring DST change still use Helsinki calendar weeks.
assert.equal(plannerWeekOptions(new Date("2027-01-03T10:00:00Z")).defaultWeek, "2027-01-04");
assert.equal(plannerWeekOptions(new Date("2027-03-28T08:59:59Z")).nextAvailable, false);
assert.equal(plannerWeekOptions(new Date("2027-03-28T09:00:00Z")).defaultWeek, "2027-03-29");
console.log("Planner Sunday-noon gate, pinned week, Helsinki DST and logger isolation passed.");
