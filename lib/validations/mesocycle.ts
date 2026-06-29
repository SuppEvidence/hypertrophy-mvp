import { z } from "zod";

const dateInput = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);

const intFromInput = z.preprocess((value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}, z.number().int().min(1).max(52));

export const mesocycleSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phase: z.enum(["PUSH", "HOLD", "DELOAD", "MAINTENANCE", "OTHER"]),
  startDate: dateInput,
  lengthWeeks: intFromInput,
  notes: z.string().trim().max(1000).optional(),
});

export type MesocycleInput = z.infer<typeof mesocycleSchema>;
