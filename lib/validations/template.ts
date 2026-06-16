import { z } from "zod";

export const templateRenameSchema = z.object({
  name: z.string().trim().min(1, "Template name is required.").max(80),
});

export const templateExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  plannedSets: z.coerce.number().int().min(1).max(20),
  minReps: z.coerce.number().int().min(1).max(100).nullable().optional(),
  maxReps: z.coerce.number().int().min(1).max(100).nullable().optional(),
  rirTarget: z.coerce.number().min(0).max(10).nullable().optional(),
  defaultSetTypeId: z.string().uuid(),
  notes: z.string().trim().max(240).optional(),
});
