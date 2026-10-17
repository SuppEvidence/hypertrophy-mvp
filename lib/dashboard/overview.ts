import { helsinkiDate } from "@/lib/coaching/weekly-coach-calendar";
import { getNextTemplateFromRotation } from "@/lib/templates/rotationSequence";
import { parseStoredWeeklyPlan } from "@/lib/templates/weeklyPlan";

export const dayAfter = (day: string, days: number) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
export const daysApart = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86400000,
  );
export function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function text(value: unknown, limit = 300): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const clean = value.trim();
  return clean.length > limit ? `${clean.slice(0, limit).trimEnd()}…` : clean;
}
export function validDay(value: unknown): string | null {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) &&
    dayAfter(value, 0) === value
    ? value
    : null;
}
export function dateLabel(day: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}
export function dueLabel(dueOn: string | null, today: string) {
  if (!dueOn) return null;
  const gap = daysApart(today, dueOn);
  return gap < 0
    ? `Due since ${dateLabel(dueOn)}`
    : gap === 0
      ? "Due today"
      : `Next · ${dateLabel(dueOn)}`;
}
export function blockStatus(
  block: { startDate: Date; lengthWeeks: number; actualEndDate: Date | null },
  today: string,
) {
  const start = block.startDate.toISOString().slice(0, 10);
  const end =
    block.actualEndDate?.toISOString().slice(0, 10) ??
    dayAfter(start, block.lengthWeeks * 7 - 1);
  const status =
    block.actualEndDate || end < today
      ? "Completed"
      : start > today
        ? "Upcoming"
        : "Current";
  const elapsed =
    status === "Completed"
      ? block.lengthWeeks * 7
      : Math.max(0, daysApart(start, today) + 1);
  return {
    status,
    start,
    end,
    currentWeek:
      status === "Upcoming"
        ? 0
        : Math.min(
            block.lengthWeeks,
            Math.floor(Math.max(0, elapsed - 1) / 7) + 1,
          ),
    progress: Math.min(
      100,
      Math.round((elapsed / Math.max(1, block.lengthWeeks * 7)) * 100),
    ),
    daysRemaining: status === "Current" ? daysApart(today, end) + 1 : 0,
  };
}

type MetricPoint = { loggedAt: Date; bodyweight: unknown; waist: unknown };
export function metricOverview(
  rows: MetricPoint[],
  key: "bodyweight" | "waist",
  latest: MetricPoint | null,
  now: Date,
) {
  const today = helsinkiDate(now);
  const days = new Map<string, number>();
  for (const row of [...rows].sort(
    (a, b) => b.loggedAt.getTime() - a.loggedAt.getTime(),
  )) {
    if (row.loggedAt > now || row[key] === null || row[key] === undefined)
      continue;
    const value = Number(row[key]),
      day = helsinkiDate(row.loggedAt);
    if (Number.isFinite(value) && value > 0 && !days.has(day))
      days.set(day, value);
  }
  const current = [...days]
    .filter(([d]) => d >= dayAfter(today, -6) && d <= today)
    .map(([, v]) => v);
  const previous = [...days]
    .filter(([d]) => d >= dayAfter(today, -13) && d < dayAfter(today, -6))
    .map(([, v]) => v);
  const mean = (v: number[]) =>
    v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  const average = mean(current),
    previousAverage = mean(previous);
  return {
    average,
    days: current.length,
    previousDays: previous.length,
    // A single measurement in either window is not a meaningful average trend.
    change:
      current.length >= 2 && previous.length >= 2
        ? average! - previousAverage!
        : null,
    latest:
      latest && latest.loggedAt <= now && latest[key] != null
        ? Number(latest[key])
        : null,
    latestOn:
      latest && latest.loggedAt <= now ? helsinkiDate(latest.loggedAt) : null,
  };
}

