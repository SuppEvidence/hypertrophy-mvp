import { z } from "zod";

export const MesocycleConfidenceSchema = z.enum(["LOW", "MODERATE", "HIGH"]);
export const MesocycleHistoryModeSchema = z.enum([
  "FIRST_MESOCYCLE",
  "LIMITED_HISTORY",
  "ESTABLISHED_HISTORY",
]);

export const MesocyclePriorityRecommendationSchema = z.object({
  muscleName: z.string(),
  action: z.enum(["PROMOTE", "KEEP", "DEMOTE"]),
  currentPriority: z.enum(["SPECIALIZE", "GROW", "MAINTAIN", "INDIRECT_ONLY"]),
  suggestedPriority: z.enum(["SPECIALIZE", "GROW", "MAINTAIN", "INDIRECT_ONLY"]),
  rationale: z.string(),
});

export const MesocycleMovementRecommendationSchema = z.object({
  movementPatternName: z.string(),
  action: z.enum(["KEEP", "SHIFT_EMPHASIS", "REVIEW_EXERCISE"]),
  rationale: z.string(),
});

export const MesocycleSymptomPrecautionSchema = z.object({
  location: z.string(),
  side: z.string().nullable(),
  affectedExercises: z.array(z.string()).max(8),
  affectedMovementPatterns: z.array(z.string()).max(8),
  signalStrength: z.enum(["ISOLATED", "REPEATED", "PERSISTENT"]),
  recommendation: z.string(),
  clinicalReviewSuggested: z.boolean(),
});

export const MesocycleRecommendationSchema = z.object({
  summary: z.string(),
  confidence: MesocycleConfidenceSchema,
  historyMode: MesocycleHistoryModeSchema,
  currentBlockAssessment: z.string(),
  bodyMetricInterpretation: z.string(),
  nextPriorities: z.array(MesocyclePriorityRecommendationSchema).max(10),
  movementRecommendations: z.array(MesocycleMovementRecommendationSchema).max(10),
  symptomPrecautions: z.array(MesocycleSymptomPrecautionSchema).max(6),
  templateImplications: z.array(z.string()).max(10),
  cautionNotes: z.array(z.string()).max(6),
});

export type MesocycleRecommendation = z.infer<typeof MesocycleRecommendationSchema>;
