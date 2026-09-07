import { prisma } from "@/lib/db/prisma";
import { ensureProgramTemplates } from "@/lib/server/templates";
import { phaseLabels, programTypeLabels, volumeWindowLabels } from "@/lib/programs/options";
import { getNextTemplateFromRotation } from "@/lib/templates/rotationSequence";
import { parseStoredWeeklyPlan } from "@/lib/templates/weeklyPlan";
import {
  buildBodyMetricContext,
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
    const plannedEndExclusive = addDays(
      mesocycle.startDate,
      mesocycle.lengthWeeks * 7,
    );
    const effectiveEndExclusive = mesocycle.actualEndDate
      ? addDays(mesocycle.actualEndDate, 1)
      : plannedEndExclusive;

    return {
      ...mesocycle,
      plannedEndExclusive,
      effectiveEndExclusive,
      plannedEndDate: addDays(plannedEndExclusive, -1),
      effectiveEndDate: addDays(effectiveEndExclusive, -1),
    };
  });

  const current = withDates.find(
    (mesocycle) =>
      !mesocycle.actualEndDate &&
      mesocycle.startDate <= now &&
      mesocycle.plannedEndExclusive > now,
  );
  const upcoming = [...withDates]
    .reverse()
    .find(
      (mesocycle) =>
        !mesocycle.actualEndDate && mesocycle.startDate > now,
    );
  const selected = current ?? upcoming ?? withDates[0];
  if (!selected) return null;

  const isCompleted =
    Boolean(selected.actualEndDate) || selected.plannedEndExclusive <= now;
  const totalDays = Math.max(
    daysBetween(selected.startDate, selected.effectiveEndExclusive),
    1,
  );
  const elapsedDays = isCompleted
    ? totalDays
    : Math.min(
        Math.max(daysBetween(selected.startDate, now), 0),
        totalDays,
      );
  const currentWeek =
    selected.startDate <= now
      ? Math.min(
          Math.floor(Math.max(elapsedDays - 1, 0) / 7) + 1,
          selected.lengthWeeks,
        )
      : 0;
  const daysRemaining =
    !isCompleted && selected.effectiveEndExclusive > now
      ? Math.max(daysBetween(now, selected.effectiveEndExclusive), 0)
      : 0;
  const status = current
    ? "Current"
    : selected.startDate > now
      ? "Upcoming"
      : "Completed";

  return {
    id: selected.id,
    name: selected.name,
    phaseLabel: phaseLabels[selected.phase],
    status,
    startDate: dateOnly(selected.startDate),
    endDate: dateOnly(selected.effectiveEndDate),
    plannedEndDate: dateOnly(selected.plannedEndDate),
    endedEarly: Boolean(
      selected.actualEndDate && selected.actualEndDate < selected.plannedEndDate,
    ),
    lengthWeeks: selected.lengthWeeks,
    currentWeek,
    daysRemaining,
    progressPct: isCompleted
      ? 100
      : Math.round((elapsedDays / totalDays) * 100),
    notes: selected.notes ?? "",
  };
}

async function getSuggestedTemplate(
  program: {
    id: string;
    rotationStyle: string;
    rotationSequence: unknown;
    weeklyPlan: unknown;
  },
  userId: string,
  templates: Array<{
    id: string;
    name: string;
    sequenceIndex: number;
    weekday: number | null;
  }>,
) {
  if (templates.length === 0) return null;

  const orderedTemplates = [...templates].sort(
    (a, b) => a.sequenceIndex - b.sequenceIndex,
  );
  const weeklyPlan = parseStoredWeeklyPlan(program.weeklyPlan);
  const availableTemplates = orderedTemplates.filter(
    (template) => !weeklyPlan.missedTemplateIds.includes(template.id),
  );
  const planningTemplates =
    availableTemplates.length > 0 ? availableTemplates : orderedTemplates;

  if (program.rotationStyle === "WEEKDAY_BASED") {
    const day = new Date().getDay();
    return (
      planningTemplates.find((template) => template.weekday === day) ??
      planningTemplates[0] ??
      null
    );
  }

  const recentCompleted = await prisma.workoutSession.findMany({
    where: {
      userId,
      programId: program.id,
      status: "COMPLETED",
      templateId: { not: null },
    },
    orderBy: { performedAt: "desc" },
    take: 20,
    select: { templateId: true },
  });

  return getNextTemplateFromRotation({
    templates: planningTemplates,
    rotationSequence: program.rotationSequence,
    completedTemplateHistory: recentCompleted
      .map((session) => session.templateId)
      .filter((templateId): templateId is string => Boolean(templateId))
      .reverse(),
  });
}

