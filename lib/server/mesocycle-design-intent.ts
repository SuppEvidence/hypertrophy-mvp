import "server-only";
import { prisma } from "@/lib/db/prisma";
import { approvedDesignContext } from "@/lib/mesocycle-design/handoff";
/** Optional current planning intent for exercise/photo analysis; never starts coaching. */
export async function currentDesignIntent(userId: string, exerciseId?: string) {
  const now = new Date();
  const block = await prisma.programMesocycle.findFirst({
    where: {
      userId,
      isArchived: false,
      actualEndDate: null,
      startDate: { lte: now },
      program: { userId, isActive: true, isArchived: false },
    },
    orderBy: { startDate: "desc" },
    select: {
      startDate: true,
      lengthWeeks: true,
      approvedDesign: true,
      musclePriorities: { select: { muscleId: true, priority: true } },
    },
  });
  if (
    !block ||
    block.startDate.getTime() + block.lengthWeeks * 7 * 86400000 <=
      now.getTime()
  )
    return null;
  const intent = approvedDesignContext(block.approvedDesign, exerciseId);
  if (!intent) return null;
  return {
    ...intent,
    currentAcceptedPriorities: block.musclePriorities,
    asOf: now.toISOString().slice(0, 10),
    interpretation:
      "Current planning intent only. Assess observed anatomy/exercise mechanics independently; goals never prove target emphasis or historical growth.",
  };
}
