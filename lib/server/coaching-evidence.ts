import { prisma } from "@/lib/db/prisma";
import { summarizeExerciseHistory, type ExerciseExposureInput } from "@/lib/calculations/training-analytics";
import { inferLocalReadiness, summarizeGlobalRecovery } from "@/lib/coaching/pre-workout-coach-policy";

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value); return Number.isFinite(n) ? n : null;
}
type HistoryRow = Awaited<ReturnType<typeof loadCoachingHistory>>[number];

function executionCompromised(value: unknown) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).executionCompromised === true);
}

export async function loadCoachingHistory(userId: string, programId: string, since: Date) {
  return prisma.workoutSessionExercise.findMany({
    where: { session: { userId, programId, status: "COMPLETED", performedAt: { gte: since, lte: new Date() } } },
    orderBy: { session: { performedAt: "desc" } },
    take: 500,
    select: {
      exerciseId: true,
      templateExerciseId: true,
      painFlag: true,
      painImpact: true,
      exercise: { select: { name: true, movementGroupId: true,
        primaryMuscles: { select: { muscleId: true } }, secondaryMuscles: { select: { muscleId: true } },
      } },
      session: { select: { templateId: true, performedAt: true } },
      sets: {
        where: { isCompleted: true }, orderBy: { setNumber: "asc" },
        select: {
          setNumber: true, weight: true, reps: true, rir: true, painFlag: true, intensifierDetails: true,
          setType: { select: { multiplier: true, isIntensifier: true } },
        },
      },
    },
  });
}

export function coachingExposure(row: HistoryRow): ExerciseExposureInput {
  return {
    performedAt: row.session.performedAt,
    sets: row.sets.map((set) => {
      const comparable = !set.setType.isIntensifier && !executionCompromised(set.intensifierDetails);
      return {
        setNumber: set.setNumber,
        weight: comparable ? set.weight : null,
        reps: comparable ? set.reps : null,
        rir: comparable ? set.rir : null,
        isCompleted: true,
        painFlag: set.painFlag || row.painFlag,
        setTypeMultiplier: set.setType.multiplier,
        isIntensifier: set.setType.isIntensifier,
      };
    }),
  };
}

export function summarizeMovementReadiness(args: {
  movementGroups: Array<{ id: string; name: string }>;
  history: HistoryRow[];
  globalRecoveryStatus: ReturnType<typeof summarizeGlobalRecovery>["status"];
  now: Date;
}) {
  const historyByExercise = new Map<string, ExerciseExposureInput[]>();
  for (const row of [...args.history].reverse()) {
    const rows = historyByExercise.get(row.exerciseId) ?? [];
    rows.push(coachingExposure(row));
    historyByExercise.set(row.exerciseId, rows);
  }
  const historySummary = new Map(
    [...historyByExercise.entries()].map(([exerciseId, rows]) => [exerciseId, summarizeExerciseHistory(rows)]),
  );
  return args.movementGroups.map((movement) => {
    const rows = args.history.filter((row) => row.exercise.movementGroupId === movement.id);
    const latest = rows[0]?.session.performedAt ?? null;
    const cutoff48 = args.now.getTime() - 48 * 3_600_000;
    const cutoff72 = args.now.getTime() - 72 * 3_600_000;
    const cutoff14d = args.now.getTime() - 14 * 86_400_000;
    const effectiveSetsSince = (cutoff: number) => rows
      .filter((row) => row.session.performedAt.getTime() >= cutoff)
      .reduce((sum, row) => sum + row.sets.reduce((setSum, set) => setSum + Math.max(0, Number(set.setType.multiplier)), 0), 0);
    const recent = rows.filter((row) => row.session.performedAt.getTime() >= cutoff14d);
    const exerciseIds = [...new Set(rows.map((row) => row.exerciseId))];
    const downwardExerciseSignals = exerciseIds.filter((id) => {
      const summary = historySummary.get(id);
      return summary?.performanceDirection === "DOWN" && summary.confidence !== "INSUFFICIENT";
    }).length;
    return inferLocalReadiness({
      movementGroupId: movement.id,
      movementGroupName: movement.name,
      hoursSinceLastExposure: latest ? Math.max(0, (args.now.getTime() - latest.getTime()) / 3_600_000) : null,
      effectiveSetsLast48h: effectiveSetsSince(cutoff48),
      effectiveSetsLast72h: effectiveSetsSince(cutoff72),
      performanceExposureCount: rows.filter((row) => row.sets.some((set) => numberOrNull(set.weight) !== null && set.reps !== null)).length,
      downwardExerciseSignals,
      recentPainSets: 0,
      recentPainExposures: recent.filter((row) => row.painFlag || row.sets.some((set) => set.painFlag)).length,
      recentCompromisedSets: recent.reduce((sum, row) => sum + row.sets.filter((set) => executionCompromised(set.intensifierDetails)).length, 0),
      globalRecoveryStatus: args.globalRecoveryStatus,
    });
  });
}
