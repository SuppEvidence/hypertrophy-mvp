import { estimateRirAdjustedE1rm } from "../calculations/training-analytics";
import { isEdtSetType } from "./set-type-classification";

export type ToleranceExposure = {
  exerciseId: string; painFlag: boolean;
  exercise: { name: string; movementGroupId: string;
    primaryMuscles: { muscleId: string }[]; secondaryMuscles: { muscleId: string; contributionEstimate?: unknown }[] };
  session: { performedAt: Date };
  sets: { weight: unknown; reps: number | null; rir: unknown; painFlag: boolean; intensifierDetails: unknown;
    setType: { name: string; slug: string; isIntensifier: boolean; multiplier: unknown } }[];
};
const number = (v: unknown) => v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);
const details = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
function anchor(row: ToleranceExposure) {
  // Cluster totals must never be compared as straight-set reps. Non-clustered
  // clean sets are comparison anchors; intensified doses still remain in history.
  if (row.painFlag) return null;
  const set = row.sets.find((s) => !s.setType.isIntensifier && !isEdtSetType(s.setType) &&
    !details(s.intensifierDetails).executionCompromised && !s.painFlag && number(s.rir) !== null &&
    number(s.weight) !== null && s.reps !== null && s.reps > 0 && s.reps <= 30);
  return set ? estimateRirAdjustedE1rm(set.weight, set.reps, set.rir) : null;
}

function compare(previous: ToleranceExposure, next: ToleranceExposure) {
  const before = anchor(previous), after = anchor(next);
  if (before && after) return { change: Math.round((after / before - 1) * 1000) / 10, basis: "STRAIGHT_SET_RIR_ADJUSTED" };
  // All-intensifier exercises need their own protocol comparison, never E1RM
  // from cluster totals. Require matched load, RIR and recorded cluster/drop format.
  const a = previous.sets[0], b = next.sets[0];
  if (!a || !b || a.setType.slug !== b.setType.slug ||
      !(a.setType.isIntensifier || isEdtSetType(a.setType)) ||
      previous.painFlag || next.painFlag || a.painFlag || b.painFlag ||
      details(a.intensifierDetails).executionCompromised || details(b.intensifierDetails).executionCompromised ||
      number(a.weight) === null || number(a.weight)! <= 0 || number(a.weight) !== number(b.weight) ||
      number(a.rir) === null || number(b.rir) === null || Math.abs(number(a.rir)! - number(b.rir)!) > 1 ||
      !a.reps || !b.reps) return { change: null, basis: "UNKNOWN" };
  const da = details(a.intensifierDetails), db = details(b.intensifierDetails);
  const clusterMatch = number(da.clusterCount) !== null && number(da.clusterCount) === number(db.clusterCount);
  const dropMatch = Array.isArray(da.dropSets) && da.dropSets.length > 0 && Array.isArray(db.dropSets) &&
    da.dropSets.length === db.dropSets.length && da.dropSets.every((drop, i) =>
      number(details(drop).weight) !== null && number(details(drop).weight) === number(details((db.dropSets as unknown[])[i]).weight));
  if (!clusterMatch && !dropMatch) return { change: null, basis: "UNKNOWN" };
  return { change: Math.round((b.reps / a.reps - 1) * 1000) / 10, basis: "MATCHED_INTENSIFIER_PROTOCOL_REPS" };
}

