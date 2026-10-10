import { z } from "zod";

/** Advisory only. Missing/null means no recommendation, including legacy reviews. */
export const PhaseRecommendationSourceSchema = z.enum(["CUTTING", "GAINING"]);

export const PhaseRecommendationSchema = z.object({
  // Advice stored before gaining-phase support was always for CUTTING.
  sourcePhase: PhaseRecommendationSourceSchema.optional(),
  sourcePhaseStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  suggestedPhase: z.literal("MAINTAINING"),
  confidence: z.enum(["MODERATE", "HIGH"]),
  recommendation: z.string().min(1).max(700),
  evidence: z.array(z.string().min(1).max(250)).min(2).max(4),
  affectedMovementPatternIds: z.array(z.string()).min(2).max(8),
  reassessWhen: z.string().min(1).max(350),
});
export type PhaseRecommendation = z.infer<typeof PhaseRecommendationSchema>;

/** Generated advice must identify its source phase; stored legacy advice remains readable. */
export const ModelPhaseRecommendationSchema = PhaseRecommendationSchema.extend({
  sourcePhase: PhaseRecommendationSourceSchema,
});
