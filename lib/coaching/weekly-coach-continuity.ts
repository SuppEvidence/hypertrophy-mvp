import type { WeeklyCandidate, WeeklyCoachDelta, WeeklyCoachPlan, WeeklyExercise } from "@/lib/coaching/weekly-coach-policy";

type ActualWorkout = { occurrenceId: string; items: Array<{ exerciseId: string; sourceSlotId: string | null;
  setTypeIds: string[]; exerciseChoiceIntent?: string | null }> };

export function carryForwardWeek(input: {
  previous: WeeklyCoachPlan;
  weekStart: string;
  availability: Array<{ id: string; date: string; minutes: number }>;
  templates: string[];
  candidates: WeeklyCandidate[];
  exercises: WeeklyExercise[];
  regularSetTypeIds: string[];
  introducibleSetTypeIdsByExercise?: Record<string, string[]>;
  actual: ActualWorkout[];
  missedIds: string[];
}): WeeklyCoachPlan | null {
  const { previous, availability, templates, candidates, exercises, regularSetTypeIds, actual } = input;
  const allowed = new Map(exercises.filter((row) => !row.avoided).map((row) => [row.id, row]));
  const candidatesById = new Map(candidates.map((row) => [row.id, row]));
  const completed = new Map(actual.map((row) => [row.occurrenceId, row]));
  const regular = new Set(regularSetTypeIds);
  const baseType = regularSetTypeIds[0];
  if (!baseType || !actual.length) return null;
  const sources = previous.workouts.filter((day) => !input.missedIds.includes(day.id));
  if (!sources.some((day) => completed.has(day.id))) return null;
  const workouts = availability.map((day, index) => {
    const weekday = new Date(`${day.date}T12:00:00Z`).getUTCDay();
    const matching = sources.find((row) => new Date(`${row.date}T12:00:00Z`).getUTCDay() === weekday);
    const prior = matching ?? sources[index % sources.length];
    const performed = completed.get(prior.id);
    const templateId = templates.includes(prior.templateId) ? prior.templateId : templates[index % templates.length];
    const chosen = performed?.items.length ? performed.items.flatMap((item, itemIndex) => {
      if (item.exerciseChoiceIntent !== "TEMPORARY") return [item];
      const planned = item.sourceSlotId
        ? prior.items.find((row) => row.sourceSlotId === item.sourceSlotId)
        : prior.items[itemIndex];
      // An extra exercise with no matching planned slot was used only for that day.
      if (!planned) return [];
      if (item.exerciseId === planned.exerciseId) return [item];
      return [{ exerciseId: planned.exerciseId, sourceSlotId: planned.sourceSlotId,
        setTypeIds: Array.from({ length: item.setTypeIds.length }, (_, setIndex) =>
          planned.setTypeIds[setIndex] ?? baseType), revertedTemporary: true }];
    }) : prior.items.map((item) => ({
      exerciseId: item.exerciseId, sourceSlotId: item.sourceSlotId, setTypeIds: item.setTypeIds,
    }));
    // Older accepted plans or completed sessions can contain repeated exercises.
    // Fold their work into one slot before asking the model to adjust the week.
    const unique = new Map<string, (typeof chosen)[number]>();
    for (const item of chosen) {
      const earlier = unique.get(item.exerciseId);
      if (earlier) earlier.setTypeIds.push(...item.setTypeIds);
      else unique.set(item.exerciseId, { ...item, setTypeIds: [...item.setTypeIds] });
    }
    const used = new Set<string>();
    const items = [...unique.values()].flatMap((item) => {
      const exercise = allowed.get(item.exerciseId);
      if (!exercise || !item.setTypeIds.length) return [];
      const preferred = item.sourceSlotId ? candidatesById.get(item.sourceSlotId) : null;
      const source = [preferred, ...candidates.filter((row) => row.templateId === templateId), ...candidates]
        .find((row) => row && !used.has(row.id) &&
          (row.movementGroupId === exercise.movementGroupId || row.exerciseId === exercise.id));
      const slotId = source?.id ?? `exercise:${exercise.id}`;
      if (used.has(slotId)) return [];
      used.add(slotId);
      const types = item.setTypeIds.slice(0, 8).map((id, setIndex) => {
        if (regular.has(id) || (source?.exerciseId === exercise.id && source.setTypeIds[setIndex] === id)) return id;
        if (input.introducibleSetTypeIdsByExercise?.[exercise.id]?.includes(id)) {
          return id;
        }
        return baseType;
      });
      return [{ sourceSlotId: slotId, exerciseId: exercise.id, sets: types.length, setTypeIds: types,
        reason: "revertedTemporary" in item && item.revertedTemporary ? "Previous exercise restored after a one-day swap."
          : performed?.items.length ? "Continued from completed training last week." : "Continued from last week's accepted plan." }];
    }).slice(0, 16);
    while (items.length) {
      const total = items.reduce((sum, item) => sum + item.sets, 0);
      if (total <= 36 && total * 1.5 + items.length <= day.minutes * 1.2) break;
      const last = items[items.length - 1];
      last.sets -= 1;
      last.setTypeIds.pop();
      if (!last.sets) items.pop();
    }
    return { id: day.id, date: day.date, templateId, durationMinutes: day.minutes,
      rationale: "Starting structure from last week's accepted and completed training; coach adjusts where useful.", items };
  });
  if (workouts.some((day) => !day.items.length)) return null;
  return { version: "W1", weekStart: input.weekStart, summary: "Based on last week's accepted and completed training.", workouts };
}

export function applyWeeklyCoachDelta(base: WeeklyCoachPlan, delta: WeeklyCoachDelta): WeeklyCoachPlan | null {
  if (delta.weekStart !== base.weekStart) return null;
  const days = new Map(base.workouts.map((day) => [day.date, day]));
  if (new Set(delta.changes.map((change) => change.date)).size !== delta.changes.length ||
      delta.changes.some((change) => !days.has(change.date))) return null;
  const changes = new Map(delta.changes.map((change) => [change.date, change]));
  return { ...base, summary: delta.summary, doseReviews: delta.doseReviews, userEdited: false, workouts: base.workouts.map((day) => {
    const change = changes.get(day.date);
    return change ? { ...day, templateId: change.templateId, rationale: change.rationale, items: change.items } : day;
  }) };
}