export type WorkoutHero = {
  kind: "RESUME" | "WEEKLY" | "ROTATION" | "REST" | "REVIEW" | "SETUP";
  eyebrow: string;
  title: string;
  detail: string;
  href: string;
  action: string;
  scheduledOn?: string;
};
type Template = {
  id: string;
  name: string;
  sequenceIndex: number;
  weekday: number | null;
};
type Program = {
  id: string;
  name: string;
  rotationStyle: string;
  rotationSequence: unknown;
  weeklyPlan: unknown;
  templates: Template[];
};
export type WeekOverview = {
  approved: boolean;
  needsReview: boolean;
  pending: Array<{
    id: string;
    templateId: string;
    date: string;
    durationMinutes: number;
  }>;
  completed: number;
  planned: number;
  missed: number;
  unallocated: number;
  draft: boolean;
};
export function workoutHero(args: {
  today: string;
  program: Program | null;
  draft: {
    id: string;
    name: string;
    programId: string;
    performedAt: Date;
  } | null;
  week: WeekOverview | null;
  completed: ReadonlyArray<{ templateId: string | null; performedAt: Date }>;
}): WorkoutHero {
  const { program, draft, week, today } = args;
  if (draft)
    return {
      kind: "RESUME",
      eyebrow: "Unfinished workout",
      title: draft.name,
      detail: `Started ${dateLabel(helsinkiDate(draft.performedAt))}. Continue your saved session.`,
      href: `/log?${new URLSearchParams({ sessionId: draft.id, programId: draft.programId })}`,
      action: "Resume workout",
    };
  if (!program)
    return {
      kind: "SETUP",
      eyebrow: "Training setup",
      title: "Build your next mesocycle",
      detail:
        "Set your training days, goals and constraints with the coach, or activate an existing program.",
      href: "/plan/blocks?tab=next",
      action: "Open mesocycle planner",
    };
  if (week?.needsReview)
    return {
      kind: "REVIEW",
      eyebrow: "Weekly plan",
      title: "Review your saved week",
      detail:
        "The saved week no longer matches the current block, templates or available exercises.",
      href: "/plan/week",
      action: "Review weekly plan",
    };
  if (week?.approved) {
    const next = week.pending.find((w) => w.date <= today) ?? week.pending[0];
    if (!next)
      return {
        kind: "REST",
        eyebrow: "This week",
        title: "No remaining scheduled workouts",
        detail: `${week.completed} of ${week.planned} planned sessions completed${week.missed ? ` · ${week.missed} marked missed` : ""}. Review the week if your availability changes.`,
        href: "/plan/week",
        action: "Open weekly plan",
      };
    return {
      kind: "WEEKLY",
      eyebrow:
        next.date === today
          ? "Planned for today"
          : next.date < today
            ? "Unstarted planned workout"
            : "Next planned workout",
      title:
        program.templates.find((t) => t.id === next.templateId)?.name ??
        "Planned workout",
      detail: `${dateLabel(next.date)} · ${next.durationMinutes} min · ${program.name}`,
      scheduledOn: next.date,
      href: `/log?${new URLSearchParams({ programId: program.id, templateId: next.templateId, occurrenceId: next.id })}`,
      action: "Open workout",
    };
  }
  const legacyWeek = parseStoredWeeklyPlan(program.weeklyPlan);
  const available = program.templates.filter(
    (t) => !legacyWeek.missedTemplateIds.includes(t.id),
  );
  const templates = available.length ? available : program.templates;
  if (!templates.length)
    return {
      kind: "SETUP",
      eyebrow: "Training setup",
      title: "Complete your program setup",
      detail: "Open the mesocycle planner to set up the workout structure.",
      href: "/plan/blocks",
      action: "Open mesocycle planner",
    };
  if (program.rotationStyle === "MANUAL")
    return {
      kind: "ROTATION",
      eyebrow: "Your program",
      title: "Choose your next workout",
      detail: program.name,
      href: `/log?programId=${program.id}`,
      action: "Open Train",
    };
  if (program.rotationStyle === "WEEKDAY_BASED") {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
    const scheduled = templates.find(
      (t) =>
        t.weekday === weekday &&
        !args.completed.some(
          (s) => s.templateId === t.id && helsinkiDate(s.performedAt) === today,
        ),
    );
    if (!scheduled)
      return {
        kind: "REST",
        eyebrow: "Today",
        title: "No remaining workout scheduled today",
        detail:
          "Open Train to choose a session, or plan the week around your availability.",
        href: `/log?programId=${program.id}`,
        action: "Open Train",
      };
    return {
      kind: "ROTATION",
      eyebrow: "Program schedule",
      title: scheduled.name,
      detail: program.name,
      href: `/log?${new URLSearchParams({ programId: program.id, templateId: scheduled.id, planSource: "program" })}`,
      action: "Open workout",
    };
  }
  const next = getNextTemplateFromRotation({
    templates,
    rotationSequence: program.rotationSequence,
    completedTemplateHistory: [...args.completed]
      .reverse()
      .flatMap((s) => (s.templateId ? [s.templateId] : [])),
  });
  return {
    kind: "ROTATION",
    eyebrow: "Next in rotation",
    title: next?.name ?? "Choose workout",
    detail: program.name,
    href: `/log?${new URLSearchParams({ programId: program.id, ...(next ? { templateId: next.id } : {}), planSource: "program" })}`,
    action: "Open workout",
  };
}
export type HomeAction = {
  id: string;
  title: string;
  detail: string;
  href: string;
  label: string;
  tone: "neutral" | "due";
};
