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

function helsinkiMidnight(date: string) {
  const noon = new Date(`${date}T12:00:00Z`);
  const zone = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Helsinki", timeZoneName: "shortOffset" })
    .formatToParts(noon).find((part) => part.type === "timeZoneName")?.value ?? "GMT+2";
  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(zone);
  if (!match) throw new Error("Cannot determine Helsinki calendar offset.");
  const minutes = (Number(match[2]) * 60 + Number(match[3] ?? 0)) * (match[1] === "+" ? 1 : -1);
  return new Date(Date.parse(`${date}T00:00:00Z`) - minutes * 60_000);
}
