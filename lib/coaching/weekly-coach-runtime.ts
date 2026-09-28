import { WeeklyCoachPlanSchema, type WeeklyCoachPlan } from "@/lib/coaching/weekly-coach-policy";

export function parseWeeklyCoachPlan(value: unknown): WeeklyCoachPlan | null {
  const parsed = WeeklyCoachPlanSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function weeklyOccurrenceFromSummary(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = (value as Record<string, unknown>).weeklyOccurrenceId;
  return typeof id === "string" ? id : null;
}

export function parseMissedOccurrenceIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

// Redistribute only still-planned work, inside the same movement pattern and
// only into sessions that have not started. No AI call or template mutation.
export function reallocateMissedWeeklyWork(plan: WeeklyCoachPlan, missedIds: string[], startedIds: string[], movementByExercise: Map<string, string>, regularSetTypeIds: Set<string>, excludedIds: string[] = []) {
  const missed = new Set(missedIds);
  const excluded = new Set(excludedIds);
  const started = new Set(startedIds);
  const workouts = plan.workouts.map((day) => ({ ...day, items: day.items.map((item) => ({ ...item, setTypeIds: [...item.setTypeIds] })) }));
  const recipients = workouts.filter((day) => !missed.has(day.id) && !excluded.has(day.id) && !started.has(day.id));
  const missing = workouts.filter((day) => missed.has(day.id));
  let unallocatedSets = 0;
  for (const day of missing) for (const item of day.items) {
    let remaining = item.sets;
    const movement = movementByExercise.get(item.exerciseId);
    for (const typeId of item.setTypeIds) {
      if (!movement) break;
      const ranked = [...recipients].sort((left, right) => {
        const count = (day: typeof left) => day.items.filter((row) => movementByExercise.get(row.exerciseId) === movement).reduce((sum, row) => sum + row.sets, 0);
        return count(left) - count(right) || left.date.localeCompare(right.date);
      });
      for (const targetDay of ranked) {
        const total = targetDay.items.reduce((sum, row) => sum + row.sets, 0);
        if (total >= 36) continue;
        let target = targetDay.items.find((row) => movementByExercise.get(row.exerciseId) === movement && row.sets < 8 &&
          (regularSetTypeIds.has(typeId) || row.exerciseId === item.exerciseId));
        if (!target && targetDay.items.length < 16 && !targetDay.items.some((row) => row.exerciseId === item.exerciseId)) {
          // A compatible movement may be missing entirely from the remaining sessions.
          // Carry its exercise into one of them without editing the underlying template.
          target = { ...item, sourceSlotId: `exercise:${item.exerciseId}`, sets: 0, setTypeIds: [], reason: `Redistributed from missed ${day.date}: ${item.reason}` };
          targetDay.items.push(target);
        }
        if (!target) continue;
        const timeNeeded = total * 1.5 + targetDay.items.length + 1.5;
        if (timeNeeded > targetDay.durationMinutes * 1.2) {
          if (target.sets === 0) targetDay.items.pop();
          continue;
        }
        target.sets += 1;
        target.setTypeIds.push(typeId);
        remaining -= 1;
        break;
      }
    }
    unallocatedSets += remaining;
  }
  return { workouts, unallocatedSets };
}
