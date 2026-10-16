import "server-only";
import { getUserExercisePrisma } from "./effective-exercise-data";
/** Physical work already done still counts when the active program changes midweek. */
export async function loadCompletedWeekSessions(
  userId: string,
  start: Date,
  end: Date,
) {
  return getUserExercisePrisma(userId).workoutSession.findMany({
    where: {
      userId,
      status: "COMPLETED",
      performedAt: { gte: start, lt: end },
    },
    select: {
      id: true,
      performedAt: true,
      templateId: true,
      prescriptionSummary: true,
      exercises: {
        select: {
          id: true,
          exerciseId: true,
          painFlag: true,
          exercise: {
            select: {
              movementGroupId: true,
              primaryMuscles: { select: { muscleId: true } },
              secondaryMuscles: {
                select: { muscleId: true, contributionEstimate: true },
              },
            },
          },
          sets: {
            select: {
              id: true,
              isCompleted: true,
              setTypeId: true,
              weight: true,
              reps: true,
              rir: true,
              painFlag: true,
              setType: { select: { multiplier: true } },
            },
          },
        },
      },
    },
  });
}
