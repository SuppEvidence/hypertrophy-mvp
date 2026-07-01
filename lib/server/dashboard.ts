import { prisma } from "@/lib/db/prisma";
import { ensureProgramTemplates } from "@/lib/server/templates";
import { phaseLabels, programTypeLabels, volumeWindowLabels } from "@/lib/programs/options";
import {
  buildBodyMetricContext,
  buildDecisionFlags,
  buildFatigueTrend,
  buildIntensifierSummary,
  buildMovementCoverage,
  buildMuscleVolumeRows,
  buildPerformanceTrend,
  selectedWindowDays,
  selectedWindowStart,
} from "@/lib/calculations/dashboard";

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function daysBetween(start: Date, end: Date) {
  return Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

async function getDashboardMesocycle(programId: string, userId: string) {
  const now = new Date();
  const mesocycles = await prisma.programMesocycle.findMany({
    where: { programId, userId, isArchived: false },
    orderBy: { startDate: "desc" },
    take: 12,
  });

  if (mesocycles.length === 0) return null;

  const withDates = mesocycles.map((mesocycle) => {
    const endExclusive = addDays(mesocycle.startDate, mesocycle.lengthWeeks * 7);
    return {
      ...mesocycle,
      endExclusive,
      endDate: addDays(endExclusive, -1),
    };
  });

  const current = withDates.find((mesocycle) => mesocycle.startDate <= now && mesocycle.endExclusive > now);
  const upcoming = [...withDates].reverse().find((mesocycle) => mesocycle.startDate > now);
  const selected = current ?? upcoming ?? withDates[0];
  if (!selected) return null;

  const totalDays = selected.lengthWeeks * 7;
  const elapsedDays = Math.min(Math.max(daysBetween(selected.startDate, now), 0), totalDays);
  const currentWeek = selected.startDate <= now ? Math.min(Math.floor(elapsedDays / 7) + 1, selected.lengthWeeks) : 0;
  const daysRemaining = selected.endExclusive > now ? Math.max(daysBetween(now, selected.endExclusive), 0) : 0;
  const status = current ? "Current" : selected.startDate > now ? "Upcoming" : "Completed";

  return {
    id: selected.id,
    name: selected.name,
    phaseLabel: phaseLabels[selected.phase],
    status,
    startDate: dateOnly(selected.startDate),
    endDate: dateOnly(selected.endDate),
    lengthWeeks: selected.lengthWeeks,
    currentWeek,
    daysRemaining,
    progressPct: Math.round((elapsedDays / totalDays) * 100),
    notes: selected.notes ?? "",
  };
}

async function getSuggestedTemplate(programId: string, userId: string, templates: Array<{ id: string; name: string; sequenceIndex: number; weekday: number | null }>) {
  if (templates.length === 0) return null;
  const program = await prisma.program.findFirst({ where: { id: programId, userId } });
  if (!program) return templates[0] ?? null;

  if (program.rotationStyle === "WEEKDAY_BASED") {
    const day = new Date().getDay();
    return templates.find((template) => template.weekday === day) ?? templates[0] ?? null;
  }

  if (program.rotationStyle === "MANUAL") return templates[0] ?? null;

  const lastCompleted = await prisma.workoutSession.findFirst({
    where: { userId, programId, status: "COMPLETED", templateId: { not: null } },
    orderBy: { performedAt: "desc" },
    include: { template: true },
  });
  if (!lastCompleted?.template) return templates[0] ?? null;
  const nextIndex = (lastCompleted.template.sequenceIndex + 1) % templates.length;
  return templates.find((template) => template.sequenceIndex === nextIndex) ?? templates[0] ?? null;
}

export async function getDashboardData(userId: string) {
  const activeProgram = await prisma.program.findFirst({
    where: { userId, isActive: true, isArchived: false },
    include: {
      priorityMuscles: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
      volumeTargets: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
    },
  });

  if (!activeProgram) {
    const latestMetrics = await prisma.metricLog.findMany({ where: { userId, isDraft: false }, orderBy: { loggedAt: "desc" }, take: 4 });
    const fatigueTrend = buildFatigueTrend(latestMetrics);
    const bodyMetrics = buildBodyMetricContext(latestMetrics);
    return {
      activeProgram: null,
      windowDays: null,
      windowStart: null,
      suggestedTemplate: null,
      volumeRows: [],
      priorityRows: [],
      fatigueTrend,
      performanceTrend: { status: "Insufficient data" as const, comparedExercises: 0, declining: [] },
      intensifiers: { intensifierSets: 0, completedSets: 0, effectiveVolume: 0, intensifierEffectiveVolume: 0, share: 0, isInflated: false },
      movementCoverage: [],
      bodyMetrics,
      flags: [],
      completedSessionsCount: 0,
      mesocycle: null,
    };
  }

  const windowDays = selectedWindowDays(activeProgram);
  const windowStart = selectedWindowStart(new Date(), windowDays);
  const templates = await ensureProgramTemplates(activeProgram.id, userId);
  const suggestedTemplate = await getSuggestedTemplate(activeProgram.id, userId, templates);

  const [sessions, metrics, mesocycle] = await Promise.all([
    prisma.workoutSession.findMany({
      where: {
        userId,
        programId: activeProgram.id,
        status: "COMPLETED",
        performedAt: { gte: windowStart },
      },
      orderBy: { performedAt: "asc" },
      include: {
        exercises: {
          orderBy: { sortOrder: "asc" },
          include: {
            exercise: {
              include: {
                movementGroup: true,
                primaryMuscles: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
                secondaryMuscles: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
              },
            },
            sets: { orderBy: { setNumber: "asc" }, include: { setType: true } },
          },
        },
      },
    }),
    prisma.metricLog.findMany({ where: { userId, isDraft: false }, orderBy: { loggedAt: "desc" }, take: 4 }),
    getDashboardMesocycle(activeProgram.id, userId),
  ]);

  const volumeRows = buildMuscleVolumeRows(activeProgram, sessions);
  const priorityRows = volumeRows.filter((row: any) => row.isPriority);
  const fatigueTrend = buildFatigueTrend(metrics);
  const performanceTrend = buildPerformanceTrend(sessions);
  const intensifiers = buildIntensifierSummary(sessions);
  const movementCoverage = buildMovementCoverage(sessions);
  const bodyMetrics = buildBodyMetricContext(metrics);
  const templateIdsWithSessions = new Set(sessions.map((session: any) => session.templateId).filter(Boolean));
  const missedTemplateNames = templates.filter((template: any) => !templateIdsWithSessions.has(template.id)).map((template: any) => template.name);
  const flags = buildDecisionFlags({ volumeRows, fatigueTrend, performanceTrend, intensifiers, missedTemplateNames });

  return {
    activeProgram: {
      id: activeProgram.id,
      name: activeProgram.name,
      typeLabel: programTypeLabels[activeProgram.programType],
      phaseLabel: phaseLabels[activeProgram.activePhase],
      volumeWindowLabel: volumeWindowLabels[activeProgram.volumeWindowType],
      templateCount: activeProgram.templateCount,
      secondaryContribution: toNumber(activeProgram.secondaryContribution) ?? 0,
      priorityMuscles: activeProgram.priorityMuscles.map((link: any) => link.muscle.name),
    },
    windowDays,
    windowStart: windowStart.toISOString(),
    suggestedTemplate: suggestedTemplate ? { id: suggestedTemplate.id, name: suggestedTemplate.name } : null,
    volumeRows,
    priorityRows,
    fatigueTrend,
    performanceTrend,
    intensifiers,
    movementCoverage,
    bodyMetrics,
    flags,
    completedSessionsCount: sessions.length,
    mesocycle,
  };
}
