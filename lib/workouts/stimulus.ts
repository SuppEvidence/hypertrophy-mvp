export type StimulusSetTypeInput = {
  multiplier?: unknown;
  isIntensifier?: boolean | null;
} | null;

export type StimulusSetInput = {
  setNumber?: number | null;
  isCompleted?: boolean | null;
  repRangeStatus?: string | null;
  effortStatus?: string | null;
  painFlag?: boolean | null;
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

function completedRows(item: StimulusExerciseInput) {
  return sortedSets(item.sets).filter((set) => Boolean(set.isCompleted));
}

export function getStimulusContribution(item: StimulusExerciseInput): StimulusContribution {
  const rows = completedRows(item);

  if (rows.length > 0 || (item.sets?.length ?? 0) > 0) {
    let productiveEquivalent = 0;
    let productiveSets = 0;
    let intensifierSets = 0;
    let intensifierProductiveEquivalent = 0;

    for (const set of rows) {
      const multiplier = multiplierOf(set.setType ?? item.stimulusSetType);
      const intensifier = isIntensifier(set.setType ?? item.stimulusSetType);
      if (intensifier) intensifierSets += 1;
      if (isProductiveEffort(set.effortStatus ?? item.effortStatus ?? "PRODUCTIVE")) {
        productiveSets += 1;
        productiveEquivalent += multiplier;
        if (intensifier) intensifierProductiveEquivalent += multiplier;
      }
    }

    return {
      completed: rows.length,
      productiveEquivalent,
      productiveSets,
      intensifierSets,
      intensifierProductiveEquivalent,
    };
  }

  const productive = isProductiveEffort(item.effortStatus);

  if (usesStimulusEntry(item)) {
    const completed = completedStimulusSets(item);
    if (completed === 0) {
      return { completed: 0, productiveEquivalent: 0, productiveSets: 0, intensifierSets: 0, intensifierProductiveEquivalent: 0 };
    }

    const fallbackMultiplier = multiplierOf(item.stimulusSetType);
    const intensifierSets = isIntensifier(item.stimulusSetType) ? completed : 0;
    const intensifierMultiplierSum = isIntensifier(item.stimulusSetType) ? completed * fallbackMultiplier : 0;

    return {
      completed,
      productiveEquivalent: productive ? completed * fallbackMultiplier : 0,
      productiveSets: productive ? completed : 0,
      intensifierSets,
      intensifierProductiveEquivalent: productive ? intensifierMultiplierSum : 0,
    };
  }

  return { completed: 0, productiveEquivalent: 0, productiveSets: 0, intensifierSets: 0, intensifierProductiveEquivalent: 0 };
}
