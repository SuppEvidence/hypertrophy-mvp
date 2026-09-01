"use server";

import { Prisma } from "@prisma/client";
import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";

type DropSetPayload = {
  weight?: string | number | null;
  reps?: string | number | null;
};

type IntensifierPayload = {
  clusterCount?: string | number | null;
  dropSets?: DropSetPayload[];
  filmed?: boolean;
};

type StoredDropSet = {
  weight: number | null;
  reps: number | null;
};

type StoredIntensifierDetails = {
  clusterCount: number | null;
  dropSets: StoredDropSet[];
  filmed: boolean;
};

function editableSessionStatusWhere() {
  const statuses: ("DRAFT" | "COMPLETED")[] = ["DRAFT", "COMPLETED"];
  return { in: statuses };
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableInteger(value: unknown): number | null {
  const parsed = nullableNumber(value);
  if (parsed === null) return null;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function sanitizeDetails(payload: IntensifierPayload): StoredIntensifierDetails {
  const clusterCount = nullableInteger(payload.clusterCount);
  const dropSets = (payload.dropSets ?? [])
    .slice(0, 10)
    .map((drop) => ({
      weight: nullableNumber(drop.weight),
      reps: nullableInteger(drop.reps),
    }))
    .filter((drop) => drop.weight !== null || drop.reps !== null);

  return { clusterCount, dropSets, filmed: payload.filmed === true };
}

function parseStoredDetails(value: Prisma.JsonValue | null): StoredIntensifierDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { clusterCount: null, dropSets: [], filmed: false };
  }

  const raw = value as Record<string, unknown>;
  const clusterCount = nullableInteger(raw.clusterCount);
  const rawDrops = Array.isArray(raw.dropSets) ? raw.dropSets : [];
  const dropSets = rawDrops
    .slice(0, 10)
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return { weight: null, reps: null };
      }
      const drop = entry as Record<string, unknown>;
      return {
        weight: nullableNumber(drop.weight),
        reps: nullableInteger(drop.reps),
      };
    })
    .filter((drop) => drop.weight !== null || drop.reps !== null);

  return { clusterCount, dropSets, filmed: raw.filmed === true };
}

/** Loaded only when the details drawer is opened, not once per row on page load. */
export async function getWorkoutSetTracking(setId: string) {
  const userId = await requireUserId();
  const set = await prisma.workoutSet.findFirst({
    where: {
      id: setId,
      sessionExercise: {
        session: { userId, status: editableSessionStatusWhere() },
      },
    },
    select: {
      startedAt: true,
      endedAt: true,
      intensifierDetails: true,
    },
  });

  if (!set) {
    return {
      ok: false as const,
      startedAt: null,
      endedAt: null,
      intensifierDetails: {
        clusterCount: null,
        dropSets: [],
        filmed: false,
      } as StoredIntensifierDetails,
    };
  }

  return {
    ok: true as const,
    startedAt: set.startedAt?.toISOString() ?? null,
    endedAt: set.endedAt?.toISOString() ?? null,
    intensifierDetails: parseStoredDetails(set.intensifierDetails),
  };
}

/**
 * Starts a new timer unless one is already running. After a page refresh,
 * pressing Start Set resumes the existing server-side start time instead of
 * silently resetting it.
 */
export async function startWorkoutSetTimer(setId: string) {
  const userId = await requireUserId();
  const existing = await prisma.workoutSet.findFirst({
    where: {
      id: setId,
      sessionExercise: {
        session: { userId, status: editableSessionStatusWhere() },
      },
    },
    select: { startedAt: true, endedAt: true },
  });

  if (!existing) {
    return {
      ok: false as const,
      error: "Set not found or session is not editable.",
    };
  }

  if (existing.startedAt && !existing.endedAt) {
    return {
      ok: true as const,
      startedAt: existing.startedAt.toISOString(),
      resumed: true as const,
    };
  }

  const startedAt = new Date();
  await prisma.workoutSet.update({
    where: { id: setId },
    data: { startedAt, endedAt: null },
  });

  return {
    ok: true as const,
    startedAt: startedAt.toISOString(),
    resumed: false as const,
  };
}

export async function endWorkoutSetTimer(setId: string) {
  const userId = await requireUserId();
  const existing = await prisma.workoutSet.findFirst({
    where: {
      id: setId,
      sessionExercise: {
        session: { userId, status: editableSessionStatusWhere() },
      },
    },
    select: { startedAt: true },
  });

  if (!existing) {
    return {
      ok: false as const,
      error: "Set not found or session is not editable.",
    };
  }

  const endedAt = new Date();
  await prisma.workoutSet.update({
    where: { id: setId },
    data: { endedAt },
  });

  const durationSeconds = existing.startedAt
    ? Math.max(
        0,
        Math.round(
          (endedAt.getTime() - existing.startedAt.getTime()) / 1000,
        ),
      )
    : null;

  return {
    ok: true as const,
    startedAt: existing.startedAt?.toISOString() ?? null,
    endedAt: endedAt.toISOString(),
    durationSeconds,
  };
}

export async function saveWorkoutSetFilmed(setId: string, filmed: boolean) {
  const userId = await requireUserId();
  const existing = await prisma.workoutSet.findFirst({
    where: {
      id: setId,
      sessionExercise: {
        session: { userId, status: editableSessionStatusWhere() },
      },
    },
    select: { intensifierDetails: true },
  });

  if (!existing) {
    return {
      ok: false as const,
      error: "Set not found or session is not editable.",
    };
  }

  const current = parseStoredDetails(existing.intensifierDetails);
  const details: StoredIntensifierDetails = { ...current, filmed };
  const hasDetails =
    details.clusterCount !== null ||
    details.dropSets.length > 0 ||
    details.filmed;

  await prisma.workoutSet.update({
    where: { id: setId },
    data: {
      intensifierDetails: hasDetails
        ? (details as Prisma.InputJsonValue)
        : Prisma.DbNull,
    },
  });

  return { ok: true as const };
}

export async function saveWorkoutSetIntensifierDetails(
  setId: string,
  payload: IntensifierPayload,
) {
  const userId = await requireUserId();
  const details = sanitizeDetails(payload);
  const hasDetails =
    details.clusterCount !== null ||
    details.dropSets.length > 0 ||
    details.filmed;

  const result = await prisma.workoutSet.updateMany({
    where: {
      id: setId,
      sessionExercise: {
        session: { userId, status: editableSessionStatusWhere() },
      },
    },
    data: {
      intensifierDetails: hasDetails
        ? (details as Prisma.InputJsonValue)
        : Prisma.DbNull,
    },
  });

  return result.count === 1
    ? { ok: true as const }
    : {
        ok: false as const,
        error: "Set not found or session is not editable.",
      };
}
