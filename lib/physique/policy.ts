import { NUTRITION_HANDOFF_POLICY } from "@/lib/nutrition/policy";
import { z } from "zod";
export const PHOTO_VIEWS = ["FRONT", "LEFT", "RIGHT", "BACK", "FRONT_FLEXED", "BACK_FLEXED"] as const;
export const photoViewSchema = z.enum(PHOTO_VIEWS);
export const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const d = new Date(`${s}T12:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}, "Choose a valid photo date.");
export const physiqueSettingsSchema = z.object({
  trainingLevel: z.enum(["UNSPECIFIED", "BEGINNER_MID_INTERMEDIATE", "LATE_INTERMEDIATE_ADVANCED"]),
  gainWeeks: z.union([z.literal(8), z.literal(10), z.literal(12)]),
  maintenanceWeeks: z.number().int().min(4).max(12), goal: z.string().trim().max(1200),
});
export type PhysiqueSettings = z.infer<typeof physiqueSettingsSchema>;
export function photoIntervalDays(phase: string | null, settings: PhysiqueSettings): number | null {
  if (phase === "CUTTING") return 14;
  if (phase === "MAINTAINING") return settings.maintenanceWeeks * 7;
  if (phase !== "GAINING" || settings.trainingLevel === "UNSPECIFIED") return null;
  return settings.trainingLevel === "BEGINNER_MID_INTERMEDIATE" ? 28 : settings.gainWeeks * 7;
}
export function suggestComparison<T extends { id: string; takenOn: Date; photos: Array<{ view: string }> }>(current: T, candidates: T[], intervalDays: number | null): T | null {
  const previous = candidates.filter(c => c.takenOn < current.takenOn && c.photos.some(p => current.photos.some(q => q.view === p.view)));
  const target = current.takenOn.getTime() - (intervalDays ?? 70) * 86400000;
  return previous.sort((a, b) => Math.abs(a.takenOn.getTime() - target) - Math.abs(b.takenOn.getTime() - target))[0] ?? null;
}
const confidence = z.enum(["LOW", "MODERATE", "HIGH"]);
export const visualAssessmentSchema = z.object({
  summary: z.string().max(900),
  photoQuality: z.object({ comparable: z.boolean(), confidence, issues: z.array(z.string().max(220)).max(6) }),
  regions: z.array(z.object({ muscleId: z.string().uuid().nullable(), area: z.string().max(100),
    observation: z.string().max(350), interpretation: z.string().max(350), confidence })).max(12),
  changes: z.array(z.string().max(350)).max(6),
  priorities: z.array(z.object({ muscleId: z.string().uuid(), rationale: z.string().max(350), confidence })).max(4),
  phaseConsideration: z.string().max(600),
  practicalNextSteps: z.array(z.string().max(300)).max(4),
  questions: z.array(z.string().max(220)).max(3), limitations: z.array(z.string().max(250)).min(1).max(6),
});
/** Constrain model output to this user's actual catalog, rather than arbitrary UUID-shaped strings. */
export function visualAssessmentSchemaForCatalog(muscleIds: string[], priorityIds = muscleIds) {
  const ids = [...new Set(muscleIds)];
  if (!ids.length) throw new Error("Photo analysis needs a populated muscle catalog before it can suggest priorities.");
  const muscleId = z.enum(ids as [string, ...string[]]);
  if (!priorityIds.length) throw new Error("Photo analysis needs visible planning targets in the muscle catalogue.");
  const priorityId = z.enum([...new Set(priorityIds)] as [string, ...string[]]);
  return visualAssessmentSchema.extend({
    regions: z.array(visualAssessmentSchema.shape.regions.element.extend({ muscleId: muscleId.nullable() })).max(12),
    priorities: z.array(visualAssessmentSchema.shape.priorities.element.extend({ muscleId: priorityId })).max(4),
  });
}

export const visualEnvelopeSchema = z.object({ version: z.literal(1), checkinId: z.string().uuid(), takenOn: daySchema,
  signature: z.string(), comparisonId: z.string().uuid().nullable(), comparisonSignature: z.string().nullable(),
  comparedOn: daySchema.nullable(), assessedAt: z.string().datetime(), acceptedAt: z.string().datetime().nullable(),
  settingsSignature: z.string(), model: z.string(), result: visualAssessmentSchema });
export type VisualEnvelope = z.infer<typeof visualEnvelopeSchema>;
export function readVisualAssessment(value: unknown): VisualEnvelope | null {
  const parsed = visualEnvelopeSchema.safeParse(value); return parsed.success ? parsed.data : null;
}
export const PHYSIQUE_COACHING_POLICY = `${NUTRITION_HANDOFF_POLICY}
PHYSIQUE VISUAL EVIDENCE
- physiqueEvidence contains dated, accepted visual assessments, not measurements of body fat or causal proof of growth. Never estimate body-fat percentages or infer calories/macros from visuals, infer health diagnoses, or infer muscle loss/growth from one appearance or circumference change.
- Interpret photos with same-date linked measurements, photo quality, lighting, pose, pump, time interval and phase. Apparent fullness/definition/separation differ from muscle size. Circumferences are a supporting record of how this individual looked on that date, never a universal body-composition formula.
- Historical assessments describe their photo date, not the upload/analysis date or present state. Do not apply old phase advice as current advice. Unmatched, missing or stale visual evidence is unknown. Do not invent visual findings when no accepted assessment is supplied.
- Visual priorities are proposals, not permission to replace approved mesocycle priorities or change volume automatically. Translate accepted, credible regional priorities through exerciseMechanics and personal tolerance when exercise changes are warranted; current pain/recovery evidence still governs workload. Hold existing plans when photos do not support a meaningful change.
- Assess phase decisions against the user's desired look and sustainability. Do not assume poorer leg separation requires more cutting. Refer proposed dietary adjustments to the nutrition coach. Reuse accepted approximate macro adjustments when supplied; never calculate intake from appearance or require food logging.
- Photo cadence is not a deadline for visible growth or a reason to generate changes. Fat loss defaults to 14 days; beginner/mid-intermediate gaining 28; advanced gaining 56-84. Maintenance uses the user's chosen interval.`;
