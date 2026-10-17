import { getNutritionTrainingContext } from "./nutrition-context";
import "server-only";
import { Prisma } from "@prisma/client";
import { resolveExerciseRead } from "./effective-exercise-data";
import { approvedDesignContext } from "@/lib/mesocycle-design/handoff";
import { prisma } from "@/lib/db/prisma";
import { getUserExercisePrisma } from "./effective-exercise-data";
import { activeExerciseWhere } from "./exercise-catalog-policy";
import {
  mechanicsBasis,
  summarizeExerciseMechanics,
} from "@/lib/coaching/exercise-mechanics";
import { getPhysiqueEvidence } from "./physique-evidence";
import { getEnergyPhaseContext, getEnergyPhaseTimeline } from "./energy-phases";
import { type DesignReferences } from "@/lib/mesocycle-design/schema";
import { summarizeExerciseHistory } from "@/lib/calculations/training-analytics";
import { coachingExposure, loadCoachingHistory } from "./coaching-evidence";
export async function getDesignReferences(
  userId: string,
  tx?: Prisma.TransactionClient,
): Promise<DesignReferences> {
  const db = tx ?? getUserExercisePrisma(userId);
  const [exercises, setTypes, muscles] = await Promise.all([
    db.exercise.findMany({
      where: activeExerciseWhere(userId),
      orderBy: { name: "asc" },
      include: {
        movementGroup: true,
        primaryMuscles: true,
        secondaryMuscles: true,
        coachingProfiles: { where: { userId }, take: 1 },
      },
    }),
    db.setType.findMany({
      where: { isActive: true, OR: [{ userId }, { userId: null }] },
      orderBy: { sortOrder: "asc" },
    }),
    db.muscle.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const effective = tx
    ? (resolveExerciseRead(
        "Exercise",
        exercises,
        new Map(
          exercises.flatMap((e) =>
            e.coachingProfiles.map((p) => [e.id, p] as const),
          ),
        ),
        new Map(muscles.map((m) => [m.id, m])),
      ) as typeof exercises)
    : exercises;
  return {
    exercises: effective.map((e) => ({
      id: e.id,
      name: e.name,
      movementGroupId: e.movementGroupId,
      movementGroupName: e.movementGroup.name,
      primaryMuscleIds: e.primaryMuscles.map((m) => m.muscleId),
      secondaryMuscles: e.secondaryMuscles.map((m) => ({
        muscleId: m.muscleId,
        fraction: Number(m.contributionEstimate ?? 0),
      })),
      preference: e.coachingProfiles[0]?.preference ?? "NEUTRAL",
      intensifierPreference:
        e.coachingProfiles[0]?.intensifierPreference ?? "DEFAULT",
      allowedIntensifierIds: e.coachingProfiles[0]?.allowedIntensifierIds ?? [],
      notes: e.coachingProfiles[0]?.notes ?? null,
      mechanics: summarizeExerciseMechanics(
        e.coachingProfiles[0]?.mechanicsProfile,
        mechanicsBasis(e, e.coachingProfiles[0]?.executionSetup ?? null),
      ),
    })),
    setTypes: setTypes.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      multiplier: Number(t.multiplier),
      isIntensifier: t.isIntensifier,
    })),
    muscles: muscles.map((m) => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      accountingSlug: m.accountingSlug,
    })),
  };
}
export async function buildDesignEvidence(userId: string, compact = false) {
  const since = new Date(Date.now() - 120 * 86400000);
  const [
    history,
    metrics,
    blocks,
    settings,
    physique,
    energyPhase,
    energyTimeline,
  ] = await Promise.all([
    loadCoachingHistory(userId, null, since),
    prisma.metricLog.findMany({
      where: {
        userId,
        isDraft: false,
        loggedAt: { gte: since, lte: new Date() },
      },
      orderBy: { loggedAt: "desc" },
      take: 30,
      select: {
        loggedAt: true,
        bodyweight: true,
        waist: true,
        chest: true,
        shoulders: true,
        arms: true,
        thighs: true,
        sleepDuration: true,
        sleepQuality: true,
        stress: true,
        readiness: true,
        manualFatigue: true,
        sorenessJointIrritation: true,
      },
    }),
    prisma.programMesocycle.findMany({
      where: { userId, startDate: { lte: new Date() } },
      orderBy: { startDate: "desc" },
      take: 6,
      select: {
        name: true,
        phase: true,
        startDate: true,
        lengthWeeks: true,
        actualEndDate: true,
        aiRecommendation: true,
        t3Assessment: true,
        approvedDesign: true,
        musclePriorities: { include: { muscle: true } },
      },
    }),
    prisma.userSettings.findUnique({
      where: { userId },
      select: { physiqueGoal: true, physiqueTrainingLevel: true },
    }),
    getPhysiqueEvidence(userId),
    getEnergyPhaseContext(userId),
    getEnergyPhaseTimeline(userId),
  ]);
  const ids = [...new Set(history.map((r) => r.exerciseId))];
  const exerciseHistory = ids.map((id) => {
    const rows = history.filter((r) => r.exerciseId === id);
    return {
      exerciseId: id,
      name: rows[0].exercise.name,
      summary: summarizeExerciseHistory(
        [...rows].reverse().map(coachingExposure),
      ),
      recentExposures: rows.slice(0, compact ? 1 : 5).map((r) => ({
        date: r.session.performedAt,
        pain: r.painFlag,
        painImpact: r.painImpact,
        primary: r.exercise.primaryMuscles.map((m) => m.muscleId),
        sets: compact
          ? undefined
          : r.sets.map((s) => ({
              weight: s.weight,
              reps: s.reps,
              rir: s.rir,
              pain: s.painFlag,
              format: s.setType.name,
              multiplier: s.setType.multiplier,
            })),
      })),
    };
  });
  return JSON.parse(
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      historyWindowDays: 120,
      detail: compact
        ? "REVISION_SUMMARIES: full-window exercise summaries, latest pain signals, current metrics, goals and block conclusions; raw sets and old approved plans omitted"
        : "INITIAL_DESIGN",
      historyRows: history.length,
      limits:
        "At most 500 exercise exposures, 30 metrics and six blocks; missing data is unknown. Performance comparisons are exercise-specific, not causal proof. Historical mappings use workout snapshots.",
      settings,
      physique,
      nutritionContext: await getNutritionTrainingContext(userId),
      energyPhase,
      energyTimeline,
      metrics,
      exerciseHistory,
      previousBlocks: blocks.map((b) => ({
        name: b.name,
        phase: b.phase,
        startDate: b.startDate,
        lengthWeeks: b.lengthWeeks,
        actualEndDate: b.actualEndDate,
        approvedIntent: compact
          ? undefined
          : approvedDesignContext(b.approvedDesign),
        reviewSummary: reviewSummary(b.aiRecommendation),
        volumeReview: reviewSummary(b.t3Assessment),
        musclePriorities: b.musclePriorities.map((p) => ({
          muscleId: p.muscleId,
          name: p.muscle.name,
          priority: p.priority,
          baseline: p.baselineWeeklySets,
          currentTarget: p.coachTargetWeeklySets,
          rationale: p.rationale,
        })),
      })),
    }),
  );
}

function reviewSummary(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  return {
    summary: v.summary ?? v.globalSummary ?? null,
    nextPriorities: v.nextPriorities ?? null,
    limitations: v.limitations ?? null,
  };
}
