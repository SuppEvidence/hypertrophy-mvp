import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { classificationFromProfile } from "@/lib/coaching/exercise-classification";

/** Bounded, resumable deterministic conversion. Never imports an AI client. */
export async function syncSavedExerciseProfiles(userId: string, limit = 10) {
  const candidates = await prisma.exerciseCoachingProfile.findMany({ where: { userId, mechanicsProfile: { not: Prisma.DbNull } },
    orderBy: { id: "asc" }, select: { id: true, exerciseId: true, mechanicsRevision: true, classificationSyncedRevision: true } });
  const pending = candidates.filter(p => p.classificationSyncedRevision !== p.mechanicsRevision);
  const muscles = pending.length ? await prisma.muscle.findMany() : [];
  let applied = 0; let review = 0; let skipped = 0;
  for (const candidate of pending.slice(0,limit)) {
    await prisma.$transaction(async tx => {
      const profile = await tx.exerciseCoachingProfile.findFirst({ where: { id: candidate.id, userId } });
      if (!profile || profile.mechanicsRevision !== candidate.mechanicsRevision || profile.classificationSyncedRevision === profile.mechanicsRevision) return;
      const exercise = await tx.exercise.findFirst({ where: { id: profile.exerciseId, OR: [{ userId }, { userId: null, isSeed: true }] }, include: { primaryMuscles: true, secondaryMuscles: true } });
      if (!exercise) return;
      const classification = classificationFromProfile(exercise,profile.mechanicsProfile,profile.executionSetup,muscles,profile.mechanicsRevision);
      const result = await tx.exerciseCoachingProfile.updateMany({ where: { id: profile.id, userId, mechanicsRevision: profile.mechanicsRevision },
        data: { appliedClassification: classification ? classification as unknown as Prisma.InputJsonValue : Prisma.DbNull,
          classificationSyncedRevision: profile.mechanicsRevision } });
      if (result.count) { if (!classification) skipped++; else if (classification.source === "COACH") applied++; else review++; }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  return { applied, review, skipped, remaining: Math.max(0,pending.length-limit) };
}
