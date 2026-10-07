import { CIRCUMFERENCE_FIELDS, selectMesocycleCheckins } from "./mesocycle-checkins";

type Metric = { loggedAt: Date; logType: string; bodyweight?: unknown; waist?: unknown }
  & Partial<Record<(typeof CIRCUMFERENCE_FIELDS)[number], unknown>>;
const DAY_MS = 86_400_000;
const day = (date: Date) => date.toISOString().slice(0, 10);
function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/** Compact observations, not a classifier of growth or training effectiveness. */
export function summarizeIntraMesocycleCircumferences(args: {
  logs: Metric[]; startDate: Date; endDate: Date; priorEndDate?: Date | null; now: Date;
}) {
  const boundaries = selectMesocycleCheckins(args);
  const baseline = boundaries.start;
  const snapshot = (row: Metric) => ({
    date: day(row.loggedAt), logType: row.logType,
    bodyweightKg: numeric(row.bodyweight), waistMm: numeric(row.waist),
    circumferencesMm: Object.fromEntries(CIRCUMFERENCE_FIELDS.map((field) => [field, numeric(row[field])])),
  });
  const observations = args.logs.filter((row) =>
    ["OPTIONAL_CHECKIN", "MESOCYCLE_CHECKIN", "MESOCYCLE_END"].includes(row.logType) &&
    day(row.loggedAt) >= day(args.startDate) && day(row.loggedAt) <= day(args.endDate) &&
    day(row.loggedAt) <= day(args.now) &&
    (!baseline || day(row.loggedAt) > day(baseline.loggedAt)) &&
    CIRCUMFERENCE_FIELDS.some((field) => numeric(row[field]) !== null),
  ).sort((a, b) => a.loggedAt.getTime() - b.loggedAt.getTime());

  return {
    baseline: baseline ? snapshot(baseline) : null,
    baselineSource: boundaries.startSource,
    observationCount: observations.length,
    recentObservations: observations.slice(-8).map(snapshot),
    fields: CIRCUMFERENCE_FIELDS.map((field) => {
      const points = observations.filter((row) => numeric(row[field]) !== null);
      const baselineValue = numeric(baseline?.[field]);
      const reference = baseline && baselineValue !== null ? baseline : points[0];
      const latest = points.at(-1);
      const referenceValue = numeric(reference?.[field]);
      const latestValue = numeric(latest?.[field]);
      const elapsedDays = reference && latest
        ? Math.round((Date.parse(day(latest.loggedAt)) - Date.parse(day(reference.loggedAt))) / DAY_MS) : null;
      return {
        field, observationCount: points.length,
        referenceSource: baselineValue !== null ? "MESOCYCLE_BASELINE" : reference ? "FIRST_IN_BLOCK_OBSERVATION" : null,
        referenceDate: reference ? day(reference.loggedAt) : null, referenceMm: referenceValue,
        latestDate: latest ? day(latest.loggedAt) : null, latestMm: latestValue, elapsedDays,
        changeMm: referenceValue !== null && latestValue !== null && elapsedDays !== null && elapsedDays > 0
          ? Number((latestValue - referenceValue).toFixed(1)) : null,
      };
    }),
    caution: "Circumferences are noisy supporting observations, not proof of hypertrophy or a direct stimulus measure. Consider elapsed time, measurement consistency, bodyweight/waist, phase, performance, execution and recovery. Chest cannot isolate upper/mid/lower chest; shoulders and arms include multiple muscles. Missing measurements are unknown, not zero. Never change volume solely because of a single measurement or a flat short interval.",
  };
}
