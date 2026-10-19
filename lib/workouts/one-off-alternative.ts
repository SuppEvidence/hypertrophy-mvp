/** Stored in the existing session-only choice field; never an exercise-library entry. */
export const ONE_OFF_EQUIVALENT = "ONE_OFF_EQUIVALENT";
export function isOneOffAlternative(intent: unknown) {
  return intent === ONE_OFF_EQUIVALENT;
}
export function isTemporaryExerciseChoice(intent: unknown) {
  return intent === "TEMPORARY" || isOneOffAlternative(intent);
}
export const ONE_OFF_COACH_POLICY = `One-off alternatives are session-only equivalent movements, confirmed by the athlete to have similar muscle emphasis. Their completed sets count toward muscle dose using the confirmed source allocation; this is an approximation, not a new exercise assessment. RIR and execution/pain describe effort and tolerance, not measured stimulus. Missing load/reps are intentional: never infer performance loss, progression, load recommendations or source-machine technique from these exposures. Do not remember the alternative as a future exercise preference.`;
