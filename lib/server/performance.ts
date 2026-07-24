import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";
import { calculateVolumeLoad, estimateE1RM, getBestSet, getTrendStatus } from "@/lib/calculations/performance";

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

type ExposureSet = {
  id: string;
  setNumber: number;
  weight: number | null;
  reps: number | null;
  rir: number | null;
  setTypeName: string;
  isIntensifier: boolean;
  isCompleted: boolean;
  e1rm: number | null;
  volumeLoad: number | null;
};

export async function getExercisePerformanceData(params?: { exerciseId?: string }) {
  const userId = await requireUserId();

  const loggedExercises = await prisma.exercise.findMany({
    where: {
      sessionExercises: {
        some: {
          session: { userId, status: "COMPLETED" },
          sets: { some: { isCompleted: true } },
        },
      },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      movementGroup: { select: { name: true } },
    },
  });

  const exerciseOptions = loggedExercises.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    movementGroupName: exercise.movementGroup.name,
  }));
  const exerciseIds = new Set(exerciseOptions.map((exercise) => exercise.id));
  const selectedExerciseId = params?.exerciseId && exerciseIds.has(params.exerciseId) ? params.exerciseId : exerciseOptions[0]?.id ?? null;

  const [selectedExercise, rawExposures, activeProgram] = await Promise.all([
    selectedExerciseId
      ? prisma.exercise.findFirst({
          where: { id: selectedExerciseId, OR: [{ isSeed: true, userId: null }, { userId }] },
          include: {
            movementGroup: true,
            primaryMuscles: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
            secondaryMuscles: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
          },
        })
      : Promise.resolve(null),
    selectedExerciseId
      ? prisma.workoutSessionExercise.findMany({
          where: { exerciseId: selectedExerciseId, session: { userId, status: "COMPLETED" } },
          orderBy: { session: { performedAt: "desc" } },
          take: 20,
          select: {
            id: true,
            painFlag: true,
            painNote: true,
            isSubstitution: true,
            session: {
              select: {
                performedAt: true,
                name: true,
                program: { select: { name: true } },
                template: { select: { name: true } },
              },
            },
            sets: {
              orderBy: { setNumber: "asc" },
              select: {
                id: true,
                setNumber: true,
                weight: true,
                reps: true,
                rir: true,
                isCompleted: true,
                setType: { select: { name: true, isIntensifier: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    prisma.program.findFirst({
      where: { userId, isActive: true, isArchived: false },
      select: { name: true },
    }),
  ]);

  const exposures = rawExposures.map((item: any) => {
    const sets: ExposureSet[] = item.sets.map((set: any) => {
      const weight = toNumber(set.weight);
      const rir = toNumber(set.rir);
      const e1rm = estimateE1RM(weight, set.reps);
      return {
        id: set.id,
        setNumber: set.setNumber,
        weight,
        reps: set.reps,
        rir,
        setTypeName: set.setType.name,
        isIntensifier: set.setType.isIntensifier,
        isCompleted: set.isCompleted,
        e1rm: round(e1rm),
        volumeLoad: set.isCompleted && weight !== null && set.reps !== null ? round(weight * set.reps, 0) : null,
      };
    });
    const completedSets = sets.filter((set: any) => set.isCompleted);
    const bestSet = getBestSet(completedSets);
    const volumeLoad = calculateVolumeLoad(completedSets);

    return {
      id: item.id,
      performedAt: item.session.performedAt.toISOString(),
      programName: item.session.program.name,
      templateName: item.session.template?.name ?? item.session.name,
      painFlag: item.painFlag,
      painNote: item.painNote,
      isSubstitution: item.isSubstitution,
      completedSetCount: completedSets.length,
      volumeLoad: round(volumeLoad, 0),
      bestSet: bestSet
        ? {
            weight: bestSet.weight,
            reps: bestSet.reps,
            e1rm: round(bestSet.e1rm),
          }
        : null,
      sets,
    };
  });

  const chronological = [...exposures].reverse();
  const e1rmTrend = chronological.map((item: any) => ({ label: item.performedAt, value: item.bestSet?.e1rm ?? null }));
  const volumeLoadTrend = chronological.map((item: any) => ({ label: item.performedAt, value: item.volumeLoad }));
  const trend = getTrendStatus(e1rmTrend);

  const lifetimeBest = exposures.reduce<null | { e1rm: number; weight: number | null; reps: number | null; performedAt: string; programName: string }>((best, exposure: any) => {
    if (!exposure.bestSet?.e1rm) return best;
    if (!best || exposure.bestSet.e1rm > best.e1rm) {
      return {
        e1rm: exposure.bestSet.e1rm,
        weight: exposure.bestSet.weight,
        reps: exposure.bestSet.reps,
        performedAt: exposure.performedAt,
        programName: exposure.programName,
      };
    }
    return best;
  }, null);

  const programBest = activeProgram
    ? exposures
        .filter((exposure: any) => exposure.programName === activeProgram.name && exposure.bestSet?.e1rm)
        .reduce<null | { e1rm: number; weight: number | null; reps: number | null; performedAt: string; programName: string }>((best, exposure: any) => {
          if (!exposure.bestSet?.e1rm) return best;
          if (!best || exposure.bestSet.e1rm > best.e1rm) {
            return {
              e1rm: exposure.bestSet.e1rm,
              weight: exposure.bestSet.weight,
              reps: exposure.bestSet.reps,
              performedAt: exposure.performedAt,
              programName: exposure.programName,
            };
          }
          return best;
        }, null)
    : null;

  const comparable = selectedExercise
    ? await buildComparableExerciseContext(userId, selectedExercise.id, selectedExercise.movementGroupId)
    : [];

  return {
    exerciseOptions,
    selectedExercise: selectedExercise
      ? {
          id: selectedExercise.id,
          name: selectedExercise.name,
          movementGroupName: selectedExercise.movementGroup.name,
          primaryMuscles: selectedExercise.primaryMuscles.map((link: any) => link.muscle.name),
          secondaryMuscles: selectedExercise.secondaryMuscles.map((link: any) => link.muscle.name),
        }
      : null,
    activeProgramName: activeProgram?.name ?? null,
    exposures,
    e1rmTrend,
    volumeLoadTrend,
    trend: { status: trend.status, changePct: round(trend.changePct, 1) },
    lifetimeBest,
    programBest,
    comparable,
  };
}

async function buildComparableExerciseContext(userId: string, exerciseId: string, movementGroupId: string) {
  const items = await prisma.workoutSessionExercise.findMany({
    where: {
      exerciseId: { not: exerciseId },
      exercise: { movementGroupId },
      session: { userId, status: "COMPLETED" },
      sets: { some: { isCompleted: true } },
    },
    orderBy: { session: { performedAt: "desc" } },
    take: 30,
    select: {
      exerciseId: true,
      exercise: { select: { name: true } },
      session: { select: { performedAt: true } },
      sets: {
        select: { weight: true, reps: true, isCompleted: true },
      },
    },
  });

  const byExercise = new Map<string, { exerciseName: string; latestExposureAt: string; bestE1rm: number | null; exposures: number }>();

  for (const item of items) {
    const sets = item.sets.map((set: any) => ({ weight: toNumber(set.weight), reps: set.reps, isCompleted: set.isCompleted }));
    const bestSet = getBestSet(sets);
    const existing = byExercise.get(item.exerciseId);
    const currentBest = bestSet ? round(bestSet.e1rm) : null;
    if (!existing) {
      byExercise.set(item.exerciseId, {
        exerciseName: item.exercise.name,
        latestExposureAt: item.session.performedAt.toISOString(),
        bestE1rm: currentBest,
        exposures: 1,
      });
    } else {
      existing.exposures += 1;
      if (currentBest !== null && (existing.bestE1rm === null || currentBest > existing.bestE1rm)) existing.bestE1rm = currentBest;
    }
  }

  return Array.from(byExercise.values()).sort((a, b) => a.exerciseName.localeCompare(b.exerciseName)).slice(0, 5);
}
