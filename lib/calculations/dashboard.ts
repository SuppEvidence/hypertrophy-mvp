import type { VolumeWindowType } from "@/lib/types/domain";
import { volumeWindowDays } from "@/lib/programs/options";
import { calculateFatigueSummary, type FatigueSummary } from "@/lib/metrics/fatigue";
import { estimateE1RM } from "@/lib/workouts/summary";
import { getStimulusContribution, usesStimulusEntry } from "@/lib/workouts/stimulus";

export type VolumeStatus = "Below target" | "On target" | "Above target" | "Excessive" | "No target";
export type PerformanceTrendStatus = "Improving" | "Stable" | "Declining" | "Insufficient data";
export type DecisionFlagType =
  | "HOLD_CURRENT_STIMULUS"
  | "PRIORITY_PRODUCTIVE_VOLUME_LOW"
  | "PRIORITY_PRODUCTIVE_VOLUME_HIGH"
  | "FATIGUE_RISING"
  | "TOO_EASY_STIMULUS_SHARE"
  | "VERY_HARD_STIMULUS_SKEW"
  | "REP_RANGE_QUALITY_ISSUE"
  | "LOW_VOLUME_WITH_LOW_FATIGUE"
  | "INTENSIFIER_SHARE_HIGH"
  | "MISSED_TEMPLATE_UNDEREXPOSURE"
  | "WAIST_TREND_UP";

export type DashboardProgramInput = {
  secondaryContribution: unknown;
  volumeWindowType: VolumeWindowType;
  customWindowDays?: number | null;
  priorityMuscles: Array<{ muscleId: string; muscle: { name: string; sortOrder: number } }>;
  volumeTargets: Array<{ muscleId: string; weeklyTargetSets: unknown; muscle: { name: string; sortOrder: number } }>;
};

