import { z } from "zod";

/** Advisory only. Missing/null means no recommendation, including legacy reviews. */
export const PhaseRecommendationSchema = z.object({
  sourcePhaseStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  suggestedPhase: z.literal("MAINTAINING"),
  confidence: z.enum(["MODERATE", "HIGH"]),
  recommendation: z.string().min(1).max(700),
  evidence: z.array(z.string().min(1).max(250)).min(2).max(4),
  affectedMovementPatternIds: z.array(z.string()).min(2).max(8),
  reassessWhen: z.string().min(1).max(350),
});
export type PhaseRecommendation = z.infer<typeof PhaseRecommendationSchema>;
