import { z } from "zod";

export const programSchema = z.object({
  name: z.string().trim().min(1, "Program name is required").max(80),
  programType: z.enum(["FULL_BODY_EOD", "UPPER_LOWER", "PPL", "BRO_SPLIT", "TORSO_LIMBS", "CUSTOM"]),
  templateCount: z.coerce.number().int().min(1).max(12),
  rotationStyle: z.enum(["FIXED_SEQUENCE", "WEEKDAY_BASED", "MANUAL"]),
  volumeWindowType: z.enum(["WEEKLY", "ROLLING_10D", "ROLLING_14D", "CUSTOM"]),
  customWindowDays: z.coerce.number().int().min(1).max(60).optional().nullable(),
  secondaryContribution: z.coerce.number().min(0).max(1),
  activePhase: z.enum(["PUSH", "HOLD", "DELOAD", "MAINTENANCE", "OTHER"]),
  advancedMuscleMode: z.coerce.boolean().default(false),
});

export type ProgramInput = z.infer<typeof programSchema>;
