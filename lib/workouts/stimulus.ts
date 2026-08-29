export type StimulusSetTypeInput = {
  multiplier?: unknown;
  isIntensifier?: boolean | null;
} | null;

export type StimulusSetInput = {
  setNumber?: number | null;
  isCompleted?: boolean | null;
  /** Historical compatibility only; current volume accounting ignores it. */
  repRangeStatus?: string | null;
  /** Historical compatibility only; current volume accounting ignores it. */
  effortStatus?: string | null;
  painFlag?: boolean | null;
  setType?: StimulusSetTypeInput;
};

export type StimulusExerciseInput = {
  completedSets?: number | null;
  /** Historical compatibility only; current volume accounting ignores it. */
  effortStatus?: string | null;
  stimulusSetType?: StimulusSetTypeInput;
  sets?: StimulusSetInput[] | null;
};

/**
 * Property names are retained for API compatibility with existing UI/calculation
 * code. `productiveEquivalent` now means completed effective volume after the
 * configured set-type multiplier; stimulus quality is interpreted by AI from
 * objective logging rather than the retired manual effort labels.
 */
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
  return Math.max(0, toNumber(setType?.multiplier, 1));
}

function isIntensifier(setType: StimulusSetTypeInput | undefined) {
  return Boolean(setType?.isIntensifier);
}

/** @deprecated Manual effort labels are no longer used for current volume. */
export function isProductiveEffort(_status: string | null | undefined) {
  return true;
}

export function usesStimulusEntry(item: StimulusExerciseInput) {
  return item.completedSets !== null && item.completedSets !== undefined;
}

export function completedStimulusSets(item: StimulusExerciseInput) {
  return Math.max(0, Math.floor(Number(item.completedSets ?? 0)));
}

function sortedSets(sets: StimulusSetInput[] | null | undefined) {
  return [...(sets ?? [])].sort(
    (a, b) => Number(a.setNumber ?? 0) - Number(b.setNumber ?? 0),
  );
}

function completedRows(item: StimulusExerciseInput) {
  return sortedSets(item.sets).filter((set) => Boolean(set.isCompleted));
}

export function getStimulusContribution(
  item: StimulusExerciseInput,
): StimulusContribution {
  const rows = completedRows(item);

  if (rows.length > 0 || (item.sets?.length ?? 0) > 0) {
    let effectiveEquivalent = 0;
    let intensifierSets = 0;
    let intensifierEffectiveEquivalent = 0;

    for (const set of rows) {
      const setType = set.setType ?? item.stimulusSetType;
      const multiplier = multiplierOf(setType);
      const intensifier = isIntensifier(setType);

      effectiveEquivalent += multiplier;
      if (intensifier) {
        intensifierSets += 1;
        intensifierEffectiveEquivalent += multiplier;
      }
    }

    return {
      completed: rows.length,
      productiveEquivalent: effectiveEquivalent,
      productiveSets: rows.length,
      intensifierSets,
      intensifierProductiveEquivalent: intensifierEffectiveEquivalent,
    };
  }

  if (usesStimulusEntry(item)) {
    const completed = completedStimulusSets(item);
    if (completed === 0) {
      return {
        completed: 0,
        productiveEquivalent: 0,
        productiveSets: 0,
        intensifierSets: 0,
        intensifierProductiveEquivalent: 0,
      };
    }

    const multiplier = multiplierOf(item.stimulusSetType);
    const intensifier = isIntensifier(item.stimulusSetType);

    return {
      completed,
      productiveEquivalent: completed * multiplier,
      productiveSets: completed,
      intensifierSets: intensifier ? completed : 0,
      intensifierProductiveEquivalent: intensifier
        ? completed * multiplier
        : 0,
    };
  }

  return {
    completed: 0,
    productiveEquivalent: 0,
    productiveSets: 0,
    intensifierSets: 0,
    intensifierProductiveEquivalent: 0,
  };
}
