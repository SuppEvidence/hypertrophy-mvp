export type StimulusSetTypeInput = {
  multiplier?: unknown;
  isIntensifier?: boolean | null;
} | null;

export type StimulusSetInput = {
  setNumber?: number | null;
  isCompleted?: boolean | null;
  setType?: StimulusSetTypeInput;
};

export type StimulusExerciseInput = {
  completedSets?: number | null;
  effortStatus?: string | null;
  stimulusSetType?: StimulusSetTypeInput;
  sets?: StimulusSetInput[] | null;
};

export type StimulusContribution = {
  completed: number;
  productiveEquivalent: number;
  productiveSets: number;
  intensifierSets: number;
  intensifierProductiveEquivalent: number;
};

function toNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function multiplierOf(setType: StimulusSetTypeInput | undefined) {
  return toNumber(setType?.multiplier, 1);
}

function isIntensifier(setType: StimulusSetTypeInput | undefined) {
  return Boolean(setType?.isIntensifier);
}

export function isProductiveEffort(status: string | null | undefined) {
  return status === "PRODUCTIVE" || status === "VERY_HARD" || status === "FAILURE";
}

export function usesStimulusEntry(item: StimulusExerciseInput) {
  return item.completedSets !== null && item.completedSets !== undefined;
}

export function completedStimulusSets(item: StimulusExerciseInput) {
  return Math.max(0, Math.floor(Number(item.completedSets ?? 0)));
}

function sortedSets(sets: StimulusSetInput[] | null | undefined) {
  return [...(sets ?? [])].sort((a, b) => Number(a.setNumber ?? 0) - Number(b.setNumber ?? 0));
}

export function getStimulusContribution(item: StimulusExerciseInput): StimulusContribution {
  const productive = isProductiveEffort(item.effortStatus);

  if (usesStimulusEntry(item)) {
    const completed = completedStimulusSets(item);
    if (completed === 0) {
      return { completed: 0, productiveEquivalent: 0, productiveSets: 0, intensifierSets: 0, intensifierProductiveEquivalent: 0 };
    }

    const firstRows = sortedSets(item.sets).slice(0, completed);
    const rowsWithFallback = [...firstRows];
    const fallbackNeeded = Math.max(completed - rowsWithFallback.length, 0);

    let multiplierSum = rowsWithFallback.reduce((sum, set) => sum + multiplierOf(set.setType ?? item.stimulusSetType), 0);
    let intensifierSets = rowsWithFallback.reduce((sum, set) => sum + (isIntensifier(set.setType ?? item.stimulusSetType) ? 1 : 0), 0);
    let intensifierMultiplierSum = rowsWithFallback.reduce(
      (sum, set) => sum + (isIntensifier(set.setType ?? item.stimulusSetType) ? multiplierOf(set.setType ?? item.stimulusSetType) : 0),
      0,
    );

    if (fallbackNeeded > 0) {
      const fallbackMultiplier = multiplierOf(item.stimulusSetType);
      multiplierSum += fallbackNeeded * fallbackMultiplier;
      if (isIntensifier(item.stimulusSetType)) {
        intensifierSets += fallbackNeeded;
        intensifierMultiplierSum += fallbackNeeded * fallbackMultiplier;
      }
    }

    return {
      completed,
      productiveEquivalent: productive ? multiplierSum : 0,
      productiveSets: productive ? completed : 0,
      intensifierSets,
      intensifierProductiveEquivalent: productive ? intensifierMultiplierSum : 0,
    };
  }

  const completedRows = sortedSets(item.sets).filter((set) => Boolean(set.isCompleted));
  const completed = completedRows.length;
  const multiplierSum = completedRows.reduce((sum, set) => sum + multiplierOf(set.setType), 0);
  const intensifierSets = completedRows.reduce((sum, set) => sum + (isIntensifier(set.setType) ? 1 : 0), 0);
  const intensifierMultiplierSum = completedRows.reduce((sum, set) => sum + (isIntensifier(set.setType) ? multiplierOf(set.setType) : 0), 0);

  return {
    completed,
    productiveEquivalent: multiplierSum,
    productiveSets: completed,
    intensifierSets,
    intensifierProductiveEquivalent: intensifierMultiplierSum,
  };
}
