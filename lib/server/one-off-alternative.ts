"use server";

import { readClassification } from "@/lib/coaching/exercise-classification";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";
import {
  ONE_OFF_EQUIVALENT,
  isOneOffAlternative,
} from "@/lib/workouts/one-off-alternative";

export async function setOneOffAlternative(
  sessionExerciseId: string,
  enabled: boolean,
  confirmed: boolean,
) {
  const userId = await requireUserId();
  if (enabled && !confirmed)
    return {
      ok: false as const,
      error: "Confirm a similar movement and muscle emphasis first.",
    };
  const result = await prisma.$transaction(async (tx) => {
    const identity = await tx.workoutSessionExercise.findFirst({
      where: { id: sessionExerciseId, session: { userId, status: "DRAFT" } },
      select: { sessionId: true },
    });
    if (!identity)
      return {
        ok: false as const,
        error: "Exercise not found in an active workout.",
      };
    // Same lock order as live-coach application; serialize mode switches with set writes.
    await tx.$queryRaw`SELECT id FROM workout_sessions WHERE id = ${identity.sessionId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM workout_session_exercises WHERE id = ${sessionExerciseId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM workout_sets WHERE session_exercise_id = ${sessionExerciseId}::uuid ORDER BY set_number FOR UPDATE`;
    const item = await tx.workoutSessionExercise.findFirst({
      where: { id: sessionExerciseId, session: { userId, status: "DRAFT" } },
      include: {
        sets: true,
        exercise: {
          select: { primaryMuscles: { select: { muscleId: true } } },
        },
      },
    });
    if (!item)
      return { ok: false as const, error: "Workout is no longer editable." };
    if (isOneOffAlternative(item.exerciseChoiceIntent) === enabled)
      return { ok: true as const };
    if (
      item.sets.some((set) => set.isCompleted || set.startedAt || set.endedAt)
    ) {
      return {
        ok: false as const,
        error:
          "Choose the alternative before starting this exercise. Already logged sets must keep their original meaning.",
      };
    }
    const primary =
      readClassification(item.muscleSnapshot)?.primary ??
      item.exercise.primaryMuscles;
    if (enabled && !primary.length)
      return {
        ok: false as const,
        error:
          "Classify the source exercise's muscles before using equivalent-volume logging.",
      };
    const normal = await tx.setType.findFirst({
      where: { slug: "normal", isActive: true, userId: null },
    });
    if (enabled && !normal)
      return {
        ok: false as const,
        error: "The standard set format is unavailable.",
      };
    await tx.workoutSessionExercise.update({
      where: { id: item.id },
      data: {
        exerciseChoiceIntent: enabled ? ONE_OFF_EQUIVALENT : "TEMPORARY",
      },
    });
    await tx.workoutSet.updateMany({
      where: { sessionExerciseId: item.id },
      data: {
        weight: null,
        reps: null,
        rir: null,
        prescription: Prisma.DbNull,
        intensifierDetails: Prisma.DbNull,
        repRangeStatus: "NOT_LOGGED",
        effortStatus: "NOT_SURE",
        ...(enabled && normal ? { setTypeId: normal.id } : {}),
      },
    });
    await tx.workoutCoachAction.updateMany({
      where: { userId, sessionExerciseId: item.id, status: "PROPOSED" },
      data: { status: "SUPERSEDED" },
    });
    return { ok: true as const };
  });
  if (result.ok) revalidatePath("/log");
  return result;
}
