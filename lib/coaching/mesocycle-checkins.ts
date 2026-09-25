/** Date-only comparisons avoid treating the form's noon timestamp as a different day. */
const DAY_MS = 86_400_000;
const WINDOW_DAYS = 7;
export const CIRCUMFERENCE_FIELDS = ["chest", "shoulders", "arms", "thighs", "glutes", "calves"] as const;

type Checkin = {
  loggedAt: Date;
  logType: string;
  updatedAt?: Date;
} & Partial<Record<(typeof CIRCUMFERENCE_FIELDS)[number], unknown>>;

function day(value: Date) {
  return Date.parse(value.toISOString().slice(0, 10) + "T00:00:00Z");
}

function closeTo(value: Date, boundary: Date) {
  return Math.abs(day(value) - day(boundary)) <= WINDOW_DAYS * DAY_MS;
}

function closest<T extends Checkin>(logs: T[], boundary: Date) {
  return [...logs].sort((a, b) =>
    Math.abs(day(a.loggedAt) - day(boundary)) - Math.abs(day(b.loggedAt) - day(boundary)) ||
    day(b.loggedAt) - day(a.loggedAt) ||
    (b.updatedAt?.getTime() ?? b.loggedAt.getTime()) - (a.updatedAt?.getTime() ?? a.loggedAt.getTime()),
  )[0] ?? null;
}

/** A prior end check-in can serve as the next start; no metric row is copied. */
export function selectMesocycleCheckins<T extends Checkin>(args: {
  logs: T[];
  startDate: Date;
  endDate: Date;
  priorEndDate?: Date | null;
  now: Date;
}) {
  const eligible = args.logs.filter((row) => day(row.loggedAt) <= day(args.now));
  const hasCircumference = (row: T) => CIRCUMFERENCE_FIELDS.some((field) => row[field] !== null && row[field] !== undefined);
  const explicitStart = closest(eligible.filter((row) => row.logType === "MESOCYCLE_START" && hasCircumference(row) && closeTo(row.loggedAt, args.startDate)), args.startDate);
  const carriedStart = args.priorEndDate && closeTo(args.priorEndDate, args.startDate)
    ? closest(eligible.filter((row) => row.logType === "MESOCYCLE_END" && hasCircumference(row) &&
        closeTo(row.loggedAt, args.priorEndDate!) && closeTo(row.loggedAt, args.startDate)), args.startDate)
    : null;
  const end = closest(eligible.filter((row) => row.logType === "MESOCYCLE_END" && hasCircumference(row) && closeTo(row.loggedAt, args.endDate)), args.endDate);
  const shared = (start: T | null) => start && end ? CIRCUMFERENCE_FIELDS.filter((field) =>
    start[field] !== null && start[field] !== undefined && end[field] !== null && end[field] !== undefined,
  ) : [];
  const useCarried = Boolean(explicitStart && shared(explicitStart).length === 0 && shared(carriedStart).length > 0);
  const start = useCarried ? carriedStart : explicitStart ?? carriedStart;
  const sharedFields = shared(start);
  return {
    start,
    end,
    startSource: start === carriedStart && carriedStart ? "PRIOR_END" as const : explicitStart ? "EXPLICIT" as const : null,
    sharedFields,
    ready: sharedFields.length > 0,
  };
}
