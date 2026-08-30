import { z } from "zod";

export const ProgrammingConfidenceSchema = z.enum([
  "LOW",
  "MODERATE",
  "HIGH",
]);

export const ProgrammingActionSchema = z.enum([
  "INCREASE_VOLUME",
  "DECREASE_VOLUME",
  "REALLOCATE_VOLUME",
]);

export const ExerciseTypePreferenceSchema = z.enum([
  "COMPOUND",
  "ISOLATION",
  "EITHER",
]);

export const PlacementPreferenceSchema = z.enum([
  "EARLIER_IF_LOGICAL",
  "KEEP_CURRENT",
]);

export const MovementChangeSchema = z.object({
  movementPatternId: z.string(),
  movementPatternName: z.string(),
  deltaSets: z.number().int().min(-4).max(4),
});

export const ProgrammingOptionSchema = z.object({
  optionKey: z.enum(["OPTION_A", "OPTION_B"]),
  title: z.string().max(140),
  action: ProgrammingActionSchema,
  deltaWeeklySets: z.number().int().min(-4).max(4),
  movementChanges: z.array(MovementChangeSchema).max(3),
  preferredExerciseType: ExerciseTypePreferenceSchema,
  placementPreference: PlacementPreferenceSchema,
  rationale: z.string().max(1000),
  expectedBenefit: z.string().max(500),
  mainRisk: z.string().max(500),
});

export const ProgrammingDecisionProposalSchema = z.object({
  targetMuscleId: z.string(),
  targetMuscleName: z.string(),
  decisionSummary: z.string().max(600),
  confidence: ProgrammingConfidenceSchema,
  evidence: z.array(z.string().max(350)).max(7),
  recommendedOptionKey: z.enum([
    "OPTION_A",
    "OPTION_B",
    "KEEP_AS_IS",
  ]),
  options: z.array(ProgrammingOptionSchema).max(2),
  keepAsIsRationale: z.string().max(700),
});

export const ProgrammingRecommendationsSchema = z.object({
  globalSummary: z.string().max(1200),
  decisions: z.array(ProgrammingDecisionProposalSchema).min(1).max(5),
});

export const StoredProgrammingOptionsSchema = z.array(
  ProgrammingOptionSchema,
).max(2);

export type ProgrammingRecommendations = z.infer<
  typeof ProgrammingRecommendationsSchema
>;
export type ProgrammingDecisionProposal = z.infer<
  typeof ProgrammingDecisionProposalSchema
>;
export type ProgrammingOption = z.infer<typeof ProgrammingOptionSchema>;
