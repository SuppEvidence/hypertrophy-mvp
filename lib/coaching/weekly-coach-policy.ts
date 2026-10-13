import { z } from "zod";

export const WeeklyCoachItemSchema = z.object({
  sourceSlotId: z.string().min(1).max(160),
  exerciseId: z.string().uuid(),
  sets: z.number().int().min(1).max(8),
  setTypeIds: z.array(z.string().uuid()).min(1).max(8),
  reason: z.string().max(240),
});
export const WeeklyCoachWorkoutSchema = z.object({
  id: z.string().uuid(),
  date: z.iso.date(),
  templateId: z.string().uuid(),
  durationMinutes: z.number().int().min(20).max(120),
  rationale: z.string().max(400),
  estimatedMinutes: z.number().min(1).max(240).nullable().optional(),
  items: z.array(WeeklyCoachItemSchema).min(1).max(16),
});
export const WeeklyDoseReviewSchema = z.object({ muscleId: z.string(), reason: z.string().max(400) });
export const WeeklyExerciseChangeSchema = z.object({
  date: z.iso.date(), sourceSlotId: z.string().max(160), fromExerciseId: z.string().uuid(), toExerciseId: z.string().uuid(),
  basis: z.enum(["PAIN_OR_TOLERANCE", "EQUIPMENT_OR_AVAILABILITY", "USER_REQUEST", "STIMULUS_LIMITATION", "PRIORITY_REALLOCATION"]),
  reason: z.string().min(1).max(300),
});
export const WeeklyCoachPlanSchema = z.object({
  version: z.literal("W1"),
  weekStart: z.iso.date(),
  summary: z.string().max(1800),
  doseReviews: z.array(WeeklyDoseReviewSchema).max(30).optional(),
  exerciseChanges: z.array(WeeklyExerciseChangeSchema).max(40).optional(),
  userEdited: z.boolean().optional(),
  // Written by the manual editor only; never part of AI output schemas.
  manualSetTypeOverrides: z.array(z.object({
    occurrenceId: z.string().uuid(), sourceSlotId: z.string(), exerciseId: z.string().uuid(),
    setTypeIds: z.array(z.string().uuid()).max(8),
  })).max(112).optional(),
  // Application-owned display metadata; excluded from model response schemas.
  lineage: z.object({
    source: z.enum(["TEMPLATES", "CARRY_FORWARD"]),
    sourceWeek: z.iso.date().nullable(),
    changedWorkoutDates: z.array(z.iso.date()).max(7),
  }).optional(),
  workouts: z.array(WeeklyCoachWorkoutSchema).min(1).max(7),
});
export type WeeklyCoachPlan = z.infer<typeof WeeklyCoachPlanSchema>;
// In subsequent weeks the coach only returns days it wants to change. All other
// accepted and completed training stays in the deterministic carry-forward plan.
export const WeeklyCoachDeltaSchema = z.object({
  version: z.literal("WD1"),
  weekStart: z.iso.date(),
  summary: z.string().max(1800),
  doseReviews: z.array(WeeklyDoseReviewSchema).max(30).optional(),
  exerciseChanges: z.array(WeeklyExerciseChangeSchema).max(40).optional(),
  changes: z.array(z.object({
    date: z.iso.date(),
    templateId: z.string().uuid(),
    rationale: z.string().max(400),
    estimatedMinutes: z.number().min(1).max(240).nullable().optional(),
    items: z.array(WeeklyCoachItemSchema).min(1).max(16),
  })).max(7),
});
export type WeeklyCoachDelta = z.infer<typeof WeeklyCoachDeltaSchema>;
export type WeeklyCandidate = { id: string; templateId: string; movementGroupId: string; exerciseId: string; name?: string; movementGroupName?: string; sets: number; setTypeIds: string[]; primaryMuscleIds: string[]; secondaryMuscles: Array<{ muscleId: string; fraction: number }> };
export type WeeklyExercise = { id: string; name?: string; movementGroupId: string; primaryMuscleIds: string[]; secondaryMuscles: Array<{ muscleId: string; fraction: number }>; avoided: boolean };

// Preserve the proposed physical work when a model repeats an exercise in two slots.
// Over-eight-set duplicates remain invalid so a large or ambiguous plan is reviewed again.
export function consolidateWeeklyExercises(plan: WeeklyCoachPlan): WeeklyCoachPlan {
  return { ...plan, workouts: plan.workouts.map((day) => {
    const items: WeeklyCoachPlan["workouts"][number]["items"] = [];
    for (const item of day.items) {
      const existing = items.find((row) => row.exerciseId === item.exerciseId);
      if (!existing || existing.sets + item.sets > 8) {
        items.push({ ...item, setTypeIds: [...item.setTypeIds] });
        continue;
      }
      existing.sets += item.sets;
      existing.setTypeIds.push(...item.setTypeIds);
      existing.reason = `${existing.reason.slice(0, 202)} Combined repeated slots.`;
    }
    return { ...day, items };
  }) };
}

export function weeklyExerciseIssues(plan: WeeklyCoachPlan, exercises: WeeklyExercise[]) {
  const byId = new Map(exercises.map((row) => [row.id, row]));
  return plan.workouts.flatMap((day) => day.items.flatMap((item) => {
    const exercise = byId.get(item.exerciseId);
    return !exercise || exercise.avoided ? [{ date: day.date, occurrenceId: day.id, sourceSlotId: item.sourceSlotId,
      exerciseId: item.exerciseId, name: exercise?.name ?? null, kind: exercise ? "AVOID" as const : "UNAVAILABLE" as const }] : [];
  }));
}

