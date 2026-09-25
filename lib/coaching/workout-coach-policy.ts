/** Pure, conservative T1 policy. Thresholds are product guardrails, not physiological cutoffs. */
export function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

export function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export type CoachPrescription = {
  minReps: number | null;
  maxReps: number | null;
  targetRir: number | null;
  suggestedLoad: number | null;
};

export function readPrescription(value: unknown): CoachPrescription {
  const stored = object(value);
  const current = object(stored.current ?? stored.original);
  return {
    minReps: numeric(current.minReps), maxReps: numeric(current.maxReps),
    targetRir: numeric(current.targetRir), suggestedLoad: numeric(current.suggestedLoad),
  };
}

export type CoachSet = {
  id: string; setNumber: number; weight: number | null; reps: number | null;
  rir: number | null; setTypeId: string; isIntensifier: boolean; isEdt?: boolean;
  pain: boolean; executionCompromised: boolean;
};

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function buildAllowedLoadOptions(
  referenceLoad: number | null,
  minimumWeightIncrement: number | null,
): number[] {
  if (!referenceLoad || referenceLoad <= 0 || !minimumWeightIncrement || minimumWeightIncrement <= 0) return [];
  const options: number[] = [];
  for (let step = -20; step <= 20; step += 1) {
    if (step === 0) continue;
    const candidate = Number((referenceLoad + step * minimumWeightIncrement).toFixed(2));
    if (candidate <= 0 || candidate < referenceLoad * 0.9 - 0.001 || candidate > referenceLoad * 1.05 + 0.001) continue;
    options.push(candidate);
  }
  return [...new Set(options)].sort((a, b) => a - b);
}

function index(set: CoachSet): number | null {
  if (set.isIntensifier || set.isEdt || set.pain || set.executionCompromised ||
      set.weight === null || set.weight <= 0 || set.reps === null || set.reps < 1 ||
      set.reps > 20 || set.rir === null || set.rir < 0 || set.rir > 4) return null;
  return set.weight * (1 + (set.reps + set.rir) / 30);
}

function comparable(a: CoachSet, b: CoachSet) {
  return a.setTypeId === b.setTypeId && index(b) !== null && a.weight !== null &&
    b.weight !== null && Math.abs(b.weight / a.weight - 1) <= 0.2 &&
    a.reps !== null && b.reps !== null && Math.abs(a.reps - b.reps) <= 5;
}

export function detectCoachSignal(input: {
  trigger: CoachSet; current: CoachSet[]; history: CoachSet[][];
  prescription: CoachPrescription; exercisePain: boolean;
}) {
  const { trigger, prescription } = input;
  if (input.exercisePain || trigger.pain) return { shouldCheck: true, reason: "PAIN", confidence: "MODERATE" } as const;
  if (trigger.executionCompromised) return { shouldCheck: true, reason: "EXECUTION", confidence: "MODERATE" } as const;
  const performance = index(trigger);
  if (performance === null) return { shouldCheck: false, reason: "INCOMPARABLE_SET" } as const;
  const peers = input.history.flatMap(exposure => {
    const peer = exposure.find(s => s.setNumber === trigger.setNumber && comparable(trigger, s));
    return peer ? [peer] : [];
  });
  if (peers.length < 3) return { shouldCheck: false, reason: "INSUFFICIENT_COMPARABLE_HISTORY" } as const;
  const values = peers.map(s => index(s)!);
  const baseline = median(values)!;
  const variability = median(values.map(v => Math.abs(v - baseline)))! / baseline * 100;
  const performanceDeviationPct = (performance / baseline - 1) * 100;
  const first = input.current.find(s => s.setNumber === 1 && comparable(trigger, s));
  const decay = first && index(first) ? (performance / index(first)! - 1) * 100 : null;
  const historicalDecay = input.history.flatMap(exposure => {
    const a = exposure.find(s => s.setNumber === 1 && s.setTypeId === trigger.setTypeId && index(s) !== null);
    const b = exposure.find(s => s.setNumber === trigger.setNumber && comparable(trigger, s));
    return a && b ? [(index(b)! / index(a)! - 1) * 100] : [];
  });
  const normalDecay = median(historicalDecay);
  const excessiveDecay = trigger.setNumber > 1 && historicalDecay.length >= 3 && decay !== null &&
    normalDecay !== null && decay < normalDecay - Math.max(6, 3 * (median(historicalDecay.map(v => Math.abs(v - normalDecay))) ?? 0));
  const missedReps = prescription.minReps !== null && trigger.reps! < prescription.minReps - 1;
  const missedRir = prescription.targetRir !== null && Math.abs(trigger.rir! - prescription.targetRir) >= 2;
  const tooEasy = prescription.maxReps !== null && trigger.reps! > prescription.maxReps + 1 &&
    prescription.targetRir !== null && trigger.rir! >= prescription.targetRir;
  const reason = excessiveDecay ? "EXCESSIVE_DECAY" : missedReps || missedRir || tooEasy ? "TARGET_MISS" :
    performanceDeviationPct < -Math.max(8, 3 * variability) ? "PERFORMANCE_DROP" : null;
  if (!reason) return { shouldCheck: false, reason: "NORMAL_VARIATION" } as const;
  return {
    shouldCheck: true, reason, confidence: peers.length >= 5 ? "HIGH" : "MODERATE",
    comparableExposures: peers.length, performanceDeviationPct, decayPct: decay,
    historicalDecayPct: normalDecay, variabilityPct: variability,
  } as const;
}

