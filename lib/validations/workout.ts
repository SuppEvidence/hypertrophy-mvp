import { z } from "zod";

export const startWorkoutSchema = z.object({
  programId: z.string().uuid(),
  templateId: z.string().uuid(),
});

export const workoutSetSchema = z.object({
  weight: z.coerce.number().min(0).max(2000).nullable().optional(),
  reps: z.coerce.number().int().min(0).max(500).nullable().optional(),
  rir: z.coerce.number().min(0).max(10).nullable().optional(),
  setTypeId: z.string().uuid(),
  isCompleted: z.coerce.boolean().default(false),
});

export const sessionExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  painFlag: z.coerce.boolean().default(false),
  painNote: z.string().trim().max(240).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const finishWorkoutSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
});
