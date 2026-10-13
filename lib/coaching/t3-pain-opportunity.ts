import { z } from "zod";
import type { ProgrammingOption, ProgrammingRecommendations } from "../ai/programming-decision-schema";
import type { ToleranceExposure } from "./exposure-tolerance";
import type { T3PlanPreview } from "./t3-prescription-preview";

export const PainOpportunityEvidenceSchema = z.object({
  sourceMuscleIds: z.array(z.string()), affectedMuscleIds: z.array(z.string()),
  toleratedExerciseIds: z.array(z.string()), systemicConcern: z.boolean(),
  approvedSourceMuscleIds: z.array(z.string()).optional(),
});
export type PainOpportunityEvidence = z.infer<typeof PainOpportunityEvidenceSchema>;

/** Pain flags are exercise-exposure evidence, not a diagnosis or injury-site localization. */
export function buildPainOpportunityEvidence(history: ToleranceExposure[], systemicConcern: boolean, now = new Date()): PainOpportunityEvidence {
  const recent = history.filter((row) => +row.session.performedAt <= +now && +row.session.performedAt >= +now - 21 * 86400000 && row.sets.length);
  const affected = new Set<string>(), painDates = new Map<string, Set<string>>();
  const exercises = new Map<string, ToleranceExposure[]>();
  for (const row of recent) {
    const rows = exercises.get(row.exerciseId) ?? []; rows.push(row); exercises.set(row.exerciseId, rows);
    if (!row.painFlag && !row.sets.some((set) => set.painFlag)) continue;
    const muscles = [...row.exercise.primaryMuscles.map((m) => m.muscleId),
      ...row.exercise.secondaryMuscles.filter((m) => Number(m.contributionEstimate) > 0).map((m) => m.muscleId)];
    for (const muscleId of muscles) {
      affected.add(muscleId);
      const dates = painDates.get(muscleId) ?? new Set<string>();
      dates.add(row.session.performedAt.toISOString().slice(0, 10)); painDates.set(muscleId, dates);
    }
  }
  const tolerated = [...exercises].filter(([, rows]) => {
    const dates = new Set(rows.map((row) => row.session.performedAt.toISOString().slice(0, 10)));
    return dates.size >= 2 && rows.every((row) => !row.painFlag && row.sets.every((set) => !set.painFlag &&
      !(set.intensifierDetails && typeof set.intensifierDetails === "object" && !Array.isArray(set.intensifierDetails) &&
        (set.intensifierDetails as Record<string, unknown>).executionCompromised === true)));
  }).map(([id]) => id);
  return { sourceMuscleIds: [...painDates].filter(([, dates]) => dates.size >= 2).map(([id]) => id),
    affectedMuscleIds: [...affected], toleratedExerciseIds: tolerated, systemicConcern, approvedSourceMuscleIds: [] } satisfies PainOpportunityEvidence;
}

export function assertPainOpportunity(option: ProgrammingOption, targetMuscleId: string,
  assessment: ProgrammingRecommendations["assessments"][number], evidence?: PainOpportunityEvidence) {
  if (!option.painOpportunity) return;
  const sources = option.painOpportunity.sourceMuscleIds;
  if (!evidence || evidence.systemicConcern || option.action !== "INCREASE_VOLUME" || option.deltaWeeklySets <= 0 ||
      assessment.priority === "INDIRECT_ONLY" || assessment.confidence === "LOW" ||
      ["RECOVERABILITY_CONCERN", "INSUFFICIENT_EVIDENCE", "NO_DIRECT_FOCUS"].includes(assessment.status) ||
      !assessment.evidence.some((row) => row.trim()) || evidence.affectedMuscleIds.includes(targetMuscleId) ||
      new Set(sources).size !== sources.length || sources.some((id) => id === targetMuscleId || !evidence.sourceMuscleIds.includes(id))) {
    throw new Error("A pain-related opportunity needs repeated localized pain, a supported unaffected recipient and compatible overall recovery.");
  }
}

export function assertPainOpportunityPreview(option: ProgrammingOption, preview: T3PlanPreview, evidence: PainOpportunityEvidence) {
  if (!option.painOpportunity) return;
  if (preview.slots.some((slot) => slot.after > slot.before && (!slot.exerciseId || !evidence.toleratedExerciseIds.includes(slot.exerciseId))) ||
      preview.muscles.some((muscle) => muscle.after > muscle.before + .05 && evidence.affectedMuscleIds.includes(muscle.muscleId))) {
    throw new Error("Opportunity work must use recently tolerated exercises without adding dose to pain-affected muscles.");
  }
}

export type PainApproval = {
  muscleId: string; option: ProgrammingOption | null; preview: T3PlanPreview | null;
  sourceEvidence: PainOpportunityEvidence | null; selectedAt: Date;
};

/** Count implemented physical headroom, never treat muscle effective sets as recovery currency. */
export function assertPainOpportunityApprovedCapacity(option: ProgrammingOption, preview: T3PlanPreview,
  approvals: PainApproval[], currentMuscleDose: Map<string, number>, currentSlotCounts: Map<string, number>) {
  if (!option.painOpportunity) return;
  const sources = option.painOpportunity.sourceMuscleIds.map((id) => {
    const source = [...approvals].sort((a, b) => +b.selectedAt - +a.selectedAt).find((row) => row.muscleId === id &&
      row.option?.action === "DECREASE_VOLUME" && row.sourceEvidence?.sourceMuscleIds.includes(id) &&
      row.preview?.muscles.some((m) => m.muscleId === id && m.after < m.before - .05));
    const effect = source?.preview?.muscles.find((m) => m.muscleId === id);
    if (!source || !effect || !Number.isFinite(currentMuscleDose.get(id)) || currentMuscleDose.get(id)! > effect.after + .1) {
      throw new Error("Approve the supporting pain-related reductions first. They must remain in place before opportunity work can be added.");
    }
    if (source.preview!.slots.filter((slot) => slot.after < slot.before).some((slot) => !slot.templateId || !slot.exerciseId ||
        (currentSlotCounts.get(`${slot.templateId}:${slot.exerciseId}`) ?? 0) > slot.after)) {
      throw new Error("The supporting physical-set reduction was restored. Review current capacity before adding opportunity work.");
    }
    return source;
  });
  // A compound reduction can support several source muscles; count its implementation once.
  const unique = [...new Set(sources)];
  const freed = unique.reduce((sum, row) => sum + Math.max(0, row.preview!.weeklyPhysicalSetsRemoved - row.preview!.weeklyPhysicalSetsAdded), 0);
  const since = Math.min(...unique.map((row) => +row.selectedAt));
  const used = approvals.filter((row) => +row.selectedAt >= since).reduce((sum, row) =>
    sum + Math.max(0, (row.preview?.weeklyPhysicalSetsAdded ?? 0) - (row.preview?.weeklyPhysicalSetsRemoved ?? 0)), 0);
  const needed = Math.max(0, preview.weeklyPhysicalSetsAdded - preview.weeklyPhysicalSetsRemoved);
  if (needed <= .05 || needed + used > freed + .05) throw new Error("This increase exceeds the remaining physical headroom from the approved pain reductions. Review a smaller opportunity.");
}
