"use server";

import { Prisma, type WorkoutCoachActionType } from "@prisma/client";
import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";
import { buildLiveExerciseCoachingContext } from "@/lib/server/live-coaching-context";

type JsonObject = Record<string, unknown>;

function jsonObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function inputJson(value: JsonObject): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function recordWorkoutCoachAction(input: {
  sessionId: string;
  sessionExerciseId: string;
  triggerSetId: string;
  actionType: WorkoutCoachActionType;
  confidence: "LOW" | "MODERATE" | "HIGH";
  reasonCode: string;
  reason: string;
  evidence: JsonObject;
  beforeState: JsonObject;
  proposedState: JsonObject;
}) {
  const userId = await requireUserId();
  const context = await buildLiveExerciseCoachingContext({
    userId,
    sessionId: input.sessionId,
    sessionExerciseId: input.sessionExerciseId,
    triggerSetId: input.triggerSetId,
  });

  if (!context.eligibility.shouldCheck) {
    return { ok: false as const, skipped: true as const, reason: context.eligibility.reason };
  }

  let action;
  try {
    action = await prisma.workoutCoachAction.create({
      data: {
        userId,
        sessionId: input.sessionId,
        sessionExerciseId: input.sessionExerciseId,
        triggerSetId: input.triggerSetId,
        actionType: input.actionType,
        confidence: input.confidence,
        reasonCode: input.reasonCode.slice(0, 100),
        reason: input.reason.slice(0, 800),
        evidence: inputJson({ ...input.evidence, eligibilityTrigger: context.eligibility.trigger }),
        beforeState: inputJson(input.beforeState),
        proposedState: inputJson(input.proposedState),
      },
      select: { id: true, status: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false as const, skipped: true as const, reason: "CHECK_ALREADY_RECORDED" as const };
    }
    throw error;
  }

  return { ok: true as const, action };
}

export async function applyWorkoutCoachAction(actionId: string) {
  const userId = await requireUserId();
  const action = await prisma.workoutCoachAction.findFirst({
    where: { id: actionId, userId, status: "PROPOSED", session: { status: "DRAFT" } },
    include: {
      sessionExercise: {
        include: { sets: { orderBy: { setNumber: "asc" } } },
      },
      triggerSet: { select: { setNumber: true } },
    },
  });
  if (!action) return { ok: false as const, error: "Coaching action is no longer available." };

  const proposal = jsonObject(action.proposedState);
  const requestedIds = Array.isArray(proposal.targetSetIds)
    ? proposal.targetSetIds.filter((id): id is string => typeof id === "string")
    : [];
  const remainingSets = action.sessionExercise.sets.filter(
    (set) => !set.isCompleted && set.setNumber > (action.triggerSet?.setNumber ?? 0),
  );
  const targetSets = requestedIds.length
    ? remainingSets.filter((set) => requestedIds.includes(set.id))
    : remainingSets.slice(0, 1);

  const prescriptionPatch = jsonObject(proposal.prescription);
  const appliedState = {
    ...proposal,
    targetSetIds: targetSets.map((set) => set.id),
    prescription: prescriptionPatch,
  };

  await prisma.$transaction(async (tx) => {
    for (const set of targetSets) {
      const stored = jsonObject(set.prescription);
      const current = jsonObject(stored.current);
      await tx.workoutSet.update({
        where: { id: set.id },
        data: {
          prescription: inputJson({
            ...stored,
            current: {
              ...current,
              ...prescriptionPatch,
              source: "AI_AUTOREGULATION",
              coachActionId: action.id,
            },
          }),
        },
      });
    }
    await tx.workoutCoachAction.update({
      where: { id: action.id },
      data: {
        status: "APPLIED",
        appliedState: inputJson(appliedState),
        appliedAt: new Date(),
      },
    });
  });

  return { ok: true as const, appliedState };
}

export async function declineWorkoutCoachAction(actionId: string) {
  const userId = await requireUserId();
  const result = await prisma.workoutCoachAction.updateMany({
    where: { id: actionId, userId, status: "PROPOSED" },
    data: { status: "DECLINED" },
  });
  return result.count === 1
    ? { ok: true as const }
    : { ok: false as const, error: "Coaching action is no longer available." };
}
