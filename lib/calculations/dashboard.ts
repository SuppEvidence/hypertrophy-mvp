import type { VolumeWindowType } from "@/lib/types/domain";
import { volumeWindowDays } from "@/lib/programs/options";
import { calculateFatigueSummary, type FatigueSummary } from "@/lib/metrics/fatigue";
import { estimateE1RM } from "@/lib/workouts/summary";

export type VolumeStatus = "Below target" | "On target" | "Above target" | "Excessive" | "No target";
export type PerformanceTrendStatus = "Improving" | "Stable" | "Declining" | "Insufficient data";
export type DecisionFlagType =
  | "HOLD_CURRENT_SETUP"
  | "PRIORITY_UNDER_TARGET"
  | "PRIORITY_ABOVE_TARGET"
  | "FATIGUE_RISING"
  | "PERFORMANCE_DECLINING"
  | "VOLUME_HIGH_AND_PERFORMANCE_DECLINING"
  | "VOLUME_BELOW_TARGET_AND_FATIGUE_LOW"
  | "INTENSIFIER_INFLATING_EFFECTIVE_VOLUME"
  | "MISSED_TEMPLATE_UNDEREXPOSURE";

export type DashboardProgramInput = {
  secondaryContribution: unknown;
  volumeWindowType: VolumeWindowType;
  customWindowDays?: number | null;
  priorityMuscles: Array<{ muscleId: string; muscle: { name: string; sortOrder: number } }>;
  volumeTargets: Array<{ muscleId: string; weeklyTargetSets: unknown; muscle: { name: string; sortOrder: number } }>;
};

export type DashboardSetInput = {
  weight: unknown;
  reps: number | null;
  isCompleted: boolean;
  setType: { multiplier: unknown; isIntensifier: boolean };
};

export type DashboardSessionExerciseInput = {
  exerciseId: string;
  completedSets?: number | null;
  repRangeStatus?: string | null;
  effortStatus?: string | null;
  stimulusSetType?: { multiplier: unknown; isIntensifier: boolean } | null;
  exercise: {
    name: string;
    movementGroup: { id: string; name: string; sortOrder: number };
    primaryMuscles: Array<{ muscleId: string; muscle: { name: string; sortOrder: number } }>;
    secondaryMuscles: Array<{ muscleId: string; muscle: { name: string; sortOrder: number } }>;
  };
  sets: DashboardSetInput[];
};

export type DashboardSessionInput = {
  id: string;
  performedAt: Date;
  templateId: string | null;
  exercises: DashboardSessionExerciseInput[];
};

export type MetricTrendInput = {
  loggedAt: Date;
  bodyweight: unknown;
  waist: unknown;
  sleepDuration: unknown;
  sleepQuality: number | null;
  stress: number | null;
  readiness: number | null;
  manualFatigue: number | null;
  sorenessJointIrritation: number | null;
};

export type MuscleVolumeRow = {
  muscleId: string;
  muscleName: string;
  sortOrder: number;
  direct: number;
  effective: number;
  target: number | null;
  status: VolumeStatus;
  isPriority: boolean;
};

export type PerformanceTrend = {
  status: PerformanceTrendStatus;
  comparedExercises: number;
  declining: Array<{ exerciseName: string; changePct: number; latestE1rm: number; previousE1rm: number }>;
};

export type IntensifierSummary = {
  intensifierSets: number;
  completedSets: number;
  effectiveVolume: number;
  intensifierEffectiveVolume: number;
  share: number;
  isInflated: boolean;
};

export type MovementCoverageRow = {
  movementGroupId: string;
  movementGroupName: string;
  sortOrder: number;
  completedSets: number;
};

export type BodyMetricContext = {
  latestBodyweight: number | null;
  previousBodyweight: number | null;
  bodyweightChange: number | null;
  latestWaist: number | null;
  previousWaist: number | null;
  waistChange: number | null;
  bodyweightSampleCount: number;
  waistSampleCount: number;
  comparisonBodyweightSampleCount: number;
  comparisonWaistSampleCount: number;
};

