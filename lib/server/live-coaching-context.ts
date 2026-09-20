import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { evaluateLiveCoachEligibility } from "@/lib/coaching/live-coaching";

const EXERCISE_HISTORY_LIMIT = 8;
const CROSS_CONTEXT_DAYS = 7;

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function details(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { filmed: false, executionCompromised: false };
  }
  return {
    filmed: value.filmed === true,
    executionCompromised: value.executionCompromised === true,
  };
}

function performanceIndex(weight: unknown, reps: number | null, rir: unknown) {
  const numericWeight = numberOrNull(weight);
  const numericRir = numberOrNull(rir);
  if (numericWeight === null || numericWeight <= 0 || !reps || reps <= 0) return null;
  return numericWeight * (1 + (reps + (numericRir ?? 0)) / 30);
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function hoursBetween(earlier: Date | null, later: Date) {
  return earlier
    ? Math.round(((later.getTime() - earlier.getTime()) / 3_600_000) * 10) / 10
    : null;
}

export async function buildLiveExerciseCoachingContext(params: {
  userId: string;
  sessionId: string;
  sessionExerciseId: string;
  triggerSetId: string;
}) {
  const current = await prisma.workoutSessionExercise.findFirst({
    where: {
      id: params.sessionExerciseId,
      sessionId: params.sessionId,
      session: { userId: params.userId },
    },
    include: {
      session: { select: { id: true, status: true, performedAt: true } },
      exercise: {
        include: {
          movementGroup: true,
          primaryMuscles: { include: { muscle: true } },
          secondaryMuscles: { include: { muscle: true } },
        },
      },
      sets: { orderBy: { setNumber: "asc" }, include: { setType: true } },
      coachActions: {
        where: { triggerSetId: params.triggerSetId },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!current) throw new Error("Workout exercise not found.");

  const triggerSet = current.sets.find((set) => set.id === params.triggerSetId);
  if (!triggerSet) throw new Error("Trigger set does not belong to this exercise.");

  const primaryMuscleIds = current.exercise.primaryMuscles.map((link) => link.muscleId);
  const secondaryMuscleIds = current.exercise.secondaryMuscles.map((link) => link.muscleId);
  const allMuscleIds = [...new Set([...primaryMuscleIds, ...secondaryMuscleIds])];
  const lookbackStart = new Date(current.session.performedAt);
  lookbackStart.setDate(lookbackStart.getDate() - CROSS_CONTEXT_DAYS);

  const [exerciseHistory, recentContext, recovery] = await Promise.all([
    prisma.workoutSessionExercise.findMany({
      where: {
        exerciseId: current.exerciseId,
        session: {
          userId: params.userId,
          status: "COMPLETED",
          performedAt: { lt: current.session.performedAt },
        },
        sets: { some: { isCompleted: true, weight: { not: null }, reps: { not: null } } },
      },
      orderBy: { session: { performedAt: "desc" } },
      take: EXERCISE_HISTORY_LIMIT,
      include: {
        session: { select: { performedAt: true } },
        sets: { where: { isCompleted: true }, orderBy: { setNumber: "asc" } },
      },
    }),
    prisma.workoutSessionExercise.findMany({
      where: {
        session: {
          userId: params.userId,
          status: "COMPLETED",
          performedAt: { gte: lookbackStart, lt: current.session.performedAt },
        },
        OR: [
          { exerciseId: current.exerciseId },
          { exercise: { movementGroupId: current.exercise.movementGroupId } },
          ...(allMuscleIds.length > 0
            ? [
                { exercise: { primaryMuscles: { some: { muscleId: { in: allMuscleIds } } } } },
                { exercise: { secondaryMuscles: { some: { muscleId: { in: allMuscleIds } } } } },
              ]
            : []),
        ],
      },
      include: {
        session: { select: { performedAt: true } },
        exercise: {
          include: {
            primaryMuscles: true,
            secondaryMuscles: true,
          },
        },
        sets: { where: { isCompleted: true }, include: { setType: true } },
      },
      orderBy: { session: { performedAt: "desc" } },
      take: 120,
    }),
    prisma.metricLog.findMany({
      where: {
        userId: params.userId,
        isDraft: false,
        loggedAt: { lte: current.session.performedAt },
      },
      orderBy: { loggedAt: "desc" },
      take: 3,
      select: {
        loggedAt: true,
        sleepDuration: true,
        sleepQuality: true,
        stress: true,
        readiness: true,
        manualFatigue: true,
        sorenessJointIrritation: true,
      },
    }),
  ]);

  const completedSets = current.sets.filter((set) => set.isCompleted);
  const usableHistory = exerciseHistory.filter((exposure) =>
    exposure.sets.some((set) => performanceIndex(set.weight, set.reps, set.rir) !== null),
  );
  const eligibility = evaluateLiveCoachEligibility({
    sessionStatus: current.session.status,
    plannedSetCount: current.sets.length,
    completedSetCount: completedSets.length,
    triggerSetCompleted: triggerSet.isCompleted,
    triggerSetHasUsablePerformance:
      performanceIndex(triggerSet.weight, triggerSet.reps, triggerSet.rir) !== null,
    triggerSetPain: triggerSet.painFlag || current.painFlag,
    triggerSetExecutionCompromised: details(triggerSet.intensifierDetails).executionCompromised,
    historicalPerformanceExposureCount: usableHistory.length,
    existingActionForTriggerSet: current.coachActions.length > 0,
  });

  const summarizeWindow = (hours: number) => {
    const cutoff = current.session.performedAt.getTime() - hours * 3_600_000;
    const rows = recentContext.filter((row) => row.session.performedAt.getTime() >= cutoff);
    const effectiveSets = (predicate: (row: (typeof rows)[number]) => boolean) =>
      rows.filter(predicate).reduce(
        (sum, row) => sum + row.sets.reduce((setSum, set) => setSum + Number(set.setType.multiplier), 0),
        0,
      );
    return {
      sameExerciseEffectiveSets: effectiveSets((row) => row.exerciseId === current.exerciseId),
      sameMovementEffectiveSets: effectiveSets(
        (row) => row.exercise.movementGroupId === current.exercise.movementGroupId,
      ),
      primaryMuscleEffectiveSets: effectiveSets((row) =>
        row.exercise.primaryMuscles.some((link) => primaryMuscleIds.includes(link.muscleId)),
      ),
      secondaryMuscleEffectiveSets: effectiveSets((row) =>
        row.exercise.primaryMuscles.some((link) => secondaryMuscleIds.includes(link.muscleId)) ||
        row.exercise.secondaryMuscles.some((link) => secondaryMuscleIds.includes(link.muscleId)),
      ),
      symptomExposureCount: rows.filter((row) => row.painFlag || row.sets.some((set) => set.painFlag)).length,
    };
  };

  const historicalDecay = usableHistory.flatMap((exposure) => {
    const indices = exposure.sets.map((set) => performanceIndex(set.weight, set.reps, set.rir));
    const first = indices.find((value) => value !== null) ?? null;
    if (first === null || first <= 0) return [];
    return indices.slice(1).flatMap((value) =>
      value === null ? [] : [((value / first) - 1) * 100],
    );
  });
  const lastSameExercise = recentContext.find((row) => row.exerciseId === current.exerciseId);
  const lastSameMovement = recentContext.find(
    (row) => row.exercise.movementGroupId === current.exercise.movementGroupId,
  );

  return {
    eligibility,
    workout: {
      sessionId: current.session.id,
      sessionExerciseId: current.id,
      performedAt: current.session.performedAt.toISOString(),
    },
    exercise: {
      id: current.exerciseId,
      name: current.exercise.name,
      movementPatternId: current.exercise.movementGroupId,
      movementPatternName: current.exercise.movementGroup.name,
      exerciseType: current.exercise.secondaryMuscles.length > 0 ? "COMPOUND" : "ISOLATION",
      primaryMuscles: current.exercise.primaryMuscles.map((link) => ({ id: link.muscleId, name: link.muscle.name })),
      secondaryMuscles: current.exercise.secondaryMuscles.map((link) => ({ id: link.muscleId, name: link.muscle.name })),
    },
    prescription: {
      plannedSets: current.sets.length,
      minReps: current.prescribedMinReps,
      maxReps: current.prescribedMaxReps,
      sets: current.sets.map((set) => ({
        id: set.id,
        setNumber: set.setNumber,
        isCompleted: set.isCompleted,
        prescription: set.prescription,
      })),
    },
    currentSets: completedSets.map((set) => ({
      id: set.id,
      setNumber: set.setNumber,
      weight: numberOrNull(set.weight),
      reps: set.reps,
      observedRir: numberOrNull(set.rir),
      performanceIndex: performanceIndex(set.weight, set.reps, set.rir),
      pain: set.painFlag,
      ...details(set.intensifierDetails),
    })),
    history: {
      performanceExposureCount: usableHistory.length,
      decayComparableExposureCount: usableHistory.filter((row) => row.sets.length >= 2).length,
      medianWithinExerciseDecayPct: median(historicalDecay),
      hoursSinceSameExercise: hoursBetween(lastSameExercise?.session.performedAt ?? null, current.session.performedAt),
      hoursSinceSameMovement: hoursBetween(lastSameMovement?.session.performedAt ?? null, current.session.performedAt),
    },
    recentTraining: { last48h: summarizeWindow(48), last72h: summarizeWindow(72) },
    recovery: recovery.map((entry) => ({
      ...entry,
      loggedAt: entry.loggedAt.toISOString(),
      sleepDuration: numberOrNull(entry.sleepDuration),
    })),
  };
}

