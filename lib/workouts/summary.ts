import { getStimulusContribution } from "@/lib/workouts/stimulus";

export function estimateE1RM(weight: number | null | undefined, reps: number | null | undefined) {
  if (weight === null || weight === undefined || reps === null || reps === undefined) return null;
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0) return null;
  return weight * (1 + reps / 30);
}

export type LoggedSetForSummary = {
  setNumber?: number | null;
  weight: unknown;
  reps: number | null;
  isCompleted: boolean;
  repRangeStatus?: string | null;
  effortStatus?: string | null;
  painFlag?: boolean | null;
  setType: { multiplier: unknown; isIntensifier: boolean };
};

export type LoggedExerciseForSummary = {
  exercise: {
    name: string;
    primaryMuscles: Array<{ muscleId: string; muscle: { name: string; sortOrder: number } }>;
    secondaryMuscles: Array<{ muscleId: string; muscle: { name: string; sortOrder: number } }>;
  };
  sets: LoggedSetForSummary[];
  painFlag: boolean;
  isSubstitution: boolean;
  completedSets?: number | null;
  stimulusSetType?: { multiplier: unknown; isIntensifier: boolean } | null;
  repRangeStatus?: string | null;
  effortStatus?: string | null;
};

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function toNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildWorkoutSummary(args: {
  secondaryContribution: number;
  sessionExercises: LoggedExerciseForSummary[];
}) {
  const rows = new Map<string, { muscleId: string; muscleName: string; sortOrder: number; direct: number; effective: number }>();
  let completedSets = 0;
  let productiveSets = 0;
  let intensifierCount = 0;
  let painFlagCount = 0;
  let substitutionCount = 0;
  let bestSet: { exerciseName: string; e1rm: number; weight: number; reps: number } | null = null;

  function addVolume(item: LoggedExerciseForSummary, completed: number, productiveEquivalent: number) {
    for (const link of item.exercise.primaryMuscles) {
      const row = rows.get(link.muscleId) ?? {
        muscleId: link.muscleId,
        muscleName: link.muscle.name,
        sortOrder: link.muscle.sortOrder,
        direct: 0,
        effective: 0,
      };
      row.direct += completed;
      row.effective += productiveEquivalent;
      rows.set(link.muscleId, row);
    }

    for (const link of item.exercise.secondaryMuscles) {
      const row = rows.get(link.muscleId) ?? {
        muscleId: link.muscleId,
        muscleName: link.muscle.name,
        sortOrder: link.muscle.sortOrder,
        direct: 0,
        effective: 0,
      };
      row.effective += productiveEquivalent * args.secondaryContribution;
      rows.set(link.muscleId, row);
    }
  }

  for (const item of args.sessionExercises) {
    const setPainFlag = item.sets.some((set) => set.isCompleted && Boolean(set.painFlag));
    if (item.painFlag || setPainFlag) painFlagCount += 1;
    if (item.isSubstitution) substitutionCount += 1;

    const contribution = getStimulusContribution(item);
    completedSets += contribution.completed;
    productiveSets += contribution.productiveSets;
    intensifierCount += contribution.intensifierSets;
    addVolume(item, contribution.completed, contribution.productiveEquivalent);

    for (const set of item.sets) {
      if (!set.isCompleted) continue;
      const weight = toNumber(set.weight, 0);
      const e1rm = estimateE1RM(weight, set.reps ?? null);
      if (e1rm !== null && (!bestSet || e1rm > bestSet.e1rm)) {
        bestSet = { exerciseName: item.exercise.name, e1rm, weight, reps: set.reps ?? 0 };
      }
    }
  }

  return {
    completedSets,
    productiveSets,
    intensifierCount,
    painFlagCount,
    substitutionCount,
    bestSet,
    volumeRows: Array.from(rows.values())
      .map((row) => ({ ...row, direct: round(row.direct), effective: round(row.effective) }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
  };
}
