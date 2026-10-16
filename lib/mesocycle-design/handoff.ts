import { briefSchema, designSchema } from "./schema";
/** Read-only compact handoff. Does not create drafts, fetch photos or call AI. */
export function approvedDesignContext(value: unknown, exerciseId?: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const p = designSchema.safeParse(row.plan),
    b = briefSchema.safeParse(row.brief);
  if (!p.success || !b.success) return null;
  const plan = p.data,
    brief = b.data;
  const base = {
    plannedEnergyPhase: brief.energyPhase,
    goals: brief.goals,
    restrictions: brief.restrictions,
    progression: plan.progression,
    exerciseIntent: exerciseId
      ? plan.sessions.flatMap((s) =>
          s.items
            .filter((i) => i.exerciseId === exerciseId)
            .map((i) => ({ purpose: i.purpose, rationale: i.rationale })),
        )
      : undefined,
  };
  if (exerciseId) return base; // Keep T1 tokens bounded to relevant intent.
  return {
    ...base,
    userEdited: row.userEdited === true,
    rationaleCaution:
      row.userEdited === true
        ? "Manually edited after the last coach response; saved rationale may refer to earlier choices. Use actual prescriptions and accepted intent."
        : null,
    approvedAt: row.approvedAt,
    evidenceGeneratedAt: row.evidenceGeneratedAt,
    plannedStart: brief.startDate,
    plannedLengthWeeks: plan.lengthWeeks,
    reviewAfterWeeks: plan.reviewAfterWeeks,
    daysPerWeek: brief.daysPerWeek,
    minutesPerSession: brief.minutesPerSession,
    availableWeekdays: brief.availableWeekdays,
    excludedExerciseIds: brief.excludedExerciseIds,
    baselinePriorities: plan.priorities,
    spacing: plan.spacing,
    structureReason: plan.structureReason,
    durationReason: plan.durationReason,
    successCriteria: plan.successCriteria,
    adjustmentCriteria: plan.adjustmentCriteria,
    baselineSchedule: plan.sessions.map((s) => ({
      name: s.name,
      weekday: s.weekday,
      rationale: s.rationale,
      exercises: s.items.map((i) => ({
        exerciseId: i.exerciseId,
        purpose: i.purpose,
        locked: i.locked,
      })),
    })),
    unresolvedCoverage: plan.libraryGaps,
    limitations: plan.limitations,
    authority:
      "Current saved priorities and prescriptions override baseline dose. Preserve accepted intent; temporary changes do not rewrite the base program.",
  };
}

export function designExcludedExerciseIds(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const brief = briefSchema.safeParse((value as Record<string, unknown>).brief);
  return brief.success ? brief.data.excludedExerciseIds : [];
}
