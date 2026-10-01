import type { CompletedWeekSession } from "@/lib/coaching/weekly-coach-baseline";
import type { WeeklyCoachPlan } from "@/lib/coaching/weekly-coach-policy";

export function approvedWeekDose(input: {
  plan: WeeklyCoachPlan; missedIds: string[]; completedOccurrenceIds: string[]; startedIds: string[];
  completed: CompletedWeekSession[];
  exercises: Array<{ id: string; movementGroupId: string; primaryMuscleIds: string[]; secondaryMuscles: Array<{ muscleId: string; fraction: number }> }>;
  multipliers: Record<string, number>;
}) {
  const exercises = new Map(input.exercises.map((row) => [row.id, row]));
  const completedMuscles: Record<string, number> = {}, completedMovements: Record<string, number> = {};
  const plannedMuscles: Record<string, number> = {}, plannedMovements: Record<string, number> = {};
  for (const session of input.completed) {
    for (const [id, dose] of Object.entries(session.muscles)) completedMuscles[id] = (completedMuscles[id] ?? 0) + dose;
    for (const [id, dose] of Object.entries(session.movements)) completedMovements[id] = (completedMovements[id] ?? 0) + dose;
  }
  let unknownItems = 0;
  const remaining = input.plan.workouts.filter((day) => !input.missedIds.includes(day.id) && !input.completedOccurrenceIds.includes(day.id));
  for (const day of remaining) for (const item of day.items) {
    const exercise = exercises.get(item.exerciseId);
    if (!exercise || item.setTypeIds.some((id) => !Number.isFinite(input.multipliers[id]) || input.multipliers[id] <= 0)) { unknownItems++; continue; }
    const dose = item.setTypeIds.reduce((sum, id) => sum + input.multipliers[id], 0);
    plannedMovements[exercise.movementGroupId] = (plannedMovements[exercise.movementGroupId] ?? 0) + dose;
    for (const id of exercise.primaryMuscleIds) plannedMuscles[id] = (plannedMuscles[id] ?? 0) + dose;
    for (const row of exercise.secondaryMuscles) plannedMuscles[row.muscleId] = (plannedMuscles[row.muscleId] ?? 0) + dose * row.fraction;
  }
  return { weekStart: input.plan.weekStart,
    completed: { sessions: input.completed.length, muscleDose: completedMuscles, movementDose: completedMovements },
    notCompleted: { sessions: remaining.map((day) => ({ date: day.date, status: input.startedIds.includes(day.id) ? "IN_PROGRESS" : "PLANNED" })),
      muscleDose: plannedMuscles, movementDose: plannedMovements, unknownItems },
    interpretation: "Completed dose is logged work. Not-completed dose is an approved estimate, including in-progress sessions; do not count it as performed or add completed occurrences again. Missed work uses the saved redistribution. These are this week's implementation, not permanent template targets.",
  };
}
