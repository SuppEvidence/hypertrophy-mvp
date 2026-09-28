import { z } from "zod";

export const WeeklyCoachItemSchema = z.object({
  sourceSlotId: z.string().min(1).max(160),
  exerciseId: z.string().uuid(),
  sets: z.number().int().min(1).max(8),
  setTypeIds: z.array(z.string().uuid()).min(1).max(8),
  reason: z.string().min(1).max(240),
});
export const WeeklyCoachWorkoutSchema = z.object({
  id: z.string().uuid(),
  date: z.iso.date(),
  templateId: z.string().uuid(),
  durationMinutes: z.number().int().min(20).max(120),
  rationale: z.string().min(1).max(400),
  items: z.array(WeeklyCoachItemSchema).min(1).max(16),
});
export const WeeklyCoachPlanSchema = z.object({
  version: z.literal("W1"),
  weekStart: z.iso.date(),
  summary: z.string().min(1).max(1800),
  workouts: z.array(WeeklyCoachWorkoutSchema).min(1).max(7),
});
export type WeeklyCoachPlan = z.infer<typeof WeeklyCoachPlanSchema>;
// In subsequent weeks the coach only returns days it wants to change. All other
// accepted and completed training stays in the deterministic carry-forward plan.
export const WeeklyCoachDeltaSchema = z.object({
  version: z.literal("WD1"),
  weekStart: z.iso.date(),
  summary: z.string().min(1).max(1800),
  changes: z.array(z.object({
    date: z.iso.date(),
    templateId: z.string().uuid(),
    rationale: z.string().min(1).max(400),
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

// The model can propose a set type that was valid for the source slot but not
// for its chosen exercise. Replace only that set type; keep the exercise and
// physical workload visible in the proposal for the athlete to review.
export function normalizeWeeklySetTypes(plan: WeeklyCoachPlan, input: {
  candidates: WeeklyCandidate[];
  regularSetTypeIds: string[];
  introducibleSetTypeIdsByExercise: Record<string, string[]>;
  multipliers: Record<string, number>;
}): WeeklyCoachPlan {
  const candidates = new Map(input.candidates.map((row) => [row.id, row]));
  const regular = new Set(input.regularSetTypeIds.filter((id) =>
    Number.isFinite(input.multipliers[id]) && input.multipliers[id] > 0));
  const valid = (id: string) => Number.isFinite(input.multipliers[id]) && input.multipliers[id] > 0;
  const defaultType = input.regularSetTypeIds.find((id) => regular.has(id));
  if (!defaultType) return plan;
  return { ...plan, workouts: plan.workouts.map((day) => {
    let introduced = 0;
    return { ...day, items: day.items.map((item) => {
      const source = candidates.get(item.sourceSlotId);
      let changed = false;
      const setTypeIds = item.setTypeIds.map((id, index) => {
        const retained = source?.exerciseId === item.exerciseId && source.setTypeIds[index] === id;
        if (valid(id) && (regular.has(id) || retained)) return id;
        if (valid(id) && introduced < 1 && input.introducibleSetTypeIdsByExercise[item.exerciseId]?.includes(id)) {
          introduced += 1;
          return id;
        }
        changed = true;
        const sourceType = source?.exerciseId === item.exerciseId ? source.setTypeIds[index] : null;
        return sourceType && regular.has(sourceType) ? sourceType : defaultType;
      });
      return changed ? { ...item, setTypeIds,
        reason: `${item.reason.slice(0, 158)} Incompatible set types changed to regular sets.`.slice(0, 240) }
        : item;
    }) };
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
    let newIntensifiers = 0;
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
      for (const [index, typeId] of item.setTypeIds.entries()) {
        const retainingExisting = source && source.exerciseId === item.exerciseId && source.setTypeIds[index] === typeId;
        if (!input.regularSetTypeIds.includes(typeId) && !retainingExisting) {
          if (input.introducibleSetTypeIdsByExercise?.[item.exerciseId]?.includes(typeId)) newIntensifiers += 1;
          else errors.push(`${workout.date}: set type ${typeId} is unsuitable for this exercise or its coaching preferences.`);
        }
        if (!Number.isFinite(input.multipliers[typeId]) || input.multipliers[typeId] <= 0) errors.push("Unknown set type.");
      }
      totalSets += item.sets;
      const effective = item.setTypeIds.reduce((sum, id) => sum + (input.multipliers[id] ?? 0), 0);
      if (exercise) {
        for (const id of exercise.primaryMuscleIds) sessionMuscles.set(id, (sessionMuscles.get(id) ?? 0) + effective);
        for (const row of exercise.secondaryMuscles) sessionMuscles.set(row.muscleId, (sessionMuscles.get(row.muscleId) ?? 0) + effective * row.fraction);
      }
    }
    if (newIntensifiers > 1) errors.push(`${workout.date}: at most one new intensifier may be planned per workout.`);
    for (const [muscleId, effective] of sessionMuscles) {
      weeklyMuscles.set(muscleId, (weeklyMuscles.get(muscleId) ?? 0) + effective);
      peakMuscles.set(muscleId, Math.max(peakMuscles.get(muscleId) ?? 0, effective));
    }
    if (totalSets > 36 || totalSets * 1.5 + workout.items.length > workout.durationMinutes * 1.2) errors.push("Workout exceeds plausible session capacity.");
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
