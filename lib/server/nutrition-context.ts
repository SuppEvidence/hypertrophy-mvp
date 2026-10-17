import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { baselineSchema, reportSchema } from "@/lib/nutrition/schema";
import { getPhysiqueEvidence } from "./physique-evidence";
import { getEnergyPhaseTimeline } from "./energy-phases";
import { interpretEnergyPhase } from "@/lib/coaching/energy-phase";
import { coachingExposure, loadCoachingHistory } from "./coaching-evidence";
import { summarizeExerciseHistory } from "@/lib/calculations/training-analytics";

/** No AI. Exact timestamp filtering prevents today's decisions leaking into historical workouts/photos. */
export async function getNutritionTrainingContext(
  userId: string,
  at = new Date(),
) {
  const [accepted, report] = await Promise.all([
    prisma.nutritionEvent.findFirst({
      where: {
        userId,
        kind: { in: ["BASELINE", "ACCEPTED"] },
        createdAt: { lte: at },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.nutritionEvent.findFirst({
      where: { userId, kind: "CHECK_IN", createdAt: { lte: at } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!accepted && !report) return null;
  const baseline = baselineSchema.safeParse(accepted?.baseline);
  const details = accepted?.details as Record<string, unknown> | undefined;
  const r = reportSchema.safeParse(report?.details);
  return {
    updatedAt: new Date(
      Math.max(
        accepted?.createdAt.getTime() ?? 0,
        report?.createdAt.getTime() ?? 0,
      ),
    ).toISOString(),
    acceptedAt: accepted?.createdAt.toISOString() ?? null,
    goal: baseline.success ? baseline.data.goal : null,
    acceptedChange:
      typeof details?.summary === "string"
        ? details.summary.slice(0, 1200)
        : null,
    trainingHandoff:
      typeof details?.trainingHandoff === "string"
        ? details.trainingHandoff
        : null,
    reviewDueOn: details?.reviewDueOn ?? null,
    phaseApplied: details?.phaseApplied ?? false,
    phaseGuidance:
      "Only the current energy-phase timeline establishes the phase. A proposed phase may have been declined.",
    report: r.success
      ? {
          ...r.data,
          reportedAt: report!.createdAt.toISOString(),
          predatesLatestAcceptance: Boolean(
            accepted && report!.createdAt < accepted.createdAt,
          ),
        }
      : null,
    interpretation:
      "Accepted intent is not adherence. Self-reports are dated and can be stale. Use the existing energy-phase timeline; do not infer calorie intake or body composition. No meal history is included.",
  };
}

/** Lightweight freshness metadata, not full evidence or an AI call. Counts also detect deletion. */
export async function nutritionEvidenceStamp(
  userId: string,
  db: Prisma.TransactionClient = prisma,
) {
  const [metrics, sessions, phases, photos, events, blocks, settings] =
    await Promise.all([
      db.metricLog.aggregate({
        where: { userId, isDraft: false },
        _max: { updatedAt: true },
        _count: true,
      }),
      db.workoutSession.aggregate({
        where: { userId, status: "COMPLETED" },
        _max: { updatedAt: true },
        _count: true,
      }),
      db.energyPhase.findMany({
        where: { userId },
        orderBy: { startDate: "asc" },
        select: { phase: true, startDate: true, updatedAt: true },
      }),
      db.physiqueCheckin.aggregate({
        where: { userId },
        _max: { updatedAt: true },
        _count: true,
      }),
      db.nutritionEvent.aggregate({
        where: { userId },
        _max: { createdAt: true },
        _count: true,
      }),
      db.programMesocycle.aggregate({
        where: { userId },
        _max: { updatedAt: true },
        _count: true,
      }),
      db.userSettings.findUnique({
        where: { userId },
        select: { updatedAt: true },
      }),
    ]);
  return createHash("sha256")
    .update(
      JSON.stringify({
        metrics,
        sessions,
        phases,
        activePhase: interpretEnergyPhase(phases)?.startDate ?? null,
        photos,
        events,
        blocks,
        settings,
      }),
    )
    .digest("hex");
}

export async function buildNutritionEvidence(userId: string) {
  const now = new Date();
  const since = new Date(now.getTime() - 56 * 86400000);
  const [metrics, history, physique, phases, events, blocks, settings] =
    await Promise.all([
      prisma.metricLog.findMany({
        where: { userId, isDraft: false, loggedAt: { gte: since, lte: now } },
        orderBy: { loggedAt: "desc" },
        take: 240,
        select: {
          loggedAt: true,
          bodyweight: true,
          waist: true,
          chest: true,
          shoulders: true,
          arms: true,
          thighs: true,
          glutes: true,
          calves: true,
          sleepDuration: true,
          sleepQuality: true,
          stress: true,
          readiness: true,
          manualFatigue: true,
          sorenessJointIrritation: true,
          steps: true,
        },
      }),
      loadCoachingHistory(userId, null, since),
      getPhysiqueEvidence(userId),
      prisma.energyPhase.findMany({
        where: { userId },
        orderBy: { startDate: "desc" },
        take: 24,
      }),
      prisma.nutritionEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { kind: true, createdAt: true, details: true },
      }),
      prisma.programMesocycle.findMany({
        where: { userId, startDate: { lte: now } },
        orderBy: { startDate: "desc" },
        take: 3,
        select: {
          name: true,
          startDate: true,
          phase: true,
          lengthWeeks: true,
          t3Assessment: true,
          t3LastEvaluatedAt: true,
          aiRecommendation: true,
          musclePriorities: {
            select: { priority: true, muscle: { select: { name: true } } },
          },
        },
      }),
      prisma.userSettings.findUnique({
        where: { userId },
        select: { physiqueGoal: true, physiqueTrainingLevel: true },
      }),
    ]);
  // Average one value per day first so repeated logging does not overweight a day.
  const fields = [
    "bodyweight",
    "waist",
    "chest",
    "shoulders",
    "arms",
    "thighs",
    "glutes",
    "calves",
    "sleepDuration",
    "sleepQuality",
    "stress",
    "readiness",
    "manualFatigue",
    "sorenessJointIrritation",
    "steps",
  ] as const;
  const weekly = Array.from({ length: 8 }, (_, index) => {
    const end = new Date(now.getTime() - index * 7 * 86400000);
    const start = new Date(end.getTime() - 7 * 86400000);
    const rows = metrics.filter((m) => m.loggedAt > start && m.loggedAt <= end);
    return {
      from: start.toISOString(),
      to: end.toISOString(),
      observations: Object.fromEntries(
        fields.map((key) => {
          const days = new Map<string, number>();
          for (const row of rows)
            if (
              row[key] !== null &&
              !days.has(row.loggedAt.toISOString().slice(0, 10))
            )
              days.set(
                row.loggedAt.toISOString().slice(0, 10),
                Number(row[key]),
              );
          const values = [...days.values()];
          return [
            key,
            {
              days: values.length,
              mean: values.length
                ? Math.round(
                    (values.reduce((a, b) => a + b, 0) / values.length) * 100,
                  ) / 100
                : null,
            },
          ];
        }),
      ),
    };
  });
  const exerciseIds = [...new Set(history.map((h) => h.exerciseId))].slice(
    0,
    35,
  );
  function summary(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const v = value as Record<string, unknown>;
    return {
      summary: String(v.summary ?? v.globalSummary ?? "").slice(0, 1500),
      phaseRecommendation: v.phaseRecommendation ?? null,
    };
  }
  return {
    asOf: now.toISOString(),
    windowDays: 56,
    settings,
    limits:
      "Up to 240 metric rows and 500 exercise exposures, 35 exercises, 12 nutrition events, 3 blocks. Weekly means use latest non-null entry per day. Weight kg; circumferences mm. Performance is a noisy within-exercise indicator, not proof of hypertrophy. No raw photos/sets or complete diet history.",
    phase: interpretEnergyPhase(phases, now),
    timeline: await getEnergyPhaseTimeline(userId),
    scheduledPhases: phases
      .filter((p) => p.startDate > now)
      .map((p) => ({ phase: p.phase, startDate: p.startDate })),
    weekly,
    physique,
    training: exerciseIds.map((id) => {
      const rows = history.filter((h) => h.exerciseId === id);
      return {
        exercise: rows[0].exercise.name,
        movementPatternId: rows[0].exercise.movementGroupId,
        first: rows.at(-1)!.session.performedAt,
        last: rows[0].session.performedAt,
        ...summarizeExerciseHistory(rows.map(coachingExposure)),
      };
    }),
    blocks: blocks.map((b) => ({
      name: b.name,
      startDate: b.startDate,
      phase: b.phase,
      lengthWeeks: b.lengthWeeks,
      priorities: b.musclePriorities,
      volumeReviewedAt: b.t3LastEvaluatedAt,
      volumeReview: summary(b.t3Assessment),
      mesocycleReview: summary(b.aiRecommendation),
    })),
    recentNutritionEvents: events.map((e) => {
      const d = e.details as Record<string, unknown>;
      return {
        kind: e.kind,
        createdAt: e.createdAt,
        details:
          e.kind === "CHECK_IN"
            ? d
            : {
                summary: d.summary,
                reviewCriteria: d.reviewCriteria,
                reviewDueOn: d.reviewDueOn,
                phaseApplied: d.phaseApplied,
                trainingHandoff: d.trainingHandoff,
              },
      };
    }),
  };
}