type CurrentDecisionFlag = {
  type: string;
  title: string;
  detail: string;
  severity: "neutral" | "watch" | "high";
};

/**
 * Current dashboard flags use factual volume, recovery and body metrics only.
 * Retired manual effort/rep-range labels are intentionally absent.
 */
function buildCurrentDecisionFlags(args: {
  volumeRows: Array<{
    muscleName: string;
    effective: number;
    target: number | null;
    status: string;
    isPriority: boolean;
  }>;
  fatigueTrend: {
    latest: { category: string; score: number | null } | null;
    previousAverageScore: number | null;
    isRising: boolean;
  };
  intensifiers: {
    isInflated: boolean;
    share: number;
  };
  bodyMetrics: {
    waistChange: number | null;
    bodyweightChange: number | null;
  };
  missedTemplateNames: string[];
}): CurrentDecisionFlag[] {
  const flags: CurrentDecisionFlag[] = [];

  // Coach Signals deliberately use wider tolerance than the factual volume table.
  // The table remains a precise selected-window report; coaching should only react
  // when the deviation is large enough to be programmatically meaningful.
  const ratioFor = (row: (typeof args.volumeRows)[number]) =>
    row.target !== null && row.target > 0 ? row.effective / row.target : null;
  const materiallyLow = (row: (typeof args.volumeRows)[number]) => {
    const ratio = ratioFor(row);
    return ratio !== null && ratio < 0.75;
  };
  const materiallyHigh = (row: (typeof args.volumeRows)[number]) => {
    const ratio = ratioFor(row);
    return ratio !== null && ratio > 1.3;
  };
  const severelyHigh = (row: (typeof args.volumeRows)[number]) => {
    const ratio = ratioFor(row);
    return ratio !== null && ratio > 1.5;
  };

  const priorityRows = args.volumeRows.filter((row) => row.isPriority);
  const underPriority = priorityRows.filter(materiallyLow);
  const abovePriority = priorityRows.filter(materiallyHigh);
  const anyMateriallyLow = args.volumeRows.some(materiallyLow);

  if (underPriority.length > 0) {
    flags.push({
      type: "PRIORITY_EFFECTIVE_VOLUME_LOW",
      title: "Priority volume materially low",
      detail: `${underPriority.map((row) => row.muscleName).join(", ")} remain below the Coach tolerance after nearby template shifts are considered.`,
      severity: "watch",
    });
  }

  if (abovePriority.length > 0) {
    flags.push({
      type: "PRIORITY_EFFECTIVE_VOLUME_HIGH",
      title: "Priority volume materially high",
      detail: `${abovePriority.map((row) => row.muscleName).join(", ")} remain meaningfully above target after schedule-shift tolerance. Check recovery before adding more work.`,
      severity: abovePriority.some(severelyHigh) ? "high" : "watch",
    });
  }

  if (args.fatigueTrend.isRising) {
    flags.push({
      type: "FATIGUE_RISING",
      title: "Fatigue context rising",
      detail: `Latest fatigue score is ${args.fatigueTrend.latest?.score}/100 versus recent average ${args.fatigueTrend.previousAverageScore}/100.`,
      severity: "watch",
    });
  }

  // Do not infer "missed exposure" from volume arithmetic alone. Only make this
  // connection when a genuinely uncovered template remains after reconciliation.
  if (
    anyMateriallyLow &&
    args.missedTemplateNames.length > 0 &&
    args.fatigueTrend.latest?.category === "Low"
  ) {
    flags.push({
      type: "LOW_VOLUME_WITH_LOW_FATIGUE",
      title: "Uncovered volume while fatigue is low",
      detail:
        "A meaningful volume deficit remains together with an uncovered planned template. Nearby schedule shifts have already been allowed for.",
      severity: "neutral",
    });
  }

  if (args.intensifiers.isInflated) {
    flags.push({
      type: "INTENSIFIER_SHARE_HIGH",
      title: "High intensifier share",
      detail: `${args.intensifiers.share}% of effective volume comes from intensifier set types in the selected window.`,
      severity: "watch",
    });
  }

  if (args.missedTemplateNames.length > 0 && underPriority.length > 0) {
    flags.push({
      type: "MISSED_TEMPLATE_UNDEREXPOSURE",
      title: "Uncovered template underexposure",
      detail: `${args.missedTemplateNames.slice(0, 3).join(", ")} remain uncovered after allowing nearby schedule shifts, while priority volume is materially low.`,
      severity: "watch",
    });
  }

  if (
    (args.bodyMetrics.waistChange ?? 0) >= 5 &&
    (args.bodyMetrics.bodyweightChange ?? 0) >= 0
  ) {
    flags.push({
      type: "WAIST_TREND_UP",
      title: "Waist trend moving up",
      detail: `7-day waist average is up ${args.bodyMetrics.waistChange} mm versus the previous 7 days. Interpret alongside bodyweight trend and mesocycle phase.`,
      severity: "watch",
    });
  }

  if (flags.length === 0) {
    flags.push({
      type: "HOLD_CURRENT_SETUP",
      title: "Hold current setup",
      detail:
        "Template-aware volume, fatigue context, performance, intensifier use and body metrics do not show a clear issue requiring an automatic flag.",
      severity: "neutral",
    });
  }

  return flags;
}

