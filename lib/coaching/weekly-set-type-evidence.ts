import type { ToleranceExposure } from "./exposure-tolerance";

type TimedExposure = { exerciseId: string; sets: {
  startedAt: Date | null; endedAt: Date | null; intensifierDetails: unknown;
  setType: { slug: string };
}[] };
const details = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return Math.round(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
};

/** Bounded descriptive evidence, not a ranking, eligibility gate or recovery diagnosis. */
export function summarizeWeeklySetTypeEvidence(history: ToleranceExposure[], timed: TimedExposure[] = []) {
  const byExercise = new Map<string, ToleranceExposure[]>();
  for (const row of [...history].sort((a, b) => +b.session.performedAt - +a.session.performedAt)) {
    const rows = byExercise.get(row.exerciseId) ?? [];
    if (rows.length < 6) rows.push(row);
    byExercise.set(row.exerciseId, rows);
  }
  return [...byExercise.entries()].slice(0, 24).map(([exerciseId, rows]) => {
    const slugs = [...new Set(rows.flatMap((row) => row.sets.map((set) => set.setType.slug)))].slice(0, 3);
    return { exerciseId, formats: slugs.map((slug) => {
      const exposures = rows.filter((row) => row.sets.some((set) => set.setType.slug === slug));
      const sets = exposures.flatMap((row) => row.sets.filter((set) => set.setType.slug === slug));
      const durations = timed.filter((row) => row.exerciseId === exerciseId).flatMap((row) => row.sets.filter((set) =>
        set.setType.slug === slug && details(set.intensifierDetails).filmed !== true && set.startedAt && set.endedAt)
        .map((set) => (+set.endedAt! - +set.startedAt!) / 1000)).filter((seconds) => Number.isFinite(seconds) && seconds > 0 && seconds <= 1800);
      const clusterCounts = sets.map((set) => Number(details(set.intensifierDetails).clusterCount)).filter((n) => Number.isInteger(n) && n > 0);
      const last = exposures[0];
      const latest = last.sets.filter((set) => set.setType.slug === slug).at(0)!;
      return { slug, exposures: exposures.length, completedPhysicalSets: sets.length,
        meanEffectiveMultiplier: Math.round(sets.reduce((sum, set) => sum + Number(set.setType.multiplier), 0) / sets.length * 100) / 100,
        painExposures: exposures.filter((row) => row.painFlag || row.sets.some((set) => set.setType.slug === slug && set.painFlag)).length,
        compromisedSets: sets.filter((set) => details(set.intensifierDetails).executionCompromised === true).length,
        clusterCounts: [...new Set(clusterCounts)].slice(0, 3),
        activeSecondsMedian: median(durations), timingSamples: durations.length,
        latest: { date: last.session.performedAt.toISOString().slice(0, 10), weight: latest.weight == null ? null : Number(latest.weight),
          reps: latest.reps, rir: latest.rir == null ? null : Number(latest.rir) } };
    }) };
  });
}
