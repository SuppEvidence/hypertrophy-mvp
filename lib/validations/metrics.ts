import { z } from "zod";

const optionalNumber = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}, z.number().nullable());

const optionalInt = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : value;
}, z.number().int().nullable());

const optionalScale = optionalInt.refine((value) => value === null || (value >= 1 && value <= 5), {
  message: "Use a 1–5 value or leave empty.",
});

export const metricLogSchema = z.object({
  loggedAt: z.string().min(1),
  bodyweight: optionalNumber,
  waist: optionalNumber,
  sleepDuration: optionalNumber,
  sleepQuality: optionalScale,
  stress: optionalScale,
  readiness: optionalScale,
  manualFatigue: optionalScale,
  sorenessJointIrritation: optionalScale,
  steps: optionalInt.refine((value) => value === null || value >= 0, { message: "Steps cannot be negative." }),
  notes: z.string().trim().max(1000).optional(),
});

export type MetricLogInput = z.infer<typeof metricLogSchema>;
