import { z } from "zod";

export const startWorkoutSchema = z.object({
  programId: z.string().uuid(),
  templateId: z.string().uuid(),
});

export const repRangeStatusSchema = z.enum(["IN_RANGE", "TOO_LOW", "TOO_HIGH", "MIXED", "NOT_LOGGED"]);
export const effortStatusSchema = z.enum(["TOO_EASY", "PRODUCTIVE", "VERY_HARD", "FAILURE", "NOT_SURE"]);

export const workoutSetSchema = z.object({
  weight: z.coerce.number().min(0).max(2000).nullable().optional(),
  reps: z.coerce.number().int().min(0).max(500).nullable().optional(),
  rir: z.coerce.number().min(0).max(10).nullable().optional(),
  setTypeId: z.string().uuid(),
  isCompleted: z.coerce.boolean().default(false),
  repRangeStatus: repRangeStatusSchema.default("IN_RANGE"),
  effortStatus: effortStatusSchema.default("PRODUCTIVE"),
  painFlag: z.coerce.boolean().default(false),
  painNote: z.string().trim().max(240).optional(),
});

const optionalCompletedSets = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : value;
}, z.number().int().min(0).max(100).nullable());

export const sessionExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  completedSets: optionalCompletedSets.optional(),
  stimulusSetTypeId: z.string().uuid().nullable().optional(),
  repRangeStatus: repRangeStatusSchema.default("IN_RANGE"),
  effortStatus: effortStatusSchema.default("PRODUCTIVE"),
  painFlag: z.coerce.boolean().default(false),
  painNote: z.string().trim().max(240).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const stimulusSessionExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  notes: z.string().trim().max(500).optional(),
});

export const finishWorkoutSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
});
