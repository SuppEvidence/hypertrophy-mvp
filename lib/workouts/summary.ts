export function estimateE1RM(weight: number | null | undefined, reps: number | null | undefined) {
  if (weight === null || weight === undefined || reps === null || reps === undefined) return null;
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0) return null;
  return weight * (1 + reps / 30);
}

export type LoggedSetForSummary = {
  weight: unknown;
  reps: number | null;
  isCompleted: boolean;
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

function toNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isProductiveEffort(status: string | null | undefined) {
  return status === "PRODUCTIVE" || status === "VERY_HARD" || status === "FAILURE";
}

function shouldUseStimulusRow(item: LoggedExerciseForSummary) {
  return item.completedSets !== null && item.completedSets !== undefined && item.stimulusSetType;
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
    if (item.painFlag) painFlagCount += 1;
    if (item.isSubstitution) substitutionCount += 1;

    if (shouldUseStimulusRow(item)) {
      const completed = Math.max(0, item.completedSets ?? 0);
      const multiplier = toNumber(item.stimulusSetType?.multiplier, 1);
      const productiveEquivalent = isProductiveEffort(item.effortStatus) ? completed * multiplier : 0;
      completedSets += completed;
      if (productiveEquivalent > 0) productiveSets += completed;
      if (item.stimulusSetType?.isIntensifier) intensifierCount += completed;
      addVolume(item, completed, productiveEquivalent);
    } else {
      for (const set of item.sets) {
        if (!set.isCompleted) continue;
        completedSets += 1;
        productiveSets += 1;
        const multiplier = toNumber(set.setType.multiplier, 1);
        if (set.setType.isIntensifier) intensifierCount += 1;
        const weight = Number(set.weight ?? 0);
        const e1rm = estimateE1RM(weight, set.reps ?? null);
        if (e1rm !== null && (!bestSet || e1rm > bestSet.e1rm)) {
          bestSet = { exerciseName: item.exercise.name, e1rm, weight, reps: set.reps ?? 0 };
        }
        addVolume(item, 1, multiplier);
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
    volumeRows: Array.from(rows.values()).sort((a, b) => a.sortOrder - b.sortOrder),
  };
}
