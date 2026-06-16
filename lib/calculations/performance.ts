export type CompletedSetInput = {
  weight: number | null;
  reps: number | null;
  isCompleted: boolean;
};

export function estimateE1RM(weight: number | null | undefined, reps: number | null | undefined) {
  if (weight === null || weight === undefined || reps === null || reps === undefined) return null;
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0) return null;
  return weight * (1 + reps / 30);
}

export function calculateVolumeLoad(sets: CompletedSetInput[]) {
  return sets.reduce((total, set) => {
    if (!set.isCompleted || set.weight === null || set.reps === null) return total;
    return total + set.weight * set.reps;
  }, 0);
}

export function getBestSet<T extends CompletedSetInput>(sets: T[]) {
  let best: (T & { e1rm: number }) | null = null;

  for (const set of sets) {
    if (!set.isCompleted) continue;
    const e1rm = estimateE1RM(set.weight, set.reps);
    if (e1rm === null) continue;
    if (!best || e1rm > best.e1rm) best = { ...set, e1rm };
  }

  return best;
}

export function getTrendStatus(points: Array<{ value: number | null }>) {
  const valid = points.map((point) => point.value).filter((value): value is number => value !== null && Number.isFinite(value));
  if (valid.length < 4) return { status: "Insufficient data", changePct: null as number | null };

  const midpoint = Math.floor(valid.length / 2);
  const previous = valid.slice(0, midpoint);
  const recent = valid.slice(midpoint);
  const previousAverage = previous.reduce((sum, value) => sum + value, 0) / previous.length;
  const recentAverage = recent.reduce((sum, value) => sum + value, 0) / recent.length;

  if (previousAverage <= 0) return { status: "Insufficient data", changePct: null as number | null };
  const changePct = ((recentAverage - previousAverage) / previousAverage) * 100;

  if (changePct > 2) return { status: "Improving", changePct };
  if (changePct < -2) return { status: "Declining", changePct };
  return { status: "Stable", changePct };
}
