import { z } from "zod";

export const exerciseSchema = z.object({
  name: z.string().trim().min(1, "Exercise name is required").max(120),
  movementGroupId: z.string().uuid("Movement group is required"),
  tags: z.string().trim().max(240).optional(),
  setupNotes: z.string().trim().max(500).optional(),
  isActive: z.coerce.boolean().default(true),
  isArchived: z.coerce.boolean().default(false),
});

export type ExerciseInput = z.infer<typeof exerciseSchema>;
