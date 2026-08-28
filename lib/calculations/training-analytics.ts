export type DerivedExerciseType = "COMPOUND" | "ISOLATION";
export type EvidenceConfidence = "INSUFFICIENT" | "LOW" | "MODERATE" | "HIGH";
export type Direction = "UP" | "STABLE" | "DOWN" | "UNKNOWN";

export type HistoricalSetInput = {
  setNumber?: number | null;
  weight?: unknown;
  reps?: number | null;
  rir?: unknown;
  isCompleted?: boolean | null;
  painFlag?: boolean | null;
  setTypeMultiplier?: unknown;
  isIntensifier?: boolean | null;
};

export type ExerciseExposureInput = {
  performedAt: Date | string;
  sets: HistoricalSetInput[];
};

export type ExposureSummary = {
  performedAt: string;
  completedSets: number;
  effectiveSets: number;
  meanObservedRir: number | null;
  failureSets: number;
  painSets: number;
  bestRirAdjustedE1rm: number | null;
  firstSetRirAdjustedE1rm: number | null;
  lastSetRirAdjustedE1rm: number | null;
  withinExercisePerformanceDropPct: number | null;
};

export type ExerciseHistorySummary = {
  exposureCount: number;
  setCount: number;
  failureSetRate: number | null;
  painSetRate: number | null;
  meanObservedRir: number | null;
  recentPerformance: number | null;
  previousPerformance: number | null;
  performanceChangePct: number | null;
  performanceDirection: Direction;
  meanWithinExerciseDropPct: number | null;
  confidence: EvidenceConfidence;
};

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function deriveExerciseType(secondaryMuscleCount: number): DerivedExerciseType {
  return secondaryMuscleCount > 0 ? "COMPOUND" : "ISOLATION";
}

/**
 * RIR-adjusted E1RM is an analytical comparison signal, not a literal strength max.
 * Reps in reserve are treated as additional potential reps for longitudinal comparison.
 */
export function estimateRirAdjustedE1rm(weight: unknown, reps: number | null | undefined, rir: unknown): number | null {
  const load = finiteNumber(weight);
  const observedRir = finiteNumber(rir);
  if (load === null || load <= 0 || reps === null || reps === undefined || reps <= 0) return null;
  const adjustedReps = reps + Math.max(0, observedRir ?? 0);
  return round(load * (1 + adjustedReps / 30), 2);
}

export function effectiveSetValue(set: HistoricalSetInput): number {
  if (!set.isCompleted) return 0;
  const multiplier = finiteNumber(set.setTypeMultiplier);
  return multiplier === null ? 1 : Math.max(0, multiplier);
}

export function confidenceFromExposureCount(exposures: number): EvidenceConfidence {
  if (exposures < 3) return "INSUFFICIENT";
  if (exposures < 6) return "LOW";
  if (exposures < 10) return "MODERATE";
  return "HIGH";
}

export function summarizeExerciseExposure(exposure: ExerciseExposureInput): ExposureSummary {
  const completed = [...exposure.sets]
    .filter((set) => Boolean(set.isCompleted))
    .sort((a, b) => Number(a.setNumber ?? 0) - Number(b.setNumber ?? 0));

  const rirValues = completed.map((set) => finiteNumber(set.rir)).filter((value): value is number => value !== null);
  const performanceValues = completed
    .map((set) => estimateRirAdjustedE1rm(set.weight, set.reps, set.rir))
    .filter((value): value is number => value !== null);
  const firstPerformance = completed.length > 0
    ? estimateRirAdjustedE1rm(completed[0]?.weight, completed[0]?.reps, completed[0]?.rir)
    : null;
  const lastPerformance = completed.length > 0
    ? estimateRirAdjustedE1rm(completed[completed.length - 1]?.weight, completed[completed.length - 1]?.reps, completed[completed.length - 1]?.rir)
    : null;
  const performanceDrop = firstPerformance !== null && lastPerformance !== null && firstPerformance > 0 && completed.length > 1
    ? Math.max(0, ((firstPerformance - lastPerformance) / firstPerformance) * 100)
    : null;

  return {
    performedAt: new Date(exposure.performedAt).toISOString(),
    completedSets: completed.length,
    effectiveSets: round(completed.reduce((sum, set) => sum + effectiveSetValue(set), 0), 2),
    meanObservedRir: rirValues.length > 0 ? round(mean(rirValues) ?? 0, 2) : null,
    failureSets: completed.filter((set) => {
      const rir = finiteNumber(set.rir);
      return rir !== null && rir <= 0;
    }).length,
    painSets: completed.filter((set) => Boolean(set.painFlag)).length,
    bestRirAdjustedE1rm: performanceValues.length > 0 ? round(Math.max(...performanceValues), 2) : null,
    firstSetRirAdjustedE1rm: firstPerformance,
    lastSetRirAdjustedE1rm: lastPerformance,
    withinExercisePerformanceDropPct: performanceDrop === null ? null : round(performanceDrop, 1),
  };
}

function performanceDirection(changePct: number | null): Direction {
  if (changePct === null) return "UNKNOWN";
  if (changePct > 2) return "UP";
  if (changePct < -2) return "DOWN";
  return "STABLE";
}

export function summarizeExerciseHistory(exposures: ExerciseExposureInput[]): ExerciseHistorySummary {
  const ordered = [...exposures].sort(
    (a, b) => new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime(),
  );
  const summaries = ordered.map(summarizeExerciseExposure).filter((summary) => summary.completedSets > 0);
  const setCount = summaries.reduce((sum, summary) => sum + summary.completedSets, 0);
  const failureSets = summaries.reduce((sum, summary) => sum + summary.failureSets, 0);
  const painSets = summaries.reduce((sum, summary) => sum + summary.painSets, 0);
  const rirValues = ordered.flatMap((exposure) =>
    exposure.sets
      .filter((set) => Boolean(set.isCompleted))
      .map((set) => finiteNumber(set.rir))
      .filter((value): value is number => value !== null),
  );
  const performance = summaries
    .map((summary) => summary.bestRirAdjustedE1rm)
    .filter((value): value is number => value !== null);
  const split = Math.max(1, Math.floor(performance.length / 2));
  const previousValues = performance.slice(0, split);
  const recentValues = performance.slice(split);
  const previousPerformance = mean(previousValues);
  const recentPerformance = mean(recentValues.length > 0 ? recentValues : previousValues);
  const changePct = previousPerformance !== null && recentPerformance !== null && previousPerformance > 0 && performance.length >= 4
    ? ((recentPerformance - previousPerformance) / previousPerformance) * 100
    : null;
  const dropValues = summaries
    .map((summary) => summary.withinExercisePerformanceDropPct)
    .filter((value): value is number => value !== null);

  return {
    exposureCount: summaries.length,
    setCount,
    failureSetRate: setCount > 0 ? round(failureSets / setCount, 3) : null,
    painSetRate: setCount > 0 ? round(painSets / setCount, 3) : null,
    meanObservedRir: rirValues.length > 0 ? round(mean(rirValues) ?? 0, 2) : null,
    recentPerformance: recentPerformance === null ? null : round(recentPerformance, 2),
    previousPerformance: previousPerformance === null ? null : round(previousPerformance, 2),
    performanceChangePct: changePct === null ? null : round(changePct, 1),
    performanceDirection: performanceDirection(changePct),
    meanWithinExerciseDropPct: dropValues.length > 0 ? round(mean(dropValues) ?? 0, 1) : null,
    confidence: confidenceFromExposureCount(summaries.length),
  };
}
