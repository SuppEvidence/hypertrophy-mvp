import assert from "node:assert/strict";
import { secondaryContributionFor } from "../lib/coaching/secondary-contribution";
import { buildWorkoutSummary } from "../lib/workouts/summary";

assert.equal(secondaryContributionFor({ contributionEstimate: null }), 0);
assert.equal(secondaryContributionFor({ contributionEstimate: 0 }), 0);
assert.equal(secondaryContributionFor({ contributionEstimate: 0.5 }), 0.5);
assert.equal(secondaryContributionFor({ contributionEstimate: 1.5 }), 0);
const exercise = (estimate: number | null) => ({ exercise: {
  name: "Press", primaryMuscles: [{ muscleId: "chest", muscle: { name: "Chest", sortOrder: 1 } }],
  secondaryMuscles: [{ muscleId: "triceps", contributionEstimate: estimate, muscle: { name: "Triceps", sortOrder: 2 } }],
}, painFlag: false, isSubstitution: false, sets: [{ weight: 40, reps: 10, isCompleted: true,
  setType: { multiplier: 1, isIntensifier: false } }] });
const input = [exercise(0.25), exercise(0.75), exercise(null)];
const summary = buildWorkoutSummary({ sessionExercises: input });
assert.equal(summary.volumeRows.find((row) => row.muscleId === "triceps")?.effective, 1);
assert.equal(summary.volumeRows.find((row) => row.muscleId === "chest")?.effective, 3);
console.log("Per-exercise secondary contribution and unassessed default passed.");