export async function getDashboardData(userId: string) {
  const activeProgram = await prisma.program.findFirst({
    where: { userId, isActive: true, isArchived: false },
    include: {
      priorityMuscles: {
        include: { muscle: true },
        orderBy: { muscle: { sortOrder: "asc" } },
      },
      volumeTargets: {
        include: { muscle: true },
        orderBy: { muscle: { sortOrder: "asc" } },
      },
    },
  });

  if (!activeProgram) {
    const latestMetrics = await prisma.metricLog.findMany({
      where: { userId, isDraft: false },
      orderBy: { loggedAt: "desc" },
      take: 30,
      select: {
        loggedAt: true,
        bodyweight: true,
        waist: true,
        sleepDuration: true,
        sleepQuality: true,
        stress: true,
        readiness: true,
        manualFatigue: true,
        sorenessJointIrritation: true,
      },
    });
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
      performanceTrend: {
        status: "Insufficient data" as const,
        comparedExercises: 0,
        declining: [],
      },
      intensifiers: {
        intensifierSets: 0,
        completedSets: 0,
        effectiveVolume: 0,
        intensifierEffectiveVolume: 0,
        share: 0,
        isInflated: false,
      },
      movementCoverage: [],
      bodyMetrics,
      flags: [],
      completedSessionsCount: 0,
      mesocycle: null,
    };
  }

  const windowDays = selectedWindowDays(activeProgram);
  const windowStart = selectedWindowStart(new Date(), windowDays);
  // Coach Signals can treat a workout performed shortly before the strict
  // reporting boundary as an early performance of the next planned template.
  // The factual dashboard table still uses the exact selected window below.
  const coachLookbackStart = addDays(windowStart, -2);

  const [templates, sessions, metrics, mesocycle] = await Promise.all([
    ensureProgramTemplates(activeProgram.id, userId, activeProgram),
    prisma.workoutSession.findMany({
      where: {
        userId,
        programId: activeProgram.id,
        status: "COMPLETED",
        performedAt: { gte: coachLookbackStart },
      },
      orderBy: { performedAt: "asc" },
      select: {
        id: true,
        performedAt: true,
        templateId: true,
        exercises: {
          orderBy: { sortOrder: "asc" },
          select: {
            exerciseId: true,
            completedSets: true,
            stimulusSetType: {
              select: { multiplier: true, isIntensifier: true },
            },
            exercise: {
              select: {
                name: true,
                movementGroup: {
                  select: { id: true, name: true, sortOrder: true },
                },
                primaryMuscles: {
                  orderBy: { muscle: { sortOrder: "asc" } },
                  select: {
                    muscleId: true,
                    muscle: { select: { name: true, sortOrder: true } },
                  },
                },
                secondaryMuscles: {
                  orderBy: { muscle: { sortOrder: "asc" } },
                  select: {
                    muscleId: true,
                    muscle: { select: { name: true, sortOrder: true } },
                  },
                },
              },
            },
            sets: {
              orderBy: { setNumber: "asc" },
              select: {
                setNumber: true,
                weight: true,
                reps: true,
                isCompleted: true,
                setType: {
                  select: { multiplier: true, isIntensifier: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.metricLog.findMany({
      where: { userId, isDraft: false },
      orderBy: { loggedAt: "desc" },
      take: 30,
      select: {
        loggedAt: true,
        bodyweight: true,
        waist: true,
        sleepDuration: true,
        sleepQuality: true,
        stress: true,
        readiness: true,
        manualFatigue: true,
        sorenessJointIrritation: true,
      },
    }),
    getDashboardMesocycle(activeProgram.id, userId),
  ]);

  const suggestedTemplate = await getSuggestedTemplate(
    activeProgram,
    userId,
    templates,
  );

  // Keep the dashboard's factual analytics strict.
  const strictSessions = sessions.filter(
    (session) => session.performedAt >= windowStart,
  );

  // Coach Signals are intentionally more schedule-aware. A single completed
  // template from up to two days before the rolling boundary can be carried
  // into the coaching interpretation as an early-shifted workout. This is
  // especially useful for "Monday workout done Sunday" situations.
  //
  // Only one boundary session is carried in, and it must belong to a template
  // that is currently available (not explicitly marked missed). This prevents
  // the coach window from simply becoming a 9-day volume window.
  const weeklyPlan = parseStoredWeeklyPlan(activeProgram.weeklyPlan);
  const expectedTemplates = templates.filter(
    (template) => !weeklyPlan.missedTemplateIds.includes(template.id),
  );
  const expectedTemplateIds = new Set(
    expectedTemplates.map((template) => template.id),
  );
  const boundaryCarryIn = [...sessions]
    .filter(
      (session) =>
        session.performedAt < windowStart &&
        Boolean(
          session.templateId &&
            expectedTemplateIds.has(session.templateId),
        ),
    )
    .sort(
      (a, b) => b.performedAt.getTime() - a.performedAt.getTime(),
    )[0] ?? null;

  const coachSessions = boundaryCarryIn
    ? [boundaryCarryIn, ...strictSessions]
    : strictSessions;

  const volumeRows = buildMuscleVolumeRows(activeProgram, strictSessions);
  const coachVolumeRows = buildMuscleVolumeRows(
    activeProgram,
    coachSessions,
  );
  const priorityRows = volumeRows.filter((row) => row.isPriority);
  const fatigueTrend = buildFatigueTrend(metrics);
  const performanceTrend = buildPerformanceTrend(strictSessions);
  const intensifiers = buildIntensifierSummary(strictSessions);
  const movementCoverage = buildMovementCoverage(strictSessions);
  const bodyMetrics = buildBodyMetricContext(metrics);

  const coachTemplateIdsWithSessions = new Set(
    coachSessions
      .map((session) => session.templateId)
      .filter((templateId): templateId is string => Boolean(templateId)),
  );
  const missedTemplateNames = expectedTemplates
    .filter((template) => !coachTemplateIdsWithSessions.has(template.id))
    .map((template) => template.name);

  const flags = buildCurrentDecisionFlags({
    volumeRows: coachVolumeRows,
    fatigueTrend,
    intensifiers,
    bodyMetrics,
    missedTemplateNames,
  });

  return {
    activeProgram: {
      id: activeProgram.id,
      name: activeProgram.name,
      typeLabel: programTypeLabels[activeProgram.programType],
      phaseLabel: phaseLabels[activeProgram.activePhase],
      volumeWindowLabel: volumeWindowLabels[activeProgram.volumeWindowType],
      templateCount: activeProgram.templateCount,
      secondaryContribution:
        toNumber(activeProgram.secondaryContribution) ?? 0,
      priorityMuscles: activeProgram.priorityMuscles.map(
        (link) => link.muscle.name,
      ),
    },
    windowDays,
    windowStart: windowStart.toISOString(),
    suggestedTemplate: suggestedTemplate
      ? { id: suggestedTemplate.id, name: suggestedTemplate.name }
      : null,
    volumeRows,
    priorityRows,
    fatigueTrend,
    performanceTrend,
    intensifiers,
    movementCoverage,
    bodyMetrics,
    flags,
    completedSessionsCount: strictSessions.length,
    mesocycle,
  };
}
