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

export const MovementPatternProgressionSchema = z.enum([
  "POSITIVE",
  "STABLE",
  "MIXED",
  "NEGATIVE",
  "INSUFFICIENT_HISTORY",
]);

export const ExerciseConsistencySchema = z.enum([
  "CONSISTENT",
  "MIXED",
  "DIVERGENT",
  "INSUFFICIENT_HISTORY",
]);

export const PatternImplementationSchema = z.enum([
  "PATTERN_PRODUCTIVE",
  "EXERCISE_SPECIFIC_LIMITATION",
  "PATTERN_WIDE_STALL",
  "MIXED",
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

export const MovementPatternAssessmentSchema = z.object({
  movementPatternId: z.string(),
  movementPatternName: z.string(),
  overallStimulus: StimulusLevelSchema,
  overallFatigueCost: FatigueLevelSchema,
  progressionSignal: MovementPatternProgressionSchema,
  exerciseConsistency: ExerciseConsistencySchema,
  implementationInterpretation: PatternImplementationSchema,
  confidence: ConfidenceSchema,
  notableSignals: z.array(z.string().max(300)).max(6),
  rationale: z.string().max(1000),
});

export const WorkoutAnalysisSchema = z.object({
  workoutSummary: z.string().max(1200),
  overallFatigueSignal: FatigueLevelSchema,
  confidence: ConfidenceSchema,
  movementPatternAssessments: z.array(MovementPatternAssessmentSchema),
  exerciseAssessments: z.array(ExerciseAssessmentSchema),
});

export type WorkoutAnalysis = z.infer<typeof WorkoutAnalysisSchema>;
