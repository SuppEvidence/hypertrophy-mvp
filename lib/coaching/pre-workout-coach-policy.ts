import { calculateFatigueSummary, type FatigueInput } from "@/lib/metrics/fatigue";
import type {
  BodyCompositionTrend,
  GlobalRecoveryContext,
  LocalReadinessInference,
  PreWorkoutCoachModelPlan,
} from "@/lib/ai/pre-workout-coach-schema";

export type BodyMetricTrendInput = {
  loggedAt: Date | string;
  bodyweight: number | null;
  waist: number | null;
};

export type RecoveryMetricInput = FatigueInput & { loggedAt: Date | string };

export type LocalReadinessInput = {
  movementGroupId: string;
  movementGroupName: string;
  hoursSinceLastExposure: number | null;
  effectiveSetsLast48h: number;
  effectiveSetsLast72h: number;
  performanceExposureCount: number;
  downwardExerciseSignals: number;
  recentPainSets: number;
  recentPainExposures?: number;
  recentCompromisedSets: number;
  globalRecoveryStatus: GlobalRecoveryContext["status"];
};

export type PreWorkoutSlotCandidate = {
  id: string;
  templateId: string;
  sortOrder: number;
  movementGroupId: string;
  prescribedSets: number;
  maxSets: number;
  minReps: number | null;
  maxReps: number | null;
  targetRir: number | null;
  defaultExerciseId: string;
  allowedExerciseIds: string[];
  prescribedSetTypeIds: string[];
};

export type CoachSetType = { id: string; name: string; slug: string; multiplier: number; isIntensifier: boolean };
export type CoachExercise = { id: string; movementGroupName: string; primaryMuscleIds: string[]; secondaryMuscleIds: string[] };

// Deliberately narrow: movement names are explicit capabilities, not guesses from an exercise's display name.
// Other movements may retain existing template intensifiers, but the coach cannot introduce one.
const INTRODUCIBLE_INTENSIFIERS: Record<string, string[]> = {
  "lateral raise": ["lengthened-partials", "rest-pause", "drop-set", "myo-reps"],
  "knee extension": ["lengthened-partials", "rest-pause", "drop-set", "myo-reps"],
  "leg curl": ["rest-pause", "drop-set", "myo-reps"],
  "triceps lengthened": ["rest-pause", "drop-set", "myo-reps"],
  "triceps pressdown": ["rest-pause", "drop-set", "myo-reps"],
  "hammer curl": ["rest-pause", "drop-set", "myo-reps"],
  "straight-leg calf raise": ["rest-pause", "drop-set", "myo-reps"],
};

export function canIntroduceSetType(exercise: CoachExercise, type: CoachSetType) {
  return exercise.primaryMuscleIds.length === 1 && exercise.secondaryMuscleIds.length === 0 &&
    Boolean(INTRODUCIBLE_INTENSIFIERS[exercise.movementGroupName.toLowerCase()]?.includes(type.slug));
}

export function preWorkoutVolume(plan: Pick<PreWorkoutCoachModelPlan, "baseTemplateId" | "items">, slots: PreWorkoutSlotCandidate[], setTypes: CoachSetType[]) {
  const byId = new Map(setTypes.map((type) => [type.id, type]));
  const bySlot = new Map(slots.map((slot) => [slot.id, slot]));
  const baseline = slots.filter((slot) => slot.templateId === plan.baseTemplateId).flatMap((slot) => slot.prescribedSetTypeIds);
  const proposed = plan.items.flatMap((item) => item.setTypeIds);
  const totals = (ids: string[]) => ({ physical: ids.length, effective: round(ids.reduce((sum, id) => sum + (byId.get(id)?.multiplier ?? 0), 0), 2), intensifiers: ids.filter((id) => byId.get(id)?.isIntensifier).length });
  return { baseline: totals(baseline), proposed: totals(proposed), bySlot };
}

function finite(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0 ? (ordered[middle - 1] + ordered[middle]) / 2 : ordered[middle];
}

function directionalAgreement(values: number[], direction: "DOWN" | "UP") {
  if (values.length < 2) return 0;
  let matching = 0;
  for (let index = 1; index < values.length; index += 1) {
    const delta = values[index] - values[index - 1];
    if ((direction === "DOWN" && delta <= 0) || (direction === "UP" && delta >= 0)) matching += 1;
  }
  return matching / (values.length - 1);
}