export type DashboardSetInput = {
  setNumber?: number | null;
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

export type StimulusQuality = {
  completedSets: number;
  effort: {
    tooEasy: number;
    productive: number;
    veryHard: number;
    failure: number;
    notSure: number;
  };
  repRange: {
    inRange: number;
    tooLow: number;
    tooHigh: number;
    mixed: number;
    notLogged: number;
  };
  tooEasyShare: number;
  hardShare: number;
  repIssueShare: number;
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
      const contribution = getStimulusContribution(sessionExercise);
      if (contribution.completed === 0) continue;

      for (const link of sessionExercise.exercise.primaryMuscles) {
        const row = rows.get(link.muscleId) ?? {
          muscleId: link.muscleId,
          muscleName: link.muscle.name,
          sortOrder: link.muscle.sortOrder,
          direct: 0,
          effective: 0,
        };
        row.direct += contribution.completed;
        row.effective += contribution.productiveEquivalent;
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
        row.effective += contribution.productiveEquivalent * secondaryContribution;
        rows.set(link.muscleId, row);
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
      const contribution = getStimulusContribution(sessionExercise);
      completedSets += contribution.completed;
      intensifierSets += contribution.intensifierSets;
      effectiveVolume += contribution.productiveEquivalent * primaryCount;
      intensifierEffectiveVolume += contribution.intensifierProductiveEquivalent * primaryCount;
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
      const completed = getStimulusContribution(sessionExercise).completed;
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

export function buildStimulusQuality(sessions: DashboardSessionInput[]): StimulusQuality {
  const effort = { tooEasy: 0, productive: 0, veryHard: 0, failure: 0, notSure: 0 };
  const repRange = { inRange: 0, tooLow: 0, tooHigh: 0, mixed: 0, notLogged: 0 };

  for (const session of sessions) {
    for (const sessionExercise of session.exercises) {
      const completed = getStimulusContribution(sessionExercise).completed;
      if (completed === 0) continue;

      if (usesStimulusEntry(sessionExercise)) {
        if (sessionExercise.effortStatus === "TOO_EASY") effort.tooEasy += completed;
        else if (sessionExercise.effortStatus === "PRODUCTIVE") effort.productive += completed;
        else if (sessionExercise.effortStatus === "VERY_HARD") effort.veryHard += completed;
        else if (sessionExercise.effortStatus === "FAILURE") effort.failure += completed;
        else effort.notSure += completed;

        if (sessionExercise.repRangeStatus === "IN_RANGE") repRange.inRange += completed;
        else if (sessionExercise.repRangeStatus === "TOO_LOW") repRange.tooLow += completed;
        else if (sessionExercise.repRangeStatus === "TOO_HIGH") repRange.tooHigh += completed;
        else if (sessionExercise.repRangeStatus === "MIXED") repRange.mixed += completed;
        else repRange.notLogged += completed;
      } else {
        effort.productive += completed;
        repRange.notLogged += completed;
      }
    }
  }

  const completedSets = effort.tooEasy + effort.productive + effort.veryHard + effort.failure + effort.notSure;
  const hardSets = effort.veryHard + effort.failure;
  const repIssueSets = repRange.tooLow + repRange.tooHigh + repRange.mixed;

  return {
    completedSets,
    effort,
    repRange,
    tooEasyShare: completedSets > 0 ? round((effort.tooEasy / completedSets) * 100) : 0,
    hardShare: completedSets > 0 ? round((hardSets / completedSets) * 100) : 0,
    repIssueShare: completedSets > 0 ? round((repIssueSets / completedSets) * 100) : 0,
  };
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
  stimulusQuality: StimulusQuality;
  bodyMetrics: BodyMetricContext;
  missedTemplateNames: string[];
}): DecisionFlag[] {
  const flags: DecisionFlag[] = [];
  const priorityRows = args.volumeRows.filter((row) => row.isPriority);
  const underPriority = priorityRows.filter((row) => row.status === "Below target");
  const abovePriority = priorityRows.filter((row) => row.status === "Above target" || row.status === "Excessive");
  const anyBelowTarget = args.volumeRows.some((row) => row.status === "Below target");
  const completedSets = args.stimulusQuality.completedSets;
  const enoughStimulusData = completedSets >= 6;

  if (underPriority.length > 0) {
    flags.push({
      type: "PRIORITY_PRODUCTIVE_VOLUME_LOW",
      title: "Priority productive volume below target",
      detail: `${underPriority.map((row) => row.muscleName).join(", ")} below selected-window target when using productive volume-equivalent sets.`,
      severity: "watch",
    });
  }

  if (abovePriority.length > 0) {
    flags.push({
      type: "PRIORITY_PRODUCTIVE_VOLUME_HIGH",
      title: "Priority productive volume above target",
      detail: `${abovePriority.map((row) => row.muscleName).join(", ")} above selected-window target. Check recovery before adding more sets.`,
      severity: abovePriority.some((row) => row.status === "Excessive") ? "high" : "watch",
    });
  }

  if (args.fatigueTrend.isRising) {
    flags.push({
      type: "FATIGUE_RISING",
      title: "Fatigue context rising",
      detail: `Latest fatigue score is ${args.fatigueTrend.latest?.score}/100 versus recent average ${args.fatigueTrend.previousAverageScore}/100.`,
      severity: "watch",
    });
  }

  if (enoughStimulusData && args.stimulusQuality.tooEasyShare >= 15) {
    flags.push({
      type: "TOO_EASY_STIMULUS_SHARE",
      title: "Too much non-productive effort",
      detail: `${args.stimulusQuality.tooEasyShare}% of completed sets were marked too easy. Those sets are excluded from productive volume-equivalent volume.`,
      severity: "watch",
    });
  }

  if (enoughStimulusData && args.stimulusQuality.hardShare >= 45) {
    flags.push({
      type: "VERY_HARD_STIMULUS_SKEW",
      title: "Hard-effort skew",
      detail: `${args.stimulusQuality.hardShare}% of completed sets were marked very hard or failure. This is productive, but recovery cost may be high.`,
      severity: args.fatigueTrend.isRising ? "high" : "watch",
    });
  }

  if (enoughStimulusData && args.stimulusQuality.repIssueShare >= 20) {
    flags.push({
      type: "REP_RANGE_QUALITY_ISSUE",
      title: "Rep-range quality issue",
      detail: `${args.stimulusQuality.repIssueShare}% of completed sets were marked too low, too high, or mixed. Review load/rep target fit.`,
      severity: "watch",
    });
  }

  if (anyBelowTarget && args.fatigueTrend.latest?.category === "Low") {
    flags.push({
      type: "LOW_VOLUME_WITH_LOW_FATIGUE",
      title: "Volume below target while fatigue is low",
      detail: "At least one muscle is below target and latest fatigue context is low. This usually points to missed exposure rather than recovery limitation.",
      severity: "neutral",
    });
  }

  if (args.intensifiers.isInflated) {
    flags.push({
      type: "INTENSIFIER_SHARE_HIGH",
      title: "High intensifier share",
      detail: `${args.intensifiers.share}% of productive volume-equivalent work comes from intensifier set types in the selected window.`,
      severity: "watch",
    });
  }

  if (args.missedTemplateNames.length > 0 && underPriority.length > 0) {
    flags.push({
      type: "MISSED_TEMPLATE_UNDEREXPOSURE",
      title: "Missed template underexposure",
      detail: `${args.missedTemplateNames.slice(0, 3).join(", ")} has no completed session in the selected window while priority muscles are below target.`,
      severity: "watch",
    });
  }

  if ((args.bodyMetrics.waistChange ?? 0) >= 5 && (args.bodyMetrics.bodyweightChange ?? 0) >= 0) {
    flags.push({
      type: "WAIST_TREND_UP",
      title: "Waist trend moving up",
      detail: `7-day waist average is up ${args.bodyMetrics.waistChange} mm versus the previous 7 days. Interpret alongside bodyweight trend and mesocycle phase.`,
      severity: "watch",
    });
  }

  if (flags.length === 0) {
    flags.push({
      type: "HOLD_CURRENT_STIMULUS",
      title: "Hold current stimulus setup",
      detail: "Productive volume, effort quality, rep-range quality, fatigue context, and body metric trend do not show a clear issue.",
      severity: "neutral",
    });
  }

  return flags;
}
