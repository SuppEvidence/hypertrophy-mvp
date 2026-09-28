import { canIntroduceSetType, type CoachSetType } from "@/lib/coaching/pre-workout-coach-policy";
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

export function weeklyIntroducibleSetTypes(exercises: WeeklySetTypeExercise[], types: CoachSetType[]) {
  return Object.fromEntries(exercises.map((exercise) => [exercise.id, types.filter((type) =>
    (type.isIntensifier || isEdtSetType(type)) && type.multiplier <= 1.35 &&
    canIntroduceSetType(exercise, type)).map((type) => type.id)])) as Record<string, string[]>;
}
