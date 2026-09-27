export type ChoiceSession = {
  coached: boolean;
  exercises: Array<{
    templateExerciseId: string | null;
    exerciseId: string;
    exerciseName: string;
    movementGroupId: string;
    active: boolean;
    isSubstitution: boolean;
    intent: string | null;
    note: string | null;
  }>;
};

// Sessions must be newest first. An explicit temporary choice never overwrites
// the last saved choice, and old coached substitutions remain one-session edits.
export function selectRememberedExerciseChoices(sessions: ChoiceSession[]) {
  const choices = new Map<string, { exerciseId: string; exerciseName: string; movementGroupId: string; source: "COACH" | "USER" | "TEMPLATE"; reason: string | null }>();
  for (const session of sessions) {
    for (const row of session.exercises) {
      if (!row.templateExerciseId || !row.active || choices.has(row.templateExerciseId)) continue;
      if (row.intent === "TEMPORARY" || (!row.intent && session.coached && row.isSubstitution)) continue;
      choices.set(row.templateExerciseId, {
        exerciseId: row.exerciseId, exerciseName: row.exerciseName, movementGroupId: row.movementGroupId,
        source: session.coached && row.isSubstitution ? "COACH" : row.isSubstitution ? "USER" : "TEMPLATE",
        reason: row.note,
      });
    }
  }
  return choices;
}
