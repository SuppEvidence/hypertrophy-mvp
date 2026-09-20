"use server";

import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";

type AutosavePayload = {
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

  const result = await prisma.workoutSet.updateMany({
    where: {
      id: setId,
      sessionExercise: {
        session: { userId, status: editableSessionStatusWhere() },
      },
    },
    data: {
      weight,
      reps,
      rir,
      setTypeId,
      isCompleted: Boolean(payload.isCompleted),
      ...legacyPainUpdate,
    },
  });

  return result.count === 1
    ? { ok: true as const }
    : { ok: false as const, error: "Set not found or session is not editable." };
}
