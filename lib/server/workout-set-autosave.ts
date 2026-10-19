"use server";

import { isOneOffAlternative } from "@/lib/workouts/one-off-alternative";
import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";
import { evaluatePendingWorkoutCoachActionsForSet } from "@/lib/server/workout-coach-outcomes";

type AutosavePayload = {
  oneOffAlternative?: boolean;
  weight?: string;
  reps?: string;
  rir?: string;
  setTypeId?: string;
  isCompleted?: boolean;
  painFlag?: boolean;
  painNote?: string;
};

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableInteger(value: unknown): number | null {
  const parsed = nullableNumber(value);
  if (parsed === null) return null;
  return Number.isInteger(parsed) ? parsed : null;
}

function editableSessionStatusWhere() {
  const statuses: ("DRAFT" | "COMPLETED")[] = ["DRAFT", "COMPLETED"];
  return { in: statuses };
}

/**
 * Hot-path autosave for the current logger.
 * Legacy rep-range/effort labels are intentionally not parsed or written.
 * Set-level pain fields are retained for backwards compatibility, but are only
 * updated when an older caller explicitly supplies them. The current logger
 * stores symptom context at exercise-exposure level instead.
 */
export async function autosaveWorkoutSetCore(
  setId: string,
  payload: AutosavePayload,
) {
  const userId = await requireUserId();
  const weight = nullableNumber(payload.weight);
  const reps = nullableInteger(payload.reps);
  const rir = nullableNumber(payload.rir);
  const setTypeId = String(payload.setTypeId ?? "").trim();

  if (
    !setTypeId ||
    (weight !== null && weight < 0) ||
    (reps !== null && reps < 0) ||
    (rir !== null && (rir < 0 || rir > 10))
  ) {
    return { ok: false as const, error: "Invalid set values." };
  }

  const legacyPainUpdate =
    payload.painFlag !== undefined || payload.painNote !== undefined
      ? {
          painFlag: Boolean(payload.painFlag),
          painNote: payload.painNote?.trim().slice(0, 500) || null,
        }
      : {};

  const saved = await prisma.$transaction(async (tx) => {
    const identity = await tx.workoutSet.findFirst({
      where: {
        id: setId,
        sessionExercise: {
          session: { userId, status: editableSessionStatusWhere() },
        },
      },
      select: { sessionExerciseId: true },
    });
    if (!identity)
      return {
        ok: false as const,
        error: "Set not found or session is not editable.",
      };
    await tx.$queryRaw`SELECT id FROM workout_session_exercises WHERE id = ${identity.sessionExerciseId}::uuid FOR UPDATE`;
    const previous = await tx.workoutSet.findFirst({
      where: {
        id: setId,
        sessionExercise: {
          session: { userId, status: editableSessionStatusWhere() },
        },
      },
      select: {
        isCompleted: true,
        sessionExercise: { select: { exerciseChoiceIntent: true } },
      },
    });
    if (!previous)
      return {
        ok: false as const,
        error: "Set not found or session is not editable.",
      };
    const oneOff = isOneOffAlternative(
      previous.sessionExercise.exerciseChoiceIntent,
    );
    if (oneOff !== Boolean(payload.oneOffAlternative))
      return {
        ok: false as const,
        error: "Logging mode changed. Reload the workout before saving.",
      };
    if (oneOff && payload.isCompleted && rir === null)
      return {
        ok: false as const,
        error: "Enter observed RIR before completing this set.",
      };
    if (oneOff) {
      const type = await tx.setType.findFirst({
        where: {
          id: setTypeId,
          isActive: true,
          OR: [{ userId }, { userId: null }],
        },
        select: { id: true },
      });
      if (!type)
        return { ok: false as const, error: "Set format is unavailable." };
    }
    const result = await tx.workoutSet.updateMany({
      where: {
        id: setId,
        sessionExercise: {
          session: { userId, status: editableSessionStatusWhere() },
        },
      },
      data: {
        weight: oneOff ? null : weight,
        reps: oneOff ? null : reps,
        rir,
        setTypeId,
        isCompleted: Boolean(payload.isCompleted),
        ...legacyPainUpdate,
        ...(oneOff
          ? {
              repRangeStatus: "NOT_LOGGED" as const,
              effortStatus: "NOT_SURE" as const,
            }
          : {}),
      },
    });
    return {
      ok: result.count === 1,
      evaluate:
        !oneOff && (previous.isCompleted || Boolean(payload.isCompleted)),
    };
  });
  if (!saved.ok)
    return {
      ok: false as const,
      error: "error" in saved ? saved.error : "Set could not be saved.",
    };
  if ("evaluate" in saved && saved.evaluate) {
    await evaluatePendingWorkoutCoachActionsForSet({ userId, setId }).catch(
      () => undefined,
    );
  }
  return { ok: true as const };
}