export function validateWeeklyCoachPlan(plan: WeeklyCoachPlan, input: {
  weekStart: string;
  availability: Array<{ date: string; minutes: number; id?: string }>;
  templateIds: string[];
  candidates: WeeklyCandidate[];
  exercises: WeeklyExercise[];
  regularSetTypeIds: string[];
  manualSetTypeOverrides?: WeeklyCoachPlan["manualSetTypeOverrides"];
  introducibleSetTypeIdsByExercise?: Record<string, string[]>;
  multipliers: Record<string, number>;
  priorities?: Record<string, string>;
  completedMuscles?: Array<Record<string, number>>;
  excludedDates?: string[];
  allowAvoidedExerciseIds?: string[];
  allowUnavailableDraft?: boolean;
}) {
  const errors: string[] = [];
  if (plan.weekStart !== input.weekStart) errors.push("Wrong planning week.");
  const slots = new Map(input.candidates.map((row) => [row.id, row]));
  const exercises = new Map(input.exercises.map((row) => [row.id, row]));
  const dates = new Map(input.availability.map((row) => [row.date, row.minutes]));
  const seen = new Set<string>();
  const weeklyMuscles = new Map<string, number>();
  const peakMuscles = new Map<string, number>();
  const completedTotals = new Map<string, number>();
  for (const day of input.completedMuscles ?? []) for (const [id, sets] of Object.entries(day)) {
    weeklyMuscles.set(id, (weeklyMuscles.get(id) ?? 0) + sets);
    completedTotals.set(id, (completedTotals.get(id) ?? 0) + sets);
  }
  if (plan.workouts.length !== input.availability.length) errors.push("Every available day needs exactly one workout.");
  for (const workout of plan.workouts) {
    if (!dates.has(workout.date) || seen.has(workout.date) || input.excludedDates?.includes(workout.date)) errors.push("Workout date is unavailable, completed, or repeated.");
    seen.add(workout.date);
    const expectedId = input.availability.find((day) => day.date === workout.date)?.id;
    if (expectedId && expectedId !== workout.id) errors.push("Unexpected workout occurrence ID.");
    if (!input.templateIds.includes(workout.templateId)) errors.push("Unknown template framework.");
    if (workout.durationMinutes !== dates.get(workout.date)) errors.push("Session time differs from availability.");
    let totalSets = 0;
    const seenSlots = new Set<string>();
    const seenExercises = new Set<string>();
    const sessionMuscles = new Map<string, number>();
    for (const item of workout.items) {
      const source = slots.get(item.sourceSlotId);
      const virtual = item.sourceSlotId === `exercise:${item.exerciseId}`;
      const exercise = exercises.get(item.exerciseId);
      if (!source && !virtual) errors.push("Unknown workout slot.");
      if (seenSlots.has(item.sourceSlotId)) errors.push("Duplicate workout slot.");
      seenSlots.add(item.sourceSlotId);
      if (seenExercises.has(item.exerciseId)) errors.push(`${workout.date}: ${exercise?.name ?? item.exerciseId} appears in more than one slot. Use one exercise slot per workout.`);
      seenExercises.add(item.exerciseId);
      if (!exercise && !input.allowUnavailableDraft) errors.push(`${workout.date}: exercise ${item.exerciseId} is unavailable; choose an active exercise before approval.`);
      else if (exercise?.avoided && !input.allowAvoidedExerciseIds?.includes(item.exerciseId)) errors.push(`${workout.date}: ${exercise.name ?? item.exerciseId} is marked Avoid.`);
      else if (exercise && source && source.movementGroupId !== exercise.movementGroupId && source.exerciseId !== item.exerciseId) {
        errors.push(`${workout.date}: ${exercise.name ?? item.exerciseId} does not match the movement of slot ${source.name ?? source.id}; use a compatible slot or exercise:${item.exerciseId}.`);
      }
      if (item.setTypeIds.length !== item.sets) errors.push("Every physical set must have a set type.");
      for (const typeId of item.setTypeIds) {
        if (!Number.isFinite(input.multipliers[typeId]) || input.multipliers[typeId] <= 0) errors.push("Unknown set type.");
      }
      totalSets += item.sets;
      const effective = item.setTypeIds.reduce((sum, id) => sum + (input.multipliers[id] ?? 0), 0);
      if (exercise) {
        for (const id of exercise.primaryMuscleIds) sessionMuscles.set(id, (sessionMuscles.get(id) ?? 0) + effective);
        for (const row of exercise.secondaryMuscles) sessionMuscles.set(row.muscleId, (sessionMuscles.get(row.muscleId) ?? 0) + effective * row.fraction);
      }
    }
    for (const [muscleId, effective] of sessionMuscles) {
      weeklyMuscles.set(muscleId, (weeklyMuscles.get(muscleId) ?? 0) + effective);
      peakMuscles.set(muscleId, Math.max(peakMuscles.get(muscleId) ?? 0, effective));
    }
    if (totalSets > 36) errors.push("Workout exceeds the physical-set sanity ceiling.");
  }
  if ([...weeklyMuscles.values()].some((sets) => sets > 60)) errors.push("Weekly muscle dose exceeds the application sanity ceiling.");
  if (plan.workouts.length + (input.completedMuscles?.length ?? 0) > 1) for (const [muscleId, weekly] of weeklyMuscles) {
    const proposed = weekly - (completedTotals.get(muscleId) ?? 0);
    if (input.priorities?.[muscleId] === "MAINTAIN" && proposed >= 6 &&
      (peakMuscles.get(muscleId) ?? 0) > Math.max(6, proposed * .75)) {
      errors.push("Maintenance muscle work is too concentrated in one workout.");
    }
  }
  return { ok: errors.length === 0, errors };
}
