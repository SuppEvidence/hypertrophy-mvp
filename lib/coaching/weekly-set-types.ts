import { type CoachSetType } from "@/lib/coaching/pre-workout-coach-policy";
import { isEdtSetType } from "@/lib/coaching/set-type-classification";

export type WeeklySetTypeExercise = {
  id: string;
  movementGroupName: string;
  primaryMuscleIds: string[];
  secondaryMuscleIds: string[];
  preference?: "NEUTRAL" | "PREFERRED" | "AVOID";
  intensifierPreference?: "DEFAULT" | "NONE" | "ONLY_SELECTED";
  allowedIntensifierIds?: string[];
};

export function regularWeeklySetTypeIds(types: CoachSetType[]) {
  return types.filter((type) => !type.isIntensifier && !isEdtSetType(type) && Math.abs(type.multiplier - 1) < .001).map((type) => type.id);
}

/** Weekly proposals are user-reviewed: availability is catalog validity, not a format whitelist.
 * Preferences and exercise suitability are reasoning inputs, never hard set-type gates. */
export function weeklyIntroducibleSetTypes(exercises: WeeklySetTypeExercise[], types: CoachSetType[]) {
  const ids = types.filter((type) => Number.isFinite(type.multiplier) && type.multiplier > 0).map((type) => type.id);
  return Object.fromEntries(exercises.map((exercise) => [exercise.id, ids])) as Record<string, string[]>;
}
