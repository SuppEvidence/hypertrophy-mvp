import { z } from "zod";

export const StimulusLevelSchema = z.enum([
  "LOW",
  "MODERATE",
  "HIGH",
  "INSUFFICIENT_DATA",
]);

export const FatigueLevelSchema = z.enum([
  "LOW",
  "MODERATE",
  "HIGH",
  "INSUFFICIENT_DATA",
]);

export const ConfidenceSchema = z.enum(["LOW", "MODERATE", "HIGH"]);

export const RirPlausibilitySchema = z.enum([
  "LIKELY_FARTHER_FROM_FAILURE",
  "CONSISTENT_WITH_REPORTED_RIR",
  "LIKELY_CLOSER_TO_FAILURE",
  "UNCERTAIN",
]);

export const PerformanceDecaySchema = z.enum([
  "LOWER_THAN_USUAL",
  "NORMAL_FOR_EXERCISE",
  "HIGHER_THAN_USUAL",
  "INSUFFICIENT_HISTORY",
]);

export const SetAssessmentSchema = z.object({
  setNumber: z.number().int().positive(),
  stimulus: StimulusLevelSchema,
  fatigueCost: FatigueLevelSchema,
  rirPlausibility: RirPlausibilitySchema,
  confidence: ConfidenceSchema,
  rationale: z.string().max(500),
});

export const ExerciseAssessmentSchema = z.object({
  sessionExerciseId: z.string(),
  exerciseName: z.string(),
  overallStimulus: StimulusLevelSchema,
  overallFatigueCost: FatigueLevelSchema,
  performanceDecay: PerformanceDecaySchema,
  confidence: ConfidenceSchema,
  notableSignals: z.array(z.string().max(300)).max(6),
  rationale: z.string().max(900),
  sets: z.array(SetAssessmentSchema),
});

export const WorkoutAnalysisSchema = z.object({
  workoutSummary: z.string().max(1200),
  overallFatigueSignal: FatigueLevelSchema,
  confidence: ConfidenceSchema,
  exerciseAssessments: z.array(ExerciseAssessmentSchema),
});

export type WorkoutAnalysis = z.infer<typeof WorkoutAnalysisSchema>;
