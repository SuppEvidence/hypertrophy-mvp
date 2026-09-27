import "server-only";
import { prisma } from "@/lib/db/prisma";
import { selectRememberedExerciseChoices } from "@/lib/coaching/exercise-choice-policy";

export type RememberedExerciseChoice = {
  exerciseId: string;
  exerciseName: string;
  movementGroupId: string;
  source: "COACH" | "USER" | "TEMPLATE";
  reason: string | null;
};

// A temporary selection never replaces the earlier saved choice. Legacy coached
// swaps were not tagged, so do not promote those to lasting preferences.
export async function rememberedTemplateExerciseChoices(userId: string, programId: string, templateId: string) {
  const sessions = await prisma.workoutSession.findMany({
    where: { userId, programId, templateId, status: "COMPLETED" },
    orderBy: [{ performedAt: "desc" }, { completedAt: "desc" }, { createdAt: "desc" }],
    take: 30,
    select: {
      prescriptionSummary: true,
      exercises: {
        where: { templateExerciseId: { not: null } },
        select: {
          templateExerciseId: true, exerciseId: true, exerciseChoiceIntent: true, isSubstitution: true,
          notes: true, prescriptionNote: true,
          exercise: { select: { name: true, movementGroupId: true, isActive: true, isArchived: true } },
        },
      },
    },
  });
  const mapped = sessions.map((session) => {
    const summary = session.prescriptionSummary;
    const coached = Boolean(summary && typeof summary === "object" && !Array.isArray(summary) && "preWorkoutCoach" in summary);
    return { coached, exercises: session.exercises.map((item) => ({
      templateExerciseId: item.templateExerciseId, exerciseId: item.exerciseId,
      exerciseName: item.exercise.name, movementGroupId: item.exercise.movementGroupId,
      active: item.exercise.isActive && !item.exercise.isArchived,
      isSubstitution: item.isSubstitution, intent: item.exerciseChoiceIntent,
      note: item.notes ?? (coached ? item.prescriptionNote : null),
    })) };
  });
  return selectRememberedExerciseChoices(mapped) satisfies Map<string, RememberedExerciseChoice>;
}
