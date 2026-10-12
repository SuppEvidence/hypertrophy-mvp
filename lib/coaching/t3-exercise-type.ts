/** Secondary recruitment does not tell us how many joints an exercise moves. */
export function t3ExerciseType(patternName: string, slotRole?: string | null): "COMPOUND" | "ISOLATION" | null {
  const name = patternName.toLowerCase().replaceAll("-", " ");
  if (/curl|raise|fly|extension|pushdown|pull.?over|calf|shrug|crunch|abduction|adduction/.test(name)) return "ISOLATION";
  if (/press|row|squat|deadlift|rdl|hinge|lunge|dip|pull.?up|pull.?down/.test(name)) return "COMPOUND";
  if (slotRole === "ISOLATION") return "ISOLATION";
  if (slotRole === "PRIMARY_COMPOUND") return "COMPOUND";
  return null;
}
