import "server-only";
import { getUserExercisePrisma } from "./effective-exercise-data";
import { exerciseAccessWhere } from "./exercise-catalog-policy";
import {
  exerciseGuidance,
  type WorkoutExerciseGuidance,
} from "@/lib/workouts/exercise-guidance";

/** Saved guidance for the authorized session's exercises only; no model calls or writes. */
export async function getWorkoutExerciseGuidance(
  userId: string,
  exerciseIds: string[],
) {
  const result: Record<string, WorkoutExerciseGuidance> = {};
  if (!exerciseIds.length) return result;
  const prisma = getUserExercisePrisma(userId);
  const rows = await prisma.exercise.findMany({
    where: {
      id: { in: [...new Set(exerciseIds)] },
      ...exerciseAccessWhere(userId),
    },
    select: {
      id: true,
      name: true,
      setupNotes: true,
      movementGroupId: true,
      primaryMuscles: { select: { muscleId: true } },
      secondaryMuscles: { select: { muscleId: true } },
      coachingProfiles: {
        where: { userId },
        take: 1,
        select: { executionSetup: true, mechanicsProfile: true },
      },
    },
  });
  for (const row of rows) result[row.id] = exerciseGuidance(row);
  return result;
}
