/** Identity-aware fallback. Never infer joint actions from muscle-accounting links. */
export function resolveExerciseRepTargets(input: {
  exerciseId: string;
  source?: { exerciseId: string; minReps?: number | null; maxReps?: number | null; rirTarget?: unknown } | null;
  defaultMinReps?: number | null;
  defaultMaxReps?: number | null;
}) {
  const validPair = (min: unknown, max: unknown): min is number =>
    typeof min === "number" && typeof max === "number" && Number.isInteger(min) && Number.isInteger(max) && min >= 1 && max <= 50 && min <= max;
  const source = input.source?.exerciseId === input.exerciseId ? input.source : null;
  const rir = source?.rirTarget == null ? null : Number(source.rirTarget);
  const targetRir = source ? (rir !== null && Number.isFinite(rir) && rir >= 0 && rir <= 5 ? rir : null) : 2;
  if (source && validPair(source.minReps, source.maxReps)) return {
    minReps: source.minReps, maxReps: source.maxReps!, targetRir, origin: "SAME_EXERCISE" as const,
  };
  if (validPair(input.defaultMinReps, input.defaultMaxReps)) return {
    minReps: input.defaultMinReps, maxReps: input.defaultMaxReps!, targetRir, origin: "EXERCISE_DEFAULT" as const,
  };
  // Neutral provisional range: a planning fallback, not an AI assessment or claimed optimum.
  return { minReps: 8, maxReps: 15, targetRir, origin: "PROVISIONAL" as const };
}
