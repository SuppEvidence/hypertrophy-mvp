import { z } from "zod";

export const templateRenameSchema = z.object({
  name: z.string().trim().min(1, "Template name is required.").max(80),
});

export const templateOccurrenceSchema = z.object({
  expectedOccurrences: z.coerce.number().min(0).max(30),
  sequencePosition: z.preprocess((value) => (value === null || value === "" ? undefined : value), z.coerce.number().int().min(1).max(50).optional()),
  selectedTemplateId: z.string().uuid().optional().nullable(),
});

export const templateRotationSequenceSchema = z.object({
  rotationSequence: z.string().trim().max(500),
  selectedTemplateId: z.string().uuid().optional().nullable(),
});

export const templateExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  plannedSets: z.coerce.number().int().min(1).max(20),
  minSets: z.coerce.number().int().min(0).max(20).nullable().optional(),
  maxSets: z.coerce.number().int().min(0).max(30).nullable().optional(),
  minReps: z.coerce.number().int().min(1).max(100).nullable().optional(),
  maxReps: z.coerce.number().int().min(1).max(100).nullable().optional(),
  rirTarget: z.coerce.number().min(0).max(10).nullable().optional(),
  defaultSetTypeId: z.string().uuid(),
  slotPriority: z.enum(["CORE", "STANDARD", "OPTIONAL"]).default("STANDARD"),
  slotRole: z.enum(["PRIMARY_COMPOUND", "SECONDARY", "ISOLATION", "OPTIONAL_ACCESSORY"]).default("ISOLATION"),
  repBucket: z.enum(["HEAVY_COMPOUND", "SECONDARY_COMPOUND", "ISOLATION", "LENGTHENED_ISOLATION"]).default("ISOLATION"),
  autoAdjustable: z.boolean().default(false),
  notes: z.string().trim().max(240).optional(),
});

export const templateExerciseSetPlanSchema = z.object({
  setTypeId: z.string().uuid(),
});
