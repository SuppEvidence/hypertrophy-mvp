import { z } from "zod";

const optionalContribution = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return 0.5;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}, z.number().min(0).max(1));

const optionalMultiplier = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}, z.number().min(1).max(3).nullable());

export const settingsSchema = z.object({
  preferredUnit: z.enum(["KG", "LB"]),
  defaultSecondaryContribution: optionalContribution,
  advancedMuscleMode: z.boolean(),
  metricVisibility: z.object({
    bodyweight: z.boolean(),
    waist: z.boolean(),
    sleep: z.boolean(),
    stress: z.boolean(),
    readiness: z.boolean(),
    fatigue: z.boolean(),
    soreness: z.boolean(),
    steps: z.boolean(),
  }),
});

export const setTypeMultiplierSchema = z.object({
  setTypeId: z.string().uuid(),
  multiplier: optionalMultiplier.refine((value) => value !== null, { message: "Multiplier is required." }),
});

export const customSetTypeSchema = z.object({
  name: z.string().trim().min(2).max(60),
  multiplier: optionalMultiplier.refine((value) => value !== null, { message: "Multiplier is required." }),
  isIntensifier: z.boolean(),
  description: z.string().trim().max(240).optional(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
