"use server";

import { requireUserId } from "@/lib/auth/user";
import { applyCoachActionForUser } from "@/lib/server/workout-coach-engine";
import { prisma } from "@/lib/db/prisma";

/** Only removal needs approval. Target adjustments are applied by the server coach. */
export async function applyWorkoutCoachAction(actionId: string) {
  return applyCoachActionForUser(await requireUserId(), actionId, true);
}

export async function declineWorkoutCoachAction(actionId: string) {
  const userId = await requireUserId();
  const result = await prisma.workoutCoachAction.updateMany({
    where: { id: actionId, userId, status: "PROPOSED", actionType: { in: ["REMOVE_SET", "STOP_EXERCISE"] } },
    data: { status: "DECLINED" },
  });
  return result.count === 1 ? { ok: true as const } : { ok: false as const, error: "Recommendation is no longer available." };
}