export function inferBodyCompositionTrend(rows: BodyMetricTrendInput[]): BodyCompositionTrend {
  const paired = rows
    .map((row) => ({ date: new Date(row.loggedAt), bodyweight: finite(row.bodyweight), waist: finite(row.waist) }))
    .filter((row): row is { date: Date; bodyweight: number; waist: number } =>
      !Number.isNaN(row.date.getTime()) && row.bodyweight !== null && row.bodyweight > 0 && row.waist !== null && row.waist > 0,
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const spanDays = paired.length >= 2
    ? Math.max(0, (paired[paired.length - 1].date.getTime() - paired[0].date.getTime()) / 86_400_000)
    : 0;
  if (paired.length < 4 || spanDays < 10) {
    return {
      status: "INSUFFICIENT_DATA", confidence: "LOW", observationCount: paired.length, spanDays: round(spanDays),
      bodyweightChangePct: null, bodyweightWeeklyChangePct: null, waistChange: null, waistWeeklyChange: null,
      interpretation: "Too few paired bodyweight and waist observations to infer a body-composition phase.",
    };
  }

  const groupSize = Math.max(2, Math.ceil(paired.length / 3));
  const early = paired.slice(0, groupSize);
  const recent = paired.slice(-groupSize);
  const earlyWeight = median(early.map((row) => row.bodyweight))!;
  const recentWeight = median(recent.map((row) => row.bodyweight))!;
  const earlyWaist = median(early.map((row) => row.waist))!;
  const recentWaist = median(recent.map((row) => row.waist))!;
  const weightChangePct = ((recentWeight - earlyWeight) / earlyWeight) * 100;
  const weeklyWeightPct = weightChangePct / (spanDays / 7);
  const waistChange = recentWaist - earlyWaist;
  const weeklyWaist = waistChange / (spanDays / 7);
  const weights = paired.map((row) => row.bodyweight);
  const waists = paired.map((row) => row.waist);
  const lossAgreement = Math.min(directionalAgreement(weights, "DOWN"), directionalAgreement(waists, "DOWN"));
  const gainAgreement = Math.min(directionalAgreement(weights, "UP"), directionalAgreement(waists, "UP"));

  let status: BodyCompositionTrend["status"] = "MIXED";
  let interpretation = "Bodyweight and waist do not yet describe one stable phase; do not alter performance expectations from this trend alone.";
  if (weeklyWeightPct <= -0.1 && weeklyWaist <= -0.5 && lossAgreement >= 0.45) {
    status = "FAT_LOSS_LIKELY";
    interpretation = "Bodyweight and waist are both trending down. Maintaining training quality can be a successful outcome; gain-phase strength improvement should not be required.";
  } else if (weeklyWeightPct >= 0.1 && weeklyWaist >= -0.5 && gainAgreement >= 0.45) {
    status = "GAIN_LIKELY";
    interpretation = "Bodyweight is trending up without a falling waist trend. Gradual performance improvement is more plausible, but still not required session to session.";
  } else if (Math.abs(weeklyWeightPct) < 0.15 && Math.abs(weeklyWaist) < 1) {
    status = "MAINTENANCE_LIKELY";
    interpretation = "Bodyweight and waist are broadly stable. Interpret performance against normal variation and training quality rather than forcing weekly progression.";
  }

  const confidence: BodyCompositionTrend["confidence"] = paired.length >= 10 && spanDays >= 35
    ? "HIGH"
    : paired.length >= 6 && spanDays >= 21
      ? "MODERATE"
      : "LOW";
  return {
    status,
    confidence,
    observationCount: paired.length,
    spanDays: round(spanDays),
    bodyweightChangePct: round(weightChangePct, 2),
    bodyweightWeeklyChangePct: round(weeklyWeightPct, 2),
    waistChange: round(waistChange, 1),
    waistWeeklyChange: round(weeklyWaist, 1),
    interpretation,
  };
}

export function summarizeGlobalRecovery(rows: RecoveryMetricInput[], now = new Date()): GlobalRecoveryContext {
  const recent = rows
    .map((row) => ({ ...row, date: new Date(row.loggedAt) }))
    .filter((row) => !Number.isNaN(row.date.getTime()) && row.date <= now && now.getTime() - row.date.getTime() <= 14 * 86_400_000)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5);
  const scored = recent
    .map((row) => calculateFatigueSummary(row).score)
    .filter((score): score is number => score !== null);
  const average = scored.length > 0 ? scored.reduce((sum, score) => sum + score, 0) / scored.length : null;
  if (average === null) {
    return {
      status: "INSUFFICIENT_DATA", confidence: "LOW", observationCount: recent.length,
      latestLoggedAt: recent[0]?.date.toISOString() ?? null, averageFatigueScore: null,
      interpretation: "Recent recovery metrics are insufficient; rely more heavily on localized training evidence and today's constraints.",
    };
  }
  const status: GlobalRecoveryContext["status"] = average < 25
    ? "GOOD"
    : average < 50
      ? "NORMAL"
      : average < 70
        ? "ELEVATED_FATIGUE"
        : "HIGH_FATIGUE";
  const interpretation = status === "GOOD"
    ? "Recent recovery inputs are favorable, but that alone is not a reason to add training."
    : status === "NORMAL"
      ? "Recent recovery inputs are within a normal range."
      : status === "ELEVATED_FATIGUE"
        ? "Recent recovery inputs warrant conservative interpretation and local adjustments where training evidence agrees."
        : "Recent recovery inputs indicate high fatigue; avoid making the session harder and prioritize constraints and local symptom evidence.";
  return {
    status,
    confidence: scored.length >= 4 ? "HIGH" : scored.length >= 2 ? "MODERATE" : "LOW",
    observationCount: recent.length,
    latestLoggedAt: recent[0]?.date.toISOString() ?? null,
    averageFatigueScore: round(average),
    interpretation,
  };
}