export type CoachDecision = {
  action: "KEEP" | "ADJUST" | "REMOVE_SET" | "STOP_EXERCISE";
  confidence: "LOW" | "MODERATE" | "HIGH";
  reason: string; suggestedLoad: number | null;
  minReps: number | null; maxReps: number | null; targetRir: number | null;
};

/** Reject invalid recommendations; never silently turn a large change into a different intervention. */
export function validateCoachDecision(decision: CoachDecision, input: {
  current: CoachPrescription; referenceLoad: number | null; trigger: CoachSet;
  signal: string; targetIsIntensifier: boolean; allowedLoadOptions: number[];
}): string | null {
  if (decision.action === "KEEP") return null;
  if (decision.confidence === "LOW") return "LOW_CONFIDENCE";
  if (decision.action !== "ADJUST") return null; // Removal still requires explicit approval.
  if (input.signal === "PAIN") return "PAIN_REQUIRES_REVIEW";
  if (input.targetIsIntensifier || input.trigger.isIntensifier) return "INTENSIFIER_ADJUSTMENT_UNSUPPORTED";
  const { current } = input;
  const clearlyTooEasy = input.signal === "TARGET_MISS" && current.targetRir !== null &&
    input.trigger.rir !== null && input.trigger.rir >= current.targetRir + 2 &&
    current.minReps !== null && input.trigger.reps !== null && input.trigger.reps >= current.minReps;
  if ((decision.suggestedLoad === null || decision.suggestedLoad === (current.suggestedLoad ?? input.referenceLoad)) &&
    (decision.minReps === null || decision.minReps === current.minReps) &&
    (decision.maxReps === null || decision.maxReps === current.maxReps) &&
    (decision.targetRir === null || decision.targetRir === current.targetRir)) return "NO_CHANGE";
  if (decision.suggestedLoad !== null) {
    const reference = input.referenceLoad;
    if (!reference || decision.suggestedLoad <= 0 || decision.suggestedLoad > 99999 ||
        decision.suggestedLoad < reference * 0.9 || decision.suggestedLoad > reference * 1.05) return "LOAD_BOUND";
    if (!clearlyTooEasy && decision.suggestedLoad > reference) return "NO_LOAD_INCREASE";
    if (input.allowedLoadOptions.length === 0) return "LOAD_INCREMENT_UNCONFIGURED";
    if (!input.allowedLoadOptions.some(load => Math.abs(load - decision.suggestedLoad!) < 0.001)) return "LOAD_INCREMENT";
  }
  if (decision.minReps !== null || decision.maxReps !== null) {
    if (decision.minReps === null || decision.maxReps === null || current.minReps === null || current.maxReps === null ||
        !Number.isInteger(decision.minReps) || !Number.isInteger(decision.maxReps) ||
        decision.minReps < 3 || decision.maxReps > 30 || decision.minReps > decision.maxReps ||
        Math.abs(decision.minReps - current.minReps) > 2 || Math.abs(decision.maxReps - current.maxReps) > 2) return "REP_BOUND";
  }
  if (decision.targetRir !== null) {
    if (decision.targetRir < 0 || decision.targetRir > 4 || current.targetRir === null ||
        Math.abs(decision.targetRir - current.targetRir) > 1 ||
        !Number.isInteger(decision.targetRir * 2)) return "RIR_BOUND";
    if (!clearlyTooEasy && decision.targetRir < current.targetRir) return "NO_EFFORT_INCREASE";
  }
  if (decision.suggestedLoad === null && decision.minReps === null && decision.maxReps === null && decision.targetRir === null) return "EMPTY_ADJUSTMENT";
  return null;
}
