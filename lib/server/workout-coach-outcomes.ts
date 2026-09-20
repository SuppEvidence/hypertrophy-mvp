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
    where: { id: params.setId, sessionExercise: { session: { userId: params.userId } } },
    include: { sessionExercise: true },
  });
  if (!set) return [];

  const actions = await prisma.workoutCoachAction.findMany({
    where: {
      userId: params.userId,
      sessionExerciseId: set.sessionExerciseId,
      status: "APPLIED",
      actionType: { in: ["CHANGE_LOAD", "CHANGE_REP_TARGET", "CHANGE_RIR_TARGET"] },
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
    const suggestedLoad = numberOrNull(prescription.suggestedLoad);
    const actualLoad = numberOrNull(set.weight);
    const actualRir = numberOrNull(set.rir);
    const loadTargetMet = suggestedLoad === null ? null : actualLoad !== null && Math.abs(actualLoad - suggestedLoad) < 0.26;
    const compromised = object(set.intensifierDetails).executionCompromised === true;
    const repTargetMet =
      set.reps !== null &&
      (minReps === null || set.reps >= minReps) &&
      (maxReps === null || set.reps <= maxReps);
    const rirTargetMet =
      targetRir === null ||
      (actualRir !== null && Math.abs(actualRir - targetRir) <= 1);

    let classification: "TARGETS_MET" | "TARGETS_MISSED" | "PAIN_REPORTED" | "INCONCLUSIVE";
    if (!set.isCompleted) classification = "INCONCLUSIVE";
    else if (set.painFlag || set.sessionExercise.painFlag) classification = "PAIN_REPORTED";
    else if (compromised || set.reps === null || (targetRir !== null && actualRir === null) ||
      (suggestedLoad !== null && (actualLoad === null || !loadTargetMet))) classification = "INCONCLUSIVE";
    else if (repTargetMet && rirTargetMet) classification = "TARGETS_MET";
    else classification = "TARGETS_MISSED";

    const outcome = {
      classification,
      scope: "PRESCRIPTION_ATTAINMENT",
      setStillCompleted: set.isCompleted,
      causalBenefitEstablished: false,
      note: "Target attainment only; does not establish hypertrophy, fatigue recovery, or intervention benefit.",
      evaluatedSetId: set.id,
      evaluatedSetNumber: set.setNumber,
      repTargetMet,
      rirTargetMet,
      loadTargetMet,
      executionCompromised: compromised,
      painReported: set.painFlag || set.sessionExercise.painFlag,
      newSetPain: set.painFlag && !action.triggerSet?.painFlag,
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