export function inferLocalReadiness(input: LocalReadinessInput): LocalReadinessInference {
  const pain = input.recentPainExposures ?? input.recentPainSets;
  const evidence: string[] = [];
  if (input.hoursSinceLastExposure !== null) evidence.push(`${round(input.hoursSinceLastExposure)} h since the latest movement-pattern exposure`);
  if (input.effectiveSetsLast48h > 0) evidence.push(`${round(input.effectiveSetsLast48h)} effective sets in the last 48 h`);
  if (input.downwardExerciseSignals > 0) evidence.push(`${input.downwardExerciseSignals} exercise performance trend${input.downwardExerciseSignals === 1 ? "" : "s"} currently down`);
  if (pain > 0) evidence.push(`${pain} recent pain-flagged ${input.recentPainExposures !== undefined ? "exercise exposures" : "sets"}`);
  if (input.recentCompromisedSets > 0) evidence.push(`${input.recentCompromisedSets} recent execution-compromised set${input.recentCompromisedSets === 1 ? "" : "s"}`);

  const highConcern = pain > 0 || input.recentCompromisedSets >= 2 || input.downwardExerciseSignals >= 2 ||
    (input.hoursSinceLastExposure !== null && input.hoursSinceLastExposure < 24 && input.effectiveSetsLast48h >= 3) ||
    (input.globalRecoveryStatus === "HIGH_FATIGUE" && input.hoursSinceLastExposure !== null && input.hoursSinceLastExposure < 48);
  const recovering = !highConcern && (
    input.recentCompromisedSets === 1 || input.downwardExerciseSignals === 1 ||
    (input.hoursSinceLastExposure !== null && input.hoursSinceLastExposure < 48 && input.effectiveSetsLast72h >= 2) ||
    (input.globalRecoveryStatus === "ELEVATED_FATIGUE" && input.hoursSinceLastExposure !== null && input.hoursSinceLastExposure < 72)
  );
  const enoughEvidence = input.performanceExposureCount >= 3 || input.effectiveSetsLast72h > 0;
  const status: LocalReadinessInference["status"] = highConcern
    ? "CAUTION"
    : recovering
      ? "RECOVERING"
      : enoughEvidence
        ? "READY"
        : "INSUFFICIENT_DATA";
  const confidence: LocalReadinessInference["confidence"] = input.performanceExposureCount >= 8
    ? "HIGH"
    : input.performanceExposureCount >= 3 || input.recentPainSets > 0
      ? "MODERATE"
      : "LOW";
  const interpretation = status === "CAUTION"
    ? "Multiple local signals justify considering a smaller or different exposure; this is not a direct measurement of tissue recovery."
    : status === "RECOVERING"
      ? "Some local evidence favors a conservative session, but it is not strong enough to require removing the movement."
      : status === "READY"
        ? "No meaningful local warning signal is present. This does not by itself justify adding work."
        : "There is not enough movement-specific history to infer local readiness confidently.";
  return {
    movementGroupId: input.movementGroupId,
    movementGroupName: input.movementGroupName,
    status,
    confidence,
    hoursSinceLastExposure: input.hoursSinceLastExposure === null ? null : round(input.hoursSinceLastExposure),
    effectiveSetsLast48h: round(input.effectiveSetsLast48h),
    effectiveSetsLast72h: round(input.effectiveSetsLast72h),
    performanceExposureCount: input.performanceExposureCount,
    evidence: evidence.slice(0, 6),
    interpretation,
  };
}

function sameNullable(a: number | null, b: number | null) {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) < 0.001;
}