export function summarizeExposureTolerance(history: ToleranceExposure[], timeline: { phase: string; startDate: string; endDateExclusive: string | null }[] = []) {
  const phaseAt = (date: Date) => timeline.find((row) => row.startDate <= date.toISOString().slice(0, 10) &&
    (!row.endDateExclusive || row.endDateExclusive > date.toISOString().slice(0, 10))) ?? null;
  const exercises = new Map<string, ToleranceExposure[]>();
  const weeks = new Map<string, Record<string, number>>();
  for (const row of history) {
    const list = exercises.get(row.exerciseId) ?? []; list.push(row); exercises.set(row.exerciseId, list);
    const monday = new Date(row.session.performedAt.toISOString().slice(0, 10));
    monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
    const key = monday.toISOString().slice(0, 10), dose = weeks.get(key) ?? {};
    const effective = row.sets.reduce((sum, s) => sum + Math.max(0, number(s.setType.multiplier) ?? 0), 0);
    for (const { muscleId } of row.exercise.primaryMuscles) dose[muscleId] = (dose[muscleId] ?? 0) + effective;
    for (const link of row.exercise.secondaryMuscles) dose[link.muscleId] = (dose[link.muscleId] ?? 0) + effective * Math.max(0, number(link.contributionEstimate) ?? 0);
    weeks.set(key, dose);
  }
  const responses = [...exercises.values()].flatMap((rows) => {
    const sorted = [...rows].sort((a, b) => +a.session.performedAt - +b.session.performedAt);
    const latest = sorted.at(-1)!;
    const pairs = sorted.slice(1).flatMap((next, i) => {
      const previous = sorted[i], hours = (+next.session.performedAt - +previous.session.performedAt) / 3600000;
      if (hours <= 0 || hours > 14 * 24) return [];
      const comparison = compare(previous, next);
      const priorPhase = phaseAt(previous.session.performedAt), nextPhase = phaseAt(next.session.performedAt);
      const priorTypes = [...new Set(previous.sets.filter((s) => s.setType.isIntensifier || isEdtSetType(s.setType)).map((s) => s.setType.slug))];
      const effective = previous.sets.reduce((sum, s) => sum + Math.max(0, number(s.setType.multiplier) ?? 0), 0);
      const rirs = previous.sets.map((s) => number(s.rir)).filter((n): n is number => n !== null);
      return [{ priorDate: previous.session.performedAt.toISOString().slice(0, 10), nextDate: next.session.performedAt.toISOString().slice(0, 10),
        priorPhase: priorPhase?.phase ?? "UNKNOWN", nextPhase: nextPhase?.phase ?? "UNKNOWN",
        priorPhaseStart: priorPhase?.startDate ?? null, nextPhaseStart: nextPhase?.startDate ?? null,
        hoursBetween: Math.round(hours), priorSetTypes: priorTypes, priorEffectiveSets: Math.round(effective * 10) / 10,
        priorMeanRir: rirs.length ? Math.round(rirs.reduce((a, b) => a + b, 0) / rirs.length * 10) / 10 : null,
        nextPerformanceChangePct: comparison.change, comparisonBasis: comparison.basis,
        nextPain: next.painFlag || next.sets.some((s) => s.painFlag),
        nextCompromisedSets: next.sets.filter((s) => details(s.intensifierDetails).executionCompromised === true).length }];
    });
    if (!pairs.length) return [];
    const currentPhase = phaseAt(latest.session.performedAt);
    const summarize = (intensified: boolean) => {
      const selected = pairs.filter((p) => Boolean(p.priorSetTypes.length) === intensified &&
        p.priorPhaseStart === p.nextPhaseStart && p.nextPhaseStart === (currentPhase?.startDate ?? null));
      const comparable = selected.filter((p) => p.nextPerformanceChangePct !== null);
      return { transitions: selected.length, comparable: comparable.length,
        stableOrImproved: comparable.filter((p) => p.nextPerformanceChangePct! >= -2).length,
        lowerPerformance: comparable.filter((p) => p.nextPerformanceChangePct! < -2).length,
        nextPain: selected.filter((p) => p.nextPain).length };
    };
    return [{ exerciseId: latest.exerciseId, name: latest.exercise.name, movementPatternId: latest.exercise.movementGroupId,
      primaryMuscleIds: latest.exercise.primaryMuscles.map((m) => m.muscleId), summaryPhase: currentPhase?.phase ?? "UNKNOWN", summaryPhaseStart: currentPhase?.startDate ?? null, afterIntensified: summarize(true), afterRegular: summarize(false), recentTransitions: pairs.slice(-3) }];
  });
  return { weeklyCompletedMuscleDose: [...weeks].sort(([a], [b]) => a.localeCompare(b)).slice(-8).map(([weekStart, muscles]) => ({ weekStart, muscles })),
    exerciseResponses: responses,
    caution: "Observed next-exposure associations are not causation. Compare the same exercise at similar RIR/technique, phase and spacing, accounting for intervening muscle overlap, illness, exercise order and sleep. Summary counts use only same-period transitions from the latest exposure's phase period; crossing-phase pairs remain dated observations, not like-for-like recovery evidence. Unknown phases stay UNKNOWN. Flat performance in a cut may be successful preservation. Early phase responses need transition-lag interpretation. Stable performance after intensified doses supports tolerance; missing anchors are unknown, not poor recovery. The 2% comparison band is a noise heuristic, not a fatigue diagnosis. Weekly doses may be partial weeks or incomplete history. Circumference and phase-aware performance are supporting outcomes, not direct stimulus measures." };
}
