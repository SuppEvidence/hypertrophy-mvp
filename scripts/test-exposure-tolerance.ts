import assert from "node:assert/strict";
import { summarizeExposureTolerance, type ToleranceExposure } from "../lib/coaching/exposure-tolerance";
import { inferLocalReadiness } from "../lib/coaching/pre-workout-coach-policy";

function exposure(date: string, reps: number, intensified = false): ToleranceExposure {
  const normal = { weight: 20, reps, rir: 1, painFlag: false, intensifierDetails: {},
    setType: { name: "Normal", slug: "normal", isIntensifier: false, multiplier: 1 } };
  return { exerciseId: "cable", painFlag: false, exercise: { name: "Cable lateral", movementGroupId: "lateral",
    primaryMuscles: [{ muscleId: "delts" }], secondaryMuscles: [{ muscleId: "traps", contributionEstimate: .25 }] },
    session: { performedAt: new Date(date) }, sets: intensified ? [normal, { ...normal, setType: { name: "EDT", slug: "edt", isIntensifier: false, multiplier: 1.3 } }] : [normal] };
}
const first = exposure("2026-10-05T07:00:00Z", 12, true);
const second = exposure("2026-10-07T07:00:00Z", 12);
const third = exposure("2026-10-09T07:00:00Z", 8);
const summary = summarizeExposureTolerance([third, first, second]);
assert.equal(summary.exerciseResponses[0].afterIntensified.stableOrImproved, 1, "Stable next exposure supplies tolerance evidence after EDT");
assert.equal(summary.exerciseResponses[0].afterRegular.lowerPerformance, 1, "Subsequent decline after regular exposure must not be attributed to older EDT");
assert.equal(summary.exerciseResponses[0].recentTransitions[0].hoursBetween, 48);
assert.equal(summary.weeklyCompletedMuscleDose[0].muscles.delts, 4.3);
assert.equal(summary.weeklyCompletedMuscleDose[0].muscles.traps, 4.3 * .25);
const phaseSeparated = summarizeExposureTolerance([first, second, third], [
  { phase: "CUTTING", startDate: "2026-09-01", endDateExclusive: "2026-10-06" },
  { phase: "GAINING", startDate: "2026-10-06", endDateExclusive: null },
]);
assert.equal(phaseSeparated.exerciseResponses[0].summaryPhase, "GAINING");
assert.equal(phaseSeparated.exerciseResponses[0].afterIntensified.comparable, 0, "Transition from cutting to gaining cannot prove current-period intensifier tolerance");
assert.equal(phaseSeparated.exerciseResponses[0].afterRegular.comparable, 1);
const noRir = exposure("2026-10-07T07:00:00Z", 12); noRir.sets[0].rir = null;
assert.equal(summarizeExposureTolerance([first, noRir]).exerciseResponses[0].afterIntensified.comparable, 0);
const other = exposure("2026-10-07T07:00:00Z", 5); other.exerciseId = "db";
assert.equal(summarizeExposureTolerance([first, other]).exerciseResponses.length, 0, "Never compare absolute exercise variations");
const far = exposure("2026-11-07T07:00:00Z", 5);
assert.equal(summarizeExposureTolerance([first, far]).exerciseResponses.length, 0);
const onlyEdtA = exposure("2026-10-05T07:00:00Z", 12, true); onlyEdtA.sets.shift(); onlyEdtA.sets[0].intensifierDetails = { clusterCount: 4 };
const onlyEdtB = exposure("2026-10-07T07:00:00Z", 13, true); onlyEdtB.sets.shift(); onlyEdtB.sets[0].intensifierDetails = { clusterCount: 4 };
const protocol = summarizeExposureTolerance([onlyEdtA, onlyEdtB]);
assert.equal(protocol.exerciseResponses[0].recentTransitions[0].comparisonBasis, "MATCHED_INTENSIFIER_PROTOCOL_REPS");
assert.equal(protocol.exerciseResponses[0].afterIntensified.stableOrImproved, 1);
onlyEdtB.sets[0].intensifierDetails = { clusterCount: 6 };
assert.equal(summarizeExposureTolerance([onlyEdtA, onlyEdtB]).exerciseResponses[0].afterIntensified.comparable, 0, "Different cluster protocol is unknown");
const base = { movementGroupId: "lateral", movementGroupName: "Lateral raise", hoursSinceLastExposure: 18,
  effectiveSetsLast48h: 10, effectiveSetsLast72h: 12, performanceExposureCount: 10, downwardExerciseSignals: 0,
  recentPainSets: 0, recentCompromisedSets: 0, globalRecoveryStatus: "NORMAL" as const };
assert.equal(inferLocalReadiness(base).status, "READY", "Even dense recent workload does not diagnose impaired recovery");
assert.equal(inferLocalReadiness({ ...base, recentPainSets: 1 }).status, "CAUTION");
console.log("Exposure tolerance, matched intensifier protocols, and evidence-based readiness tests passed.");