function isDefaultPlan(plan: PreWorkoutCoachModelPlan, slots: PreWorkoutSlotCandidate[], requestedTemplateId: string) {
  if (plan.baseTemplateId !== requestedTemplateId) return false;
  const expected = slots.filter((slot) => slot.templateId === requestedTemplateId).sort((a, b) => a.sortOrder - b.sortOrder);
  if (plan.items.length !== expected.length) return false;
  return plan.items.every((item, index) => {
    const slot = expected[index];
    return slot?.id === item.sourceSlotId && slot.defaultExerciseId === item.exerciseId && slot.prescribedSets === item.sets &&
      item.setTypeIds.length === slot.prescribedSetTypeIds.length && item.setTypeIds.every((id, n) => id === slot.prescribedSetTypeIds[n]) &&
      sameNullable(slot.minReps, item.minReps) && sameNullable(slot.maxReps, item.maxReps) && sameNullable(slot.targetRir, item.targetRir);
  });
}

export function validatePreWorkoutPlan(plan: PreWorkoutCoachModelPlan, config: {
  requestedTemplateId: string;
  templateIds: string[];
  slots: PreWorkoutSlotCandidate[];
  localizedReadiness: LocalReadinessInference[];
  setTypes: CoachSetType[];
  exercises: CoachExercise[];
  secondaryContribution: number;
}) {
  const errors: string[] = [];
  const slotById = new Map(config.slots.map((slot) => [slot.id, slot]));
  const localByMovement = new Map(config.localizedReadiness.map((item) => [item.movementGroupId, item]));
  const typeById = new Map(config.setTypes.map((type) => [type.id, type]));
  const exerciseById = new Map(config.exercises.map((exercise) => [exercise.id, exercise]));
  if (!config.templateIds.includes(plan.baseTemplateId)) errors.push("Unknown base template.");
  const seen = new Set<string>();
  let totalSets = 0;
  let importedSlots = 0;
  let newlyIntroducedIntensifiers = 0;
  const movementDose = new Map<string, number>();
  const baselineMovementDose = new Map<string, number>();
  const muscleDose = new Map<string, number>();
  const baselineMuscleDose = new Map<string, number>();
  const addDose = (movement: Map<string, number>, muscles: Map<string, number>, slot: PreWorkoutSlotCandidate, exerciseId: string, dose: number) => {
    movement.set(slot.movementGroupId, (movement.get(slot.movementGroupId) ?? 0) + dose);
    const exercise = exerciseById.get(exerciseId);
    if (exercise) {
      for (const id of exercise.primaryMuscleIds) muscles.set(id, (muscles.get(id) ?? 0) + dose);
      for (const id of exercise.secondaryMuscleIds) muscles.set(id, (muscles.get(id) ?? 0) + dose * config.secondaryContribution);
    }
  };
  for (const slot of config.slots.filter((slot) => slot.templateId === plan.baseTemplateId)) {
    addDose(baselineMovementDose, baselineMuscleDose, slot, slot.defaultExerciseId,
      slot.prescribedSetTypeIds.reduce((sum, id) => sum + (typeById.get(id)?.multiplier ?? 0), 0));
  }
  for (const item of plan.items) {
    const slot = slotById.get(item.sourceSlotId);
    if (!slot) { errors.push(`Unknown source slot ${item.sourceSlotId}.`); continue; }
    if (seen.has(item.sourceSlotId)) errors.push(`Duplicate source slot ${item.sourceSlotId}.`);
    seen.add(item.sourceSlotId);
    if (slot.templateId !== plan.baseTemplateId) importedSlots += 1;
    if (!slot.allowedExerciseIds.includes(item.exerciseId)) errors.push(`Exercise does not match slot ${item.sourceSlotId}.`);
    if (item.sets < 1 || item.sets > slot.maxSets) errors.push(`Set count is outside the allowed range for slot ${item.sourceSlotId}.`);
    if (item.setTypeIds.length !== item.sets) errors.push(`Every physical set needs one set type in slot ${item.sourceSlotId}.`);
    for (const [index, id] of item.setTypeIds.entries()) {
      const type = typeById.get(id);
      const originalId = slot.prescribedSetTypeIds[index];
      if (!type || !Number.isFinite(type.multiplier) || type.multiplier <= 0) {
        errors.push(`Unavailable set type in slot ${item.sourceSlotId}.`); continue;
      }
      if (id === originalId && item.exerciseId === slot.defaultExerciseId) continue;
      // Reverting a prescribed intensifier to a normal set is always a conservative option.
      if (!type.isIntensifier && Math.abs(type.multiplier - 1) < 0.001) continue;
      const exercise = exerciseById.get(item.exerciseId);
      const permitted = exercise && canIntroduceSetType(exercise, type);
      if (!permitted || type.multiplier > 1.35 || slot.targetRir === null || slot.targetRir > 2 ||
          item.targetRir === null || item.targetRir > 2 || (item.minReps ?? 0) < 8 ||
          ["CAUTION", "RECOVERING"].includes(localByMovement.get(slot.movementGroupId)?.status ?? "")) {
        errors.push(`Set type ${type.name} is unsuitable for this exercise or prescription.`);
      }
      if (!typeById.get(originalId ?? "")?.isIntensifier) newlyIntroducedIntensifiers += 1;
    }
    if ((item.minReps === null) !== (item.maxReps === null) || (item.minReps !== null && item.maxReps !== null && item.minReps > item.maxReps)) {
      errors.push(`Invalid rep range for slot ${item.sourceSlotId}.`);
    }
    if (slot.minReps === null || slot.maxReps === null) {
      if (item.minReps !== null || item.maxReps !== null) errors.push(`A missing rep target cannot be invented for slot ${item.sourceSlotId}.`);
    } else if (item.minReps === null || item.maxReps === null || Math.abs(item.minReps - slot.minReps) > 2 || Math.abs(item.maxReps - slot.maxReps) > 2) {
      errors.push(`Rep adjustment is too large for slot ${item.sourceSlotId}.`);
    }
    if (slot.targetRir === null) {
      if (item.targetRir !== null) errors.push(`A missing RIR target cannot be invented for slot ${item.sourceSlotId}.`);
    } else if (item.targetRir === null || Math.abs(item.targetRir - slot.targetRir) > 1) {
      errors.push(`RIR adjustment is too large for slot ${item.sourceSlotId}.`);
    }
    const local = localByMovement.get(slot.movementGroupId);
    const previousEffective = slot.prescribedSetTypeIds.reduce((sum, id) => sum + (typeById.get(id)?.multiplier ?? 0), 0);
    const nextEffective = item.setTypeIds.reduce((sum, id) => sum + (typeById.get(id)?.multiplier ?? 0), 0);
    addDose(movementDose, muscleDose, slot, item.exerciseId, nextEffective);
    if (local?.status === "CAUTION" && nextEffective > previousEffective + 0.001) errors.push(`Locally cautioned movement cannot gain effective volume in slot ${item.sourceSlotId}.`);
    if (local?.status === "CAUTION" && (item.sets > slot.prescribedSets || (slot.targetRir !== null && item.targetRir !== null && item.targetRir < slot.targetRir))) {
      errors.push(`A locally cautioned movement cannot be made harder in slot ${item.sourceSlotId}.`);
    }
    totalSets += item.sets;
  }
  if (importedSlots > 2) errors.push("At most two slots may be imported from outside the base template.");
  const baseTotal = config.slots.filter((slot) => slot.templateId === plan.baseTemplateId).reduce((sum, slot) => sum + slot.prescribedSets, 0);
  if (totalSets > baseTotal) errors.push("Pre-session coaching cannot increase the base template's total physical sets.");
  const dose = preWorkoutVolume(plan, config.slots, config.setTypes);
  if (dose.proposed.effective > dose.baseline.effective + 0.001) errors.push("Pre-session coaching cannot increase the base template's total effective sets.");
  if (newlyIntroducedIntensifiers > 1) errors.push("At most one new intensifier may be proposed for this workout.");
  for (const [id, effective] of movementDose) {
    if (effective > (baselineMovementDose.get(id) ?? 0) + 1.001) errors.push("A movement cannot gain more than one effective set in a pre-workout adjustment.");
    if (localByMovement.get(id)?.status === "CAUTION" && effective > (baselineMovementDose.get(id) ?? 0) + 0.001) errors.push("A locally cautioned movement cannot gain effective volume through imported slots.");
  }
  for (const [id, effective] of muscleDose) {
    if (effective > (baselineMuscleDose.get(id) ?? 0) + 1.001) errors.push("A muscle cannot gain more than one estimated effective set in a pre-workout adjustment.");
  }
  const defaultPlan = isDefaultPlan(plan, config.slots, config.requestedTemplateId);
  if (plan.decision === "KEEP" && !defaultPlan) errors.push("KEEP must preserve the requested template exactly.");
  if (plan.decision === "ADJUST" && defaultPlan) errors.push("ADJUST must contain a material plan change.");
  return { ok: errors.length === 0, errors, isDefaultPlan: defaultPlan };
}
