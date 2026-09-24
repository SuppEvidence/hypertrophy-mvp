import { z } from "zod";

export const PreWorkoutDecisionSchema = z.enum(["KEEP", "ADJUST"]);
export const PreWorkoutConfidenceSchema = z.enum(["LOW", "MODERATE", "HIGH"]);
export const LocalReadinessStatusSchema = z.enum(["READY", "RECOVERING", "CAUTION", "INSUFFICIENT_DATA"]);
export const BodyCompositionTrendStatusSchema = z.enum([
  "FAT_LOSS_LIKELY",
  "GAIN_LIKELY",
  "MAINTENANCE_LIKELY",
  "MIXED",
  "INSUFFICIENT_DATA",
]);
export const GlobalRecoveryStatusSchema = z.enum(["GOOD", "NORMAL", "ELEVATED_FATIGUE", "HIGH_FATIGUE", "INSUFFICIENT_DATA"]);

export const PreWorkoutPlanItemSchema = z.object({
  sourceSlotId: z.string().min(1).max(240),
  exerciseId: z.string().uuid(),
  sets: z.number().int().min(1).max(8),
  setTypeIds: z.array(z.string().uuid()).min(1).max(8),
  minReps: z.number().int().min(3).max(30).nullable(),
  maxReps: z.number().int().min(3).max(30).nullable(),
  targetRir: z.number().min(0).max(4).nullable(),
  reason: z.string().min(1).max(500),
});

export const PreWorkoutCoachModelPlanSchema = z.object({
  decision: PreWorkoutDecisionSchema,
  confidence: PreWorkoutConfidenceSchema,
  baseTemplateId: z.string().uuid(),
  summary: z.string().min(1).max(1200),
  constraintsApplied: z.array(z.string().min(1).max(240)).max(6),
  items: z.array(PreWorkoutPlanItemSchema).min(1).max(12),
});

export const BodyCompositionTrendSchema = z.object({
  status: BodyCompositionTrendStatusSchema,
  confidence: PreWorkoutConfidenceSchema,
  observationCount: z.number().int().nonnegative(),
  spanDays: z.number().nonnegative(),
  bodyweightChangePct: z.number().nullable(),
  bodyweightWeeklyChangePct: z.number().nullable(),
  waistChange: z.number().nullable(),
  waistWeeklyChange: z.number().nullable(),
  interpretation: z.string().max(600),
});

export const GlobalRecoveryContextSchema = z.object({
  status: GlobalRecoveryStatusSchema,
  confidence: PreWorkoutConfidenceSchema,
  observationCount: z.number().int().nonnegative(),
  latestLoggedAt: z.string().datetime().nullable(),
  averageFatigueScore: z.number().min(0).max(100).nullable(),
  interpretation: z.string().max(600),
});

export const LocalReadinessInferenceSchema = z.object({
  movementGroupId: z.string().uuid(),
  movementGroupName: z.string().max(200),
  status: LocalReadinessStatusSchema,
  confidence: PreWorkoutConfidenceSchema,
  hoursSinceLastExposure: z.number().nonnegative().nullable(),
  effectiveSetsLast48h: z.number().nonnegative(),
  effectiveSetsLast72h: z.number().nonnegative(),
  performanceExposureCount: z.number().int().nonnegative(),
  evidence: z.array(z.string().max(300)).max(6),
  interpretation: z.string().max(600),
});

export const PreWorkoutCoachProposalSchema = PreWorkoutCoachModelPlanSchema.extend({
  version: z.literal("T2.0"),
  generatedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  programId: z.string().uuid(),
  requestedTemplateId: z.string().uuid(),
  availableMinutes: z.number().int().min(20).max(120),
  constraints: z.string().max(800),
  model: z.string().min(1).max(120),
  bodyComposition: BodyCompositionTrendSchema,
  globalRecovery: GlobalRecoveryContextSchema,
  localizedReadiness: z.array(LocalReadinessInferenceSchema).max(30),
});

export type PreWorkoutCoachModelPlan = z.infer<typeof PreWorkoutCoachModelPlanSchema>;
export type PreWorkoutCoachProposal = z.infer<typeof PreWorkoutCoachProposalSchema>;
export type BodyCompositionTrend = z.infer<typeof BodyCompositionTrendSchema>;
export type GlobalRecoveryContext = z.infer<typeof GlobalRecoveryContextSchema>;
export type LocalReadinessInference = z.infer<typeof LocalReadinessInferenceSchema>;

export type PreWorkoutCoachDisplay = {
  requestedTemplateName: string;
  baseTemplateName: string;
  changeLabels: string[];
  volume: { baselinePhysical: number; proposedPhysical: number; baselineEffective: number; proposedEffective: number; baselineIntensifiers: number; proposedIntensifiers: number };
  items: Array<{
    sourceSlotId: string;
    movementGroupId: string;
    movementGroupName: string;
    exerciseName: string;
    sets: number;
    setTypes: string[];
    repRange: string;
    targetRir: number | null;
    reason: string;
  }>;
};
