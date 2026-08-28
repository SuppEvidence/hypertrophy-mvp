import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";
import {
  deriveExerciseType,
  summarizeExerciseExposure,
  summarizeExerciseHistory,
  type ExerciseExposureInput,
} from "@/lib/calculations/training-analytics";

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export async function buildTrainingAdvisorContext() {
  const userId = await requireUserId();
  const program = await prisma.program.findFirst({
    where: { userId, isActive: true, isArchived: false },
    include: {
      priorityMuscles: { include: { muscle: true } },
      volumeTargets: { include: { muscle: true } },
      mesocycles: {
        where: { isArchived: false },
        orderBy: { startDate: "desc" },
        take: 1,
        include: {
          volumeTargets: { include: { muscle: true } },
          movementVolumeTargets: { include: { movementGroup: true } },
        },
      },
    },
  });

  if (!program) return null;

  const mesocycle = program.mesocycles[0] ?? null;
  const historyStart = mesocycle?.startDate ?? daysAgo(84);
  const [sessions, metrics] = await Promise.all([
    prisma.workoutSession.findMany({
      where: {
        userId,
        programId: program.id,
        status: "COMPLETED",
        performedAt: { gte: historyStart },
      },
      orderBy: { performedAt: "asc" },
      select: {
        id: true,
        performedAt: true,
        template: { select: { id: true, name: true } },
        exercises: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            exerciseId: true,
            exercise: {
              select: {
                name: true,
                movementGroup: { select: { id: true, name: true } },
                primaryMuscles: { include: { muscle: true } },
                secondaryMuscles: { include: { muscle: true } },
              },
            },
            sets: {
              where: { isCompleted: true },
              orderBy: { setNumber: "asc" },
              select: {
                setNumber: true,
                weight: true,
                reps: true,
                rir: true,
                isCompleted: true,
                painFlag: true,
                setType: { select: { multiplier: true, isIntensifier: true } },
              },
            },
          },
        },
      },
    }),
    prisma.metricLog.findMany({
      where: { userId, isDraft: false, loggedAt: { gte: historyStart } },
      orderBy: { loggedAt: "asc" },
      select: {
        loggedAt: true,
        sleepDuration: true,
        sleepQuality: true,
        stress: true,
        readiness: true,
        manualFatigue: true,
        sorenessJointIrritation: true,
        bodyweight: true,
        waist: true,
      },
    }),
  ]);

  const exerciseMap = new Map<string, {
    exerciseId: string;
    exerciseName: string;
    movementGroup: { id: string; name: string };
    primaryMuscles: Array<{ id: string; name: string }>;
    secondaryMuscles: Array<{ id: string; name: string }>;
    exposures: ExerciseExposureInput[];
  }>();

  const muscleEffectiveSets = new Map<string, number>();
  const movementEffectiveSets = new Map<string, number>();
  const secondaryContribution = numberOrNull(program.secondaryContribution) ?? 0.5;
  const sevenDayStart = daysAgo(7);

  for (const session of sessions) {
    for (const item of session.exercises) {
      const exposure: ExerciseExposureInput = {
        performedAt: session.performedAt,
        sets: item.sets.map((set) => ({
          setNumber: set.setNumber,
          weight: set.weight,
          reps: set.reps,
          rir: set.rir,
          isCompleted: set.isCompleted,
          painFlag: set.painFlag,
          setTypeMultiplier: set.setType.multiplier,
          isIntensifier: set.setType.isIntensifier,
        })),
      };

      const existing = exerciseMap.get(item.exerciseId);
      if (existing) {
        existing.exposures.push(exposure);
      } else {
        exerciseMap.set(item.exerciseId, {
          exerciseId: item.exerciseId,
          exerciseName: item.exercise.name,
          movementGroup: item.exercise.movementGroup,
          primaryMuscles: item.exercise.primaryMuscles.map((link) => ({ id: link.muscle.id, name: link.muscle.name })),
          secondaryMuscles: item.exercise.secondaryMuscles.map((link) => ({ id: link.muscle.id, name: link.muscle.name })),
          exposures: [exposure],
        });
      }

      const exposureSummary = summarizeExerciseExposure(exposure);
      const effectiveSets = exposureSummary.effectiveSets;
      if (session.performedAt >= sevenDayStart) {
        movementEffectiveSets.set(
          item.exercise.movementGroup.id,
          (movementEffectiveSets.get(item.exercise.movementGroup.id) ?? 0) + effectiveSets,
        );
        for (const link of item.exercise.primaryMuscles) {
          muscleEffectiveSets.set(link.muscle.id, (muscleEffectiveSets.get(link.muscle.id) ?? 0) + effectiveSets);
        }
        for (const link of item.exercise.secondaryMuscles) {
          muscleEffectiveSets.set(
            link.muscle.id,
            (muscleEffectiveSets.get(link.muscle.id) ?? 0) + effectiveSets * secondaryContribution,
          );
        }
      }
    }
  }

  const mesocycleTargets = mesocycle?.volumeTargets ?? [];
  const fallbackTargets = program.volumeTargets;
  const targetRows = (mesocycleTargets.length > 0 ? mesocycleTargets : fallbackTargets).map((target) => {
    const isMesocycleTarget = "targetSets" in target;
    const targetSets = isMesocycleTarget ? numberOrNull(target.targetSets) : numberOrNull(target.weeklyTargetSets);
    return {
      muscleId: target.muscleId,
      muscleName: target.muscle.name,
      targetSets,
      minimumSets: numberOrNull(target.minimumSets),
      maximumSets: numberOrNull(target.maximumSets),
      priorityLevel: isMesocycleTarget ? target.priorityLevel : program.priorityMuscles.some((link) => link.muscleId === target.muscleId) ? 1 : 0,
      effectiveSetsLast7Days: round(muscleEffectiveSets.get(target.muscleId) ?? 0, 2),
    };
  });

  const exercises = Array.from(exerciseMap.values()).map((exercise) => ({
    exerciseId: exercise.exerciseId,
    exerciseName: exercise.exerciseName,
    exerciseType: deriveExerciseType(exercise.secondaryMuscles.length),
    movementGroup: exercise.movementGroup,
    primaryMuscles: exercise.primaryMuscles,
    secondaryMuscles: exercise.secondaryMuscles,
    history: summarizeExerciseHistory(exercise.exposures),
    recentExposures: exercise.exposures.slice(-8).map((exposure) => ({
      performedAt: new Date(exposure.performedAt).toISOString(),
      summary: summarizeExerciseExposure(exposure),
      sets: exposure.sets.map((set) => ({
        setNumber: set.setNumber ?? null,
        weight: numberOrNull(set.weight),
        reps: set.reps ?? null,
        observedRir: numberOrNull(set.rir),
        setTypeMultiplier: numberOrNull(set.setTypeMultiplier) ?? 1,
        isIntensifier: Boolean(set.isIntensifier),
        painFlag: Boolean(set.painFlag),
      })),
    })),
  }));

  return {
    generatedAt: new Date().toISOString(),
    program: {
      id: program.id,
      name: program.name,
      phase: program.activePhase,
      secondaryContribution,
    },
    mesocycle: mesocycle
      ? {
          id: mesocycle.id,
          name: mesocycle.name,
          phase: mesocycle.phase,
          startDate: mesocycle.startDate.toISOString(),
          lengthWeeks: mesocycle.lengthWeeks,
        }
      : null,
    volumeTargets: targetRows,
    movementTargets: (mesocycle?.movementVolumeTargets ?? []).map((target) => ({
      movementGroupId: target.movementGroupId,
      movementGroupName: target.movementGroup.name,
      targetSets: numberOrNull(target.targetSets),
      effectiveSetsLast7Days: round(movementEffectiveSets.get(target.movementGroupId) ?? 0, 2),
    })),
    recoveryHistory: metrics.map((metric) => ({
      loggedAt: metric.loggedAt.toISOString(),
      sleepDuration: numberOrNull(metric.sleepDuration),
      sleepQuality: metric.sleepQuality,
      stress: metric.stress,
      readiness: metric.readiness,
      manualFatigue: metric.manualFatigue,
      sorenessJointIrritation: metric.sorenessJointIrritation,
      bodyweight: numberOrNull(metric.bodyweight),
      waist: numberOrNull(metric.waist),
    })),
    exercises,
  };
}
