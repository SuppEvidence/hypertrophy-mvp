// Weekly coaching is scheduled on Helsinki calendar days, independent of the server's timezone.
export function helsinkiDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Helsinki", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function coachedWeek(now = new Date()) {
  const today = helsinkiDate(now);
  const day = new Date(`${today}T12:00:00Z`);
  const monday = new Date(day);
  monday.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(monday.getUTCDate() + 7);
  const weekStart = monday.toISOString().slice(0, 10);
  return { today, weekStart, dbWeekStart: new Date(`${weekStart}T00:00:00Z`),
    start: helsinkiMidnight(weekStart), end: helsinkiMidnight(nextMonday.toISOString().slice(0, 10)) };
}

/** Planner-only selection. Logger and dose-context callers keep coachedWeek(). */
export function plannerWeekOptions(now = new Date()) {
  const current = coachedWeek(now);
  const next = coachedWeek(new Date(Date.parse(`${current.weekStart}T12:00:00Z`) + 7 * 86_400_000));
  const weekday = new Date(`${current.today}T12:00:00Z`).getUTCDay();
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Helsinki", hour: "2-digit", hourCycle: "h23" }).format(now));
  const nextAvailable = weekday === 0 && hour >= 12;
  return { current: current.weekStart, next: next.weekStart, nextAvailable,
    defaultWeek: nextAvailable ? next.weekStart : current.weekStart };
}

export function resolvePlannerWeek(requested?: string, now = new Date()) {
  const options = plannerWeekOptions(now);
  const selected = requested ?? options.defaultWeek;
  if (selected !== options.current && !(options.nextAvailable && selected === options.next)) {
    throw new Error("Choose the current week. Upcoming-week planning opens Sunday at 12:00 Helsinki time.");
  }
  const range = coachedWeek(new Date(`${selected}T12:00:00Z`));
  const current = coachedWeek(now);
  return { ...range, today: current.today, isUpcoming: selected !== options.current,
    prescriptionAsOf: selected !== options.current ? new Date(`${selected}T12:00:00Z`) : now };
}

function helsinkiMidnight(date: string) {
  const noon = new Date(`${date}T12:00:00Z`);
  const zone = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Helsinki", timeZoneName: "shortOffset" })
    .formatToParts(noon).find((part) => part.type === "timeZoneName")?.value ?? "GMT+2";
  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(zone);
  if (!match) throw new Error("Cannot determine Helsinki calendar offset.");
  const minutes = (Number(match[2]) * 60 + Number(match[3] ?? 0)) * (match[1] === "+" ? 1 : -1);
  return new Date(Date.parse(`${date}T00:00:00Z`) - minutes * 60_000);
}
