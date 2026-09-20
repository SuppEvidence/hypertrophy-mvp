import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

function numberOrNull(value: unknown) {
  const parsed = value === null || value === undefined ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function object(value: Prisma.JsonValue | null) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Evaluate applied short-horizon actions as soon as their next target set lands. */
export async function evaluatePendingWorkoutCoachActionsForSet(params: {
  userId: string;
  setId: string;
}) {
  const set = await prisma.workoutSet.findFirst({
    where: { id: params.setId, isCompleted: true, sessionExercise: { session: { userId: params.userId } } },
    include: { sessionExercise: true },
  });
  if (!set) return [];

  const actions = await prisma.workoutCoachAction.findMany({
    where: {
      userId: params.userId,
      sessionExerciseId: set.sessionExerciseId,
      status: "APPLIED",
      evaluatedAt: null,
      triggerSet: { setNumber: { lt: set.setNumber } },
    },
    include: { triggerSet: true },
    orderBy: { createdAt: "asc" },
  });

  const results = [];
  for (const action of actions) {
    const applied = object(action.appliedState);
    const targetSetIds = Array.isArray(applied.targetSetIds)
      ? applied.targetSetIds.filter((id): id is string => typeof id === "string")
      : [];
    if (targetSetIds.length > 0 && !targetSetIds.includes(set.id)) continue;

    const prescription = object(applied.prescription as Prisma.JsonValue | null);
    const minReps = numberOrNull(prescription.minReps);
    const maxReps = numberOrNull(prescription.maxReps);
    const targetRir = numberOrNull(prescription.targetRir);
    const actualRir = numberOrNull(set.rir);
    const repTargetMet =
      set.reps !== null &&
      (minReps === null || set.reps >= minReps) &&
      (maxReps === null || set.reps <= maxReps);
    const rirTargetMet =
      targetRir === null ||
      (actualRir !== null && Math.abs(actualRir - targetRir) <= 1);

    let classification: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "INCONCLUSIVE";
    if (set.painFlag) classification = "NEGATIVE";
    else if (set.reps === null || (targetRir !== null && actualRir === null)) classification = "INCONCLUSIVE";
    else if (repTargetMet && rirTargetMet) classification = "POSITIVE";
    else classification = "NEUTRAL";

    const outcome = {
      classification,
      evaluatedSetId: set.id,
      evaluatedSetNumber: set.setNumber,
      repTargetMet,
      rirTargetMet,
      painWorsened: set.painFlag,
      actual: { weight: numberOrNull(set.weight), reps: set.reps, rir: actualRir },
    };
    await prisma.workoutCoachAction.update({
      where: { id: action.id },
      data: {
        outcome: outcome as Prisma.InputJsonValue,
        evaluatedAt: new Date(),
      },
    });
    results.push({ actionId: action.id, outcome });
  }
  return results;
}

