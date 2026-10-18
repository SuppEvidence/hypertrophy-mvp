import type {
  WeeklyCandidate,
  WeeklyCoachPlan,
  WeeklyExercise,
} from "./weekly-coach-policy";

/** Repair position metadata only; never substitute an exercise or change its work. */
export function normalizeWeeklySlotReferences(
  plan: WeeklyCoachPlan,
  candidates: WeeklyCandidate[],
  exercises: WeeklyExercise[],
) {
  const known = new Set(candidates.map((row) => row.id));
  const available = new Set(exercises.map((row) => row.id));
  const changes: Array<{
    occurrenceId: string;
    date: string;
    exerciseId: string;
    before: string;
    after: string;
  }> = [];
  const workouts = plan.workouts.map((workout) => ({
    ...workout,
    items: workout.items.map((item) => {
      if (
        known.has(item.sourceSlotId) ||
        item.sourceSlotId === `exercise:${item.exerciseId}` ||
        !available.has(item.exerciseId)
      )
        return item;
      const exact = candidates.filter(
        (row) => row.exerciseId === item.exerciseId,
      );
      const local = exact.filter(
        (row) => row.templateId === workout.templateId,
      );
      // Only reattach a concrete template position when it is unambiguous.
      const matches = local.length ? local : exact;
      const sourceSlotId =
        matches.length === 1 ? matches[0].id : `exercise:${item.exerciseId}`;
      changes.push({
        occurrenceId: workout.id,
        date: workout.date,
        exerciseId: item.exerciseId,
        before: item.sourceSlotId,
        after: sourceSlotId,
      });
      return { ...item, sourceSlotId };
    }),
  }));
  return {
    plan: {
      ...plan,
      workouts,
      ...(plan.manualSetTypeOverrides
        ? {
            manualSetTypeOverrides: plan.manualSetTypeOverrides.map((row) => {
              const change = changes.find(
                (change) =>
                  change.occurrenceId === row.occurrenceId &&
                  change.exerciseId === row.exerciseId &&
                  change.before === row.sourceSlotId,
              );
              return change ? { ...row, sourceSlotId: change.after } : row;
            }),
          }
        : {}),
      ...(plan.exerciseChanges
        ? {
            exerciseChanges: plan.exerciseChanges.map((row) => {
              const change = changes.find(
                (change) =>
                  change.date === row.date &&
                  change.exerciseId === row.toExerciseId &&
                  change.before === row.sourceSlotId,
              );
              return change ? { ...row, sourceSlotId: change.after } : row;
            }),
          }
        : {}),
    },
    repairedCount: changes.length,
  };
}

/** Keep a few concrete problems readable through the planner's redirect. */
export function weeklyValidationMessage(errors: string[]) {
  const unique = [...new Set(errors)];
  return `The proposed week did not pass validation:\n${unique
    .slice(0, 3)
    .map((error) => `• ${error}`)
    .join(
      "\n",
    )}${unique.length > 3 ? `\n${unique.length - 3} more ${unique.length === 4 ? "check also needs" : "checks also need"} attention.` : ""}`;
}
