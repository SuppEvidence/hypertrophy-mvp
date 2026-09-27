import assert from "node:assert/strict";
import { selectRememberedExerciseChoices, type ChoiceSession } from "../lib/coaching/exercise-choice-policy";

const row = (exerciseId: string, intent: string | null, isSubstitution = false): ChoiceSession["exercises"][number] => ({
  templateExerciseId: "slot-1", exerciseId, exerciseName: exerciseId, movementGroupId: "press",
  active: true, isSubstitution, intent, note: null,
});
const choices = selectRememberedExerciseChoices([
  { coached: true, exercises: [row("temporary-coach-swap", "TEMPORARY", true)] },
  { coached: false, exercises: [row("saved-choice", "PERSISTENT", true)] },
  { coached: false, exercises: [row("older-choice", null)] },
]);
assert.equal(choices.get("slot-1")?.exerciseId, "saved-choice");
assert.equal(selectRememberedExerciseChoices([
  { coached: true, exercises: [row("legacy-coach-swap", null, true)] },
  { coached: false, exercises: [row("legacy-user-choice", null, true)] },
]).get("slot-1")?.exerciseId, "legacy-user-choice");
assert.equal(selectRememberedExerciseChoices([
  { coached: true, exercises: [row("approved-remembered-coach-swap", "PERSISTENT", true)] },
  { coached: false, exercises: [row("old", null)] },
]).get("slot-1")?.exerciseId, "approved-remembered-coach-swap");
console.log("Exercise choice memory cases passed.");
