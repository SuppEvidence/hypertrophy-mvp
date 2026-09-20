"use server";

import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";

export type ExercisePainContext = {
  painFlag: boolean;
  painLocation: string | null;
  painSide: string | null;
  painImpact: string | null;
  painNote: string | null;
};

const LOCATION_VALUES = new Set([
  "SHOULDER",
  "ELBOW",
  "WRIST_HAND",
  "NECK_UPPER_BACK",
  "LOW_BACK",
  "HIP_GROIN",
  "KNEE",
  "ANKLE_FOOT",
  "OTHER",
]);

const SIDE_VALUES = new Set(["LEFT", "RIGHT", "BOTH", "NA"]);
const IMPACT_VALUES = new Set([
  "NOTICED_ONLY",
  "AFFECTED_EXECUTION",
  "CHANGED_OR_STOPPED",
]);

function cleanEnum(value: unknown, allowed: Set<string>) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return allowed.has(normalized) ? normalized : null;
}

function humanize(value: string | null) {
  if (!value) return null;
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function synthesizedSetPainNote(context: ExercisePainContext) {
  const parts = [
    "Exercise-level symptom",
    humanize(context.painLocation),
    context.painSide === "NA" ? null : humanize(context.painSide),
    humanize(context.painImpact),
    context.painNote?.trim() || null,
  ].filter(Boolean);
  return parts.join(" · ").slice(0, 500);
}

export async function getExercisePainContext(sessionExerciseId: string) {
  const userId = await requireUserId();
  const row = await prisma.workoutSessionExercise.findFirst({
    where: {
      id: sessionExerciseId,
      session: { userId, status: { in: ["DRAFT", "COMPLETED"] } },
    },
    select: {
      painFlag: true,
      painLocation: true,
      painSide: true,
      painImpact: true,
      painNote: true,
    },
  });

  if (!row) {
    return { ok: false as const, error: "Exercise exposure not found." };
  }

  return { ok: true as const, context: row };
}

export async function saveExercisePainContext(
  sessionExerciseId: string,
  payload: {
    painFlag?: boolean;
    painLocation?: string | null;
    painSide?: string | null;
    painImpact?: string | null;
    painNote?: string | null;
  },
) {
  const userId = await requireUserId();
  const existing = await prisma.workoutSessionExercise.findFirst({
    where: {
      id: sessionExerciseId,
      session: { userId, status: { in: ["DRAFT", "COMPLETED"] } },
    },
    select: { id: true },
  });

  if (!existing) {
    return { ok: false as const, error: "Exercise exposure not found." };
  }

  const painFlag = payload.painFlag === true;
  const context: ExercisePainContext = painFlag
    ? {
        painFlag: true,
        painLocation: cleanEnum(payload.painLocation, LOCATION_VALUES),
        painSide: cleanEnum(payload.painSide, SIDE_VALUES),
        painImpact: cleanEnum(payload.painImpact, IMPACT_VALUES),
        painNote: String(payload.painNote ?? "").trim().slice(0, 500) || null,
      }
    : {
        painFlag: false,
        painLocation: null,
        painSide: null,
        painImpact: null,
        painNote: null,
      };

  if (painFlag && (!context.painLocation || !context.painImpact)) {
    return {
      ok: false as const,
      error: "Choose a location and how much the issue affected the exercise.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.workoutSessionExercise.update({
      where: { id: sessionExerciseId },
      data: context,
    });

    // Keep the existing workout-analysis pipeline backwards-compatible without
    // counting one exercise symptom as multiple incidents: clear legacy set
    // pain first, then mirror the exposure onto exactly one set.
    await tx.workoutSet.updateMany({
      where: { sessionExerciseId },
      data: { painFlag: false, painNote: null },
    });

    if (painFlag) {
      const firstCompleted = await tx.workoutSet.findFirst({
        where: { sessionExerciseId, isCompleted: true },
        orderBy: { setNumber: "asc" },
        select: { id: true },
      });
      const firstAny = firstCompleted
        ? null
        : await tx.workoutSet.findFirst({
            where: { sessionExerciseId },
            orderBy: { setNumber: "asc" },
            select: { id: true },
          });
      const targetId = firstCompleted?.id ?? firstAny?.id ?? null;
      if (targetId) {
        await tx.workoutSet.update({
          where: { id: targetId },
          data: {
            painFlag: true,
            painNote: synthesizedSetPainNote(context),
          },
        });
      }
    }
  });

  return { ok: true as const, context };
}
