export const T3_VOLUME_POLICY_VERSION = "t3-priority-volume-v2";
// Application guardrails, not claims about a universal physiological optimum.
export const T3_RANGE_CEILING = 60;
export const T3_REVIEW_LEASE_MS = 5 * 60_000;
export const T3_STANDARD_REVIEW_DAYS = 7;
export const T3_ADVERSE_REVIEW_HOURS = 48;

export const T3_MUSCLE_PRIORITIES = [
  "SPECIALIZE",
  "GROW",
  "MAINTAIN",
  "INDIRECT_ONLY",
] as const;

export type T3MusclePriority = (typeof T3_MUSCLE_PRIORITIES)[number];

export function isT3Priority(value: unknown): value is T3MusclePriority {
  return typeof value === "string" && T3_MUSCLE_PRIORITIES.includes(value as T3MusclePriority);
}

export function t3PriorityLabel(priority: T3MusclePriority) {
  if (priority === "SPECIALIZE") return "High priority";
  if (priority === "GROW") return "Grow";
  if (priority === "MAINTAIN") return "Maintenance";
  return "No direct focus";
}

export function suggestedT3Priority(args: {
  programPriority: boolean;
  baselineWeeklySets: number;
}): T3MusclePriority {
  if (args.programPriority) return "SPECIALIZE";
  if (args.baselineWeeklySets > 0) return "GROW";
  return "INDIRECT_ONLY";
}

export function initialT3Range(
  priority: T3MusclePriority,
  baselineWeeklySets: number,
) {
  const baseline = Math.min(T3_RANGE_CEILING, Math.max(0, Number.isFinite(baselineWeeklySets) ? Number(baselineWeeklySets.toFixed(1)) : 0));
  // An unreviewed block knows its prescribed starting dose, not a proven response range.
  // The coach estimates the range once there is training evidence; priority alone never invents one.
  void priority;
  return { minimum: baseline, maximum: baseline };
}

export function shouldRunT3Evaluation(args: {
  activatedAt: Date;
  lastEvaluatedAt: Date | null;
  completedWorkoutsSinceActivation: number;
  hasNewEvidence: boolean;
  adverseSignal: boolean;
  now?: Date;
}) {
  if (!args.hasNewEvidence || args.completedWorkoutsSinceActivation < 1) return false;
  if (!args.lastEvaluatedAt) return true;

  const now = args.now ?? new Date();
  const elapsedHours =
    (now.getTime() - args.lastEvaluatedAt.getTime()) / (60 * 60 * 1000);
  if (args.adverseSignal && elapsedHours >= T3_ADVERSE_REVIEW_HOURS) return true;
  return elapsedHours >= T3_STANDARD_REVIEW_DAYS * 24;
}

export function nextT3CoachTarget(args: {
  current: number;
  delta: number;
  minimum: number;
  maximum: number;
  priority: T3MusclePriority;
  confidence?: string;
  status?: string;
}) {
  const limits = t3StepLimits(args.current, args.confidence, args.status);
  if (!Number.isFinite(args.current) || args.current < 0 || !Number.isInteger(args.delta) || args.delta > limits.increase || -args.delta > limits.decrease) {
    throw new Error("This dose change exceeds the staged adjustment allowed by its evidence and current dose.");
  }
  if (args.priority === "INDIRECT_ONLY" && args.delta > 0) {
    throw new Error("No-direct-focus muscles cannot receive an automatic volume increase proposal.");
  }
  if (!Number.isFinite(args.minimum) || !Number.isFinite(args.maximum) || args.minimum < 0 || args.maximum < args.minimum || args.maximum > T3_RANGE_CEILING) {
    throw new Error("T3 returned an invalid evidence-based dose range.");
  }

  const next = args.current + args.delta;
  if (next < 0 || (next > T3_RANGE_CEILING && args.delta > 0)) throw new Error("The proposed training dose is outside the application limits.");
  return Number(next.toFixed(1));
}

export function t3StepLimits(current: number, confidence = "MODERATE", status = "") {
  return {
    increase: confidence === "HIGH" ? Math.min(4, Math.max(2, Math.floor(current * 0.2))) : 2,
    decrease: confidence === "HIGH" || (confidence === "MODERATE" && status === "RECOVERABILITY_CONCERN")
      ? Math.min(6, Math.max(2, Math.ceil(current * 0.25))) : 2,
  };
}