export type FatigueTrend = {
  latest: FatigueSummary | null;
  previousAverageScore: number | null;
  isRising: boolean;
};

export type DecisionFlag = {
  type: DecisionFlagType;
  title: string;
  detail: string;
  severity: "neutral" | "watch" | "high";
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function volumeStatus(actual: number, target: number | null): VolumeStatus {
  if (!target || target <= 0) return "No target";
  const ratio = actual / target;
  if (ratio < 0.85) return "Below target";
  if (ratio <= 1.15) return "On target";
  if (ratio <= 1.35) return "Above target";
  return "Excessive";
}

function isProductiveEffort(status: string | null | undefined) {
  return status === "PRODUCTIVE" || status === "VERY_HARD" || status === "FAILURE";
}

function usesStimulusRow(sessionExercise: DashboardSessionExerciseInput) {
  return sessionExercise.completedSets !== null && sessionExercise.completedSets !== undefined && Boolean(sessionExercise.stimulusSetType);
}

function completedStimulusSets(sessionExercise: DashboardSessionExerciseInput) {
  return Math.max(0, sessionExercise.completedSets ?? 0);
}

function productiveStimulusEquivalent(sessionExercise: DashboardSessionExerciseInput) {
  if (!usesStimulusRow(sessionExercise)) return null;
  if (!isProductiveEffort(sessionExercise.effortStatus)) return 0;
  return completedStimulusSets(sessionExercise) * (toNumber(sessionExercise.stimulusSetType?.multiplier) ?? 1);
}

export function selectedWindowDays(program: { volumeWindowType: VolumeWindowType; customWindowDays?: number | null }) {
  return volumeWindowDays(program.volumeWindowType, program.customWindowDays ?? null);
}

export function selectedWindowStart(now: Date, days: number) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function buildMuscleVolumeRows(program: DashboardProgramInput, sessions: DashboardSessionInput[]): MuscleVolumeRow[] {
  const secondaryContribution = Number(program.secondaryContribution || 0);
  const windowDays = selectedWindowDays(program);
  const priorityIds = new Set(program.priorityMuscles.map((link) => link.muscleId));
  const targets = new Map(
    program.volumeTargets.map((target) => [
      target.muscleId,
      {
        muscleName: target.muscle.name,
        sortOrder: target.muscle.sortOrder,
        target: ((toNumber(target.weeklyTargetSets) ?? 0) * windowDays) / 7,
      },
    ]),
  );

  const rows = new Map<string, { muscleId: string; muscleName: string; sortOrder: number; direct: number; effective: number }>();

  for (const target of program.volumeTargets) {
    rows.set(target.muscleId, {
      muscleId: target.muscleId,
      muscleName: target.muscle.name,
      sortOrder: target.muscle.sortOrder,
      direct: 0,
      effective: 0,
    });
  }

  for (const session of sessions) {
    for (const sessionExercise of session.exercises) {
      const stimulusEquivalent = productiveStimulusEquivalent(sessionExercise);
      const contributions = stimulusEquivalent !== null
        ? [{ completed: completedStimulusSets(sessionExercise), effective: stimulusEquivalent }]
        : sessionExercise.sets
            .filter((set) => set.isCompleted)
            .map((set) => ({ completed: 1, effective: toNumber(set.setType.multiplier) ?? 1 }));

      for (const contribution of contributions) {
        for (const link of sessionExercise.exercise.primaryMuscles) {
          const row = rows.get(link.muscleId) ?? {
            muscleId: link.muscleId,
            muscleName: link.muscle.name,
            sortOrder: link.muscle.sortOrder,
            direct: 0,
            effective: 0,
          };
          row.direct += contribution.completed;
          row.effective += contribution.effective;
          rows.set(link.muscleId, row);
        }

        for (const link of sessionExercise.exercise.secondaryMuscles) {
          const row = rows.get(link.muscleId) ?? {
            muscleId: link.muscleId,
            muscleName: link.muscle.name,
            sortOrder: link.muscle.sortOrder,
            direct: 0,
            effective: 0,
          };
          row.effective += contribution.effective * secondaryContribution;
          rows.set(link.muscleId, row);
        }
      }
    }
  }

  return Array.from(rows.values())
    .map((row) => {
      const target = targets.get(row.muscleId)?.target ?? null;
      return {
        ...row,
        direct: round(row.direct),
        effective: round(row.effective),
        target: target === null ? null : round(target),
        status: volumeStatus(row.effective, target),
        isPriority: priorityIds.has(row.muscleId),
      };
    })
    .sort((a, b) => Number(b.isPriority) - Number(a.isPriority) || a.sortOrder - b.sortOrder);
}

export function buildIntensifierSummary(sessions: DashboardSessionInput[]): IntensifierSummary {
  let completedSets = 0;
  let intensifierSets = 0;
  let effectiveVolume = 0;
  let intensifierEffectiveVolume = 0;

  for (const session of sessions) {
    for (const sessionExercise of session.exercises) {
      const primaryCount = sessionExercise.exercise.primaryMuscles.length || 1;
      if (usesStimulusRow(sessionExercise)) {
        const completed = completedStimulusSets(sessionExercise);
        const multiplier = toNumber(sessionExercise.stimulusSetType?.multiplier) ?? 1;
        const productiveEquivalent = isProductiveEffort(sessionExercise.effortStatus) ? completed * multiplier * primaryCount : 0;
        completedSets += completed;
        effectiveVolume += productiveEquivalent;
        if (sessionExercise.stimulusSetType?.isIntensifier) {
          intensifierSets += completed;
          intensifierEffectiveVolume += productiveEquivalent;
        }
        continue;
      }

      for (const set of sessionExercise.sets) {
        if (!set.isCompleted) continue;
        const multiplier = toNumber(set.setType.multiplier) ?? 1;
        const setEffective = multiplier * primaryCount;
        completedSets += 1;
        effectiveVolume += setEffective;
        if (set.setType.isIntensifier) {
          intensifierSets += 1;
          intensifierEffectiveVolume += setEffective;
        }
      }
    }
  }

  const share = effectiveVolume > 0 ? intensifierEffectiveVolume / effectiveVolume : 0;
  return {
    completedSets,
    intensifierSets,
    effectiveVolume: round(effectiveVolume),
    intensifierEffectiveVolume: round(intensifierEffectiveVolume),
    share: round(share * 100),
    isInflated: share >= 0.25 && intensifierSets > 0,
  };
}

export function buildMovementCoverage(sessions: DashboardSessionInput[]): MovementCoverageRow[] {
  const rows = new Map<string, MovementCoverageRow>();
  for (const session of sessions) {
    for (const sessionExercise of session.exercises) {
      const completed = usesStimulusRow(sessionExercise) ? completedStimulusSets(sessionExercise) : sessionExercise.sets.filter((set) => set.isCompleted).length;
      if (completed === 0) continue;
      const movement = sessionExercise.exercise.movementGroup;
      const row = rows.get(movement.id) ?? {
        movementGroupId: movement.id,
        movementGroupName: movement.name,
        sortOrder: movement.sortOrder,
        completedSets: 0,
      };
      row.completedSets += completed;
      rows.set(movement.id, row);
    }
  }
  return Array.from(rows.values()).sort((a, b) => b.completedSets - a.completedSets || a.sortOrder - b.sortOrder);
}

export function buildPerformanceTrend(sessions: DashboardSessionInput[]): PerformanceTrend {
  const exposures = new Map<string, Array<{ exerciseName: string; date: Date; bestE1rm: number }>>();

  for (const session of sessions) {
    for (const sessionExercise of session.exercises) {
      let best: number | null = null;
      for (const set of sessionExercise.sets) {
        if (!set.isCompleted) continue;
        const e1rm = estimateE1RM(toNumber(set.weight), set.reps);
        if (e1rm !== null && (best === null || e1rm > best)) best = e1rm;
      }
      if (best === null) continue;
      const list = exposures.get(sessionExercise.exerciseId) ?? [];
      list.push({ exerciseName: sessionExercise.exercise.name, date: session.performedAt, bestE1rm: best });
      exposures.set(sessionExercise.exerciseId, list);
    }
  }

  const declining: PerformanceTrend["declining"] = [];
  let comparedExercises = 0;
  let improving = 0;
  let stable = 0;

  for (const list of exposures.values()) {
    const sorted = list.sort((a, b) => a.date.getTime() - b.date.getTime());
    if (sorted.length < 2) continue;
    const latest = sorted[sorted.length - 1];
    const previous = sorted[sorted.length - 2];
    if (!latest || !previous || previous.bestE1rm <= 0) continue;
    comparedExercises += 1;
    const changePct = ((latest.bestE1rm - previous.bestE1rm) / previous.bestE1rm) * 100;
    if (changePct < -2) {
      declining.push({
        exerciseName: latest.exerciseName,
        changePct: round(changePct, 1),
        latestE1rm: round(latest.bestE1rm, 1),
        previousE1rm: round(previous.bestE1rm, 1),
      });
    } else if (changePct > 2) {
      improving += 1;
    } else {
      stable += 1;
    }
  }

  if (comparedExercises === 0) return { status: "Insufficient data", comparedExercises, declining: [] };
  if (declining.length > 0) return { status: "Declining", comparedExercises, declining: declining.sort((a, b) => a.changePct - b.changePct) };
  if (improving > stable) return { status: "Improving", comparedExercises, declining: [] };
  return { status: "Stable", comparedExercises, declining: [] };
}

export function buildFatigueTrend(metrics: MetricTrendInput[]): FatigueTrend {
  if (metrics.length === 0) return { latest: null, previousAverageScore: null, isRising: false };
  const summaries = metrics.map((metric) =>
    calculateFatigueSummary({
      sleepDuration: toNumber(metric.sleepDuration),
      sleepQuality: metric.sleepQuality,
      stress: metric.stress,
      readiness: metric.readiness,
      manualFatigue: metric.manualFatigue,
      sorenessJointIrritation: metric.sorenessJointIrritation,
    }),
  );
  const latest = summaries[0] ?? null;
  const previousScores = summaries.slice(1).map((item) => item.score).filter((score): score is number => typeof score === "number");
  const previousAverageScore = previousScores.length > 0 ? round(previousScores.reduce((sum, score) => sum + score, 0) / previousScores.length, 0) : null;
  const isRising = latest?.score !== null && latest?.score !== undefined && previousAverageScore !== null && latest.score >= previousAverageScore + 10;
  return { latest, previousAverageScore, isRising };
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function valuesInDateRange(metrics: MetricTrendInput[], field: "bodyweight" | "waist", start: Date, end: Date) {
  return metrics
    .filter((metric) => metric.loggedAt >= start && metric.loggedAt < end)
    .map((metric) => toNumber(metric[field]))
    .filter((value): value is number => value !== null);
}

export function buildBodyMetricContext(metrics: MetricTrendInput[]): BodyMetricContext {
  const now = new Date();
  const currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const currentBodyweights = valuesInDateRange(metrics, "bodyweight", currentStart, now);
  const previousBodyweights = valuesInDateRange(metrics, "bodyweight", previousStart, currentStart);
  const currentWaists = valuesInDateRange(metrics, "waist", currentStart, now);
  const previousWaists = valuesInDateRange(metrics, "waist", previousStart, currentStart);

  const latestBodyweight = average(currentBodyweights);
  const previousBodyweight = average(previousBodyweights);
  const latestWaist = average(currentWaists);
  const previousWaist = average(previousWaists);

  return {
    latestBodyweight: latestBodyweight === null ? null : round(latestBodyweight, 1),
    previousBodyweight: previousBodyweight === null ? null : round(previousBodyweight, 1),
    bodyweightChange: latestBodyweight !== null && previousBodyweight !== null ? round(latestBodyweight - previousBodyweight, 1) : null,
    latestWaist: latestWaist === null ? null : round(latestWaist, 0),
    previousWaist: previousWaist === null ? null : round(previousWaist, 0),
    waistChange: latestWaist !== null && previousWaist !== null ? round(latestWaist - previousWaist, 0) : null,
    bodyweightSampleCount: currentBodyweights.length,
    waistSampleCount: currentWaists.length,
    comparisonBodyweightSampleCount: previousBodyweights.length,
    comparisonWaistSampleCount: previousWaists.length,
  };
}

export function buildDecisionFlags(args: {
  volumeRows: MuscleVolumeRow[];
  fatigueTrend: FatigueTrend;
  performanceTrend: PerformanceTrend;
  intensifiers: IntensifierSummary;
  missedTemplateNames: string[];
}): DecisionFlag[] {
  const flags: DecisionFlag[] = [];
  const priorityRows = args.volumeRows.filter((row) => row.isPriority);
  const underPriority = priorityRows.filter((row) => row.status === "Below target");
  const abovePriority = priorityRows.filter((row) => row.status === "Above target" || row.status === "Excessive");
  const anyHighVolume = args.volumeRows.some((row) => row.status === "Above target" || row.status === "Excessive");
  const anyBelowTarget = args.volumeRows.some((row) => row.status === "Below target");

  if (underPriority.length > 0) {
    flags.push({
      type: "PRIORITY_UNDER_TARGET",
      title: "Priority muscle under target",
      detail: `${underPriority.map((row) => row.muscleName).join(", ")} below selected-window target.`,
      severity: "watch",
    });
  }

  if (abovePriority.length > 0) {
    flags.push({
      type: "PRIORITY_ABOVE_TARGET",
      title: "Priority muscle above target",
      detail: `${abovePriority.map((row) => row.muscleName).join(", ")} above selected-window target.`,
      severity: "watch",
    });
  }

  if (args.fatigueTrend.isRising) {
    flags.push({
      type: "FATIGUE_RISING",
      title: "Fatigue rising",
      detail: `Latest fatigue score is ${args.fatigueTrend.latest?.score}/100 versus recent average ${args.fatigueTrend.previousAverageScore}/100.`,
      severity: "watch",
    });
  }

  if (args.performanceTrend.status === "Declining") {
    flags.push({
      type: "PERFORMANCE_DECLINING",
      title: "Performance declining",
      detail: `${args.performanceTrend.declining.length} exercise(s) show lower latest e1RM versus prior exposure.`,
      severity: "watch",
    });
  }

  if (anyHighVolume && args.performanceTrend.status === "Declining") {
    flags.push({
      type: "VOLUME_HIGH_AND_PERFORMANCE_DECLINING",
      title: "Volume high and performance declining",
      detail: "At least one muscle is above target while exercise performance trend is declining.",
      severity: "high",
    });
  }

  if (anyBelowTarget && args.fatigueTrend.latest?.category === "Low") {
    flags.push({
      type: "VOLUME_BELOW_TARGET_AND_FATIGUE_LOW",
      title: "Volume below target and fatigue low",
      detail: "At least one muscle is below target while latest fatigue context is low.",
      severity: "neutral",
    });
  }

  if (args.intensifiers.isInflated) {
    flags.push({
      type: "INTENSIFIER_INFLATING_EFFECTIVE_VOLUME",
      title: "Intensifier use inflating effective volume",
      detail: `${args.intensifiers.share}% of effective volume comes from intensifier set types in the selected window.`,
      severity: "watch",
    });
  }

  if (args.missedTemplateNames.length > 0 && underPriority.length > 0) {
    flags.push({
      type: "MISSED_TEMPLATE_UNDEREXPOSURE",
      title: "Missed template causing muscle underexposure",
      detail: `${args.missedTemplateNames.slice(0, 3).join(", ")} has no completed session in the selected window while priority muscles are below target.`,
      severity: "watch",
    });
  }

  if (flags.length === 0) {
    flags.push({
      type: "HOLD_CURRENT_SETUP",
      title: "Hold current setup",
      detail: "Priority volume, fatigue context, and available performance trend do not show a clear issue.",
      severity: "neutral",
    });
  }

  return flags;
}
