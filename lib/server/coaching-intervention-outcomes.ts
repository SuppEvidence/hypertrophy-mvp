import { secondaryContributionFor } from "@/lib/coaching/secondary-contribution";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

const DAY_MS = 86_400_000;

// These are observations of what happened after a decision, never a causal estimate
// of hypertrophy or proof that the intervention was beneficial.
export async function evaluateCoachingInterventionsAfterWorkout(userId: string, sessionId: string) {
  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId, status: "COMPLETED" },
    include: { exercises: { include: { exercise: { select: { primaryMuscles: true, secondaryMuscles: true } },
      sets: { where: { isCompleted: true }, include: { setType: { select: { multiplier: true } } } } } } },
  });
  if (!session) return;

  const t2 = await prisma.coachingIntervention.findFirst({
    where: { userId, sessionId, stage: "T2_PRE_WORKOUT", status: "ACCEPTED", evaluatedAt: null },
  });
  if (t2) {
    const completed = session.exercises.flatMap((row) => row.sets);
    await prisma.coachingIntervention.updateMany({
      where: { id: t2.id, evaluatedAt: null },
      data: { evaluatedAt: new Date(), outcome: {
        scope: "COMPLETED_SESSION_OBSERVATION", causalBenefitEstablished: false,
        completedPhysicalSets: completed.length,
        completedEstimatedEffectiveSets: Number(completed.reduce((sum, set) => sum + Number(set.setType.multiplier), 0).toFixed(2)),
        exercisesWithSymptoms: session.exercises.filter((row) => row.painFlag || row.sets.some((set) => set.painFlag)).length,
        compromisedSets: completed.filter((set) => {
          const detail = set.intensifierDetails;
          return detail && typeof detail === "object" && !Array.isArray(detail) && detail.executionCompromised === true;
        }).length,
        note: "Records completed work and symptoms, not whether the workout caused muscle growth.",
      } as Prisma.InputJsonValue },
    });
  }

  const now = new Date();
  const pending = await prisma.coachingIntervention.findMany({
    where: { userId, programId: session.programId, stage: "T3_VOLUME", status: "ACCEPTED", evaluatedAt: null,
      decidedAt: { lte: new Date(now.getTime() - 14 * DAY_MS) } },
    include: { sourceDecision: { select: { targetMuscleId: true } } },
    orderBy: { decidedAt: "asc" }, take: 5,
  });
  if (!pending.length) return;

  for (const entry of pending) {
    if (!entry.decidedAt || !entry.sourceDecision?.targetMuscleId) continue;
    const end = new Date(Math.min(now.getTime(), entry.decidedAt.getTime() + 28 * DAY_MS));
    const sessions = await prisma.workoutSession.findMany({
      where: { userId, programId: entry.programId, status: "COMPLETED", performedAt: { gte: entry.decidedAt, lte: end } },
      select: { performedAt: true, exercises: { select: {
        painFlag: true, exercise: { select: { primaryMuscles: { select: { muscleId: true } }, secondaryMuscles: { select: { muscleId: true, contributionEstimate: true } } } },
        sets: { where: { isCompleted: true }, select: { painFlag: true, setType: { select: { multiplier: true } } } },
      } } },
      take: 60,
    });
    const muscleId = entry.sourceDecision.targetMuscleId;
    let exposures = 0;
    let effective = 0;
    let symptomatic = 0;
    for (const workout of sessions) {
      for (const row of workout.exercises) {
        const factor = row.exercise.primaryMuscles.some((link) => link.muscleId === muscleId) ? 1
          : secondaryContributionFor(row.exercise.secondaryMuscles.find((link) => link.muscleId === muscleId));
        if (!factor || !row.sets.length) continue;
        exposures += 1;
        effective += row.sets.reduce((sum, set) => sum + Number(set.setType.multiplier) * factor, 0);
        if (row.painFlag || row.sets.some((set) => set.painFlag)) symptomatic += 1;
      }
    }
    if (exposures < 3 && now.getTime() - entry.decidedAt.getTime() < 42 * DAY_MS) continue;
    const observedDays = Math.max(7, (end.getTime() - entry.decidedAt.getTime()) / DAY_MS);
    await prisma.coachingIntervention.updateMany({ where: { id: entry.id, evaluatedAt: null }, data: {
      evaluatedAt: now,
      outcome: {
        scope: "FOLLOW_UP_TRAINING_OBSERVATION", causalBenefitEstablished: false,
        confidence: exposures >= 3 ? "LIMITED" : "INSUFFICIENT",
        observationDays: Number(observedDays.toFixed(1)),
        completedSessions: sessions.length,
        targetMuscleExposures: exposures,
        actualWeeklyEstimatedEffectiveSets: Number((effective * 7 / observedDays).toFixed(1)),
        symptomFlaggedExposures: symptomatic,
        note: "A dose and tolerability observation; performance, measurement context and other changes must be reviewed separately.",
      } as Prisma.InputJsonValue,
    } });
  }
}
