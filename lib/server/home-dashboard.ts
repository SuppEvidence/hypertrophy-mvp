import "server-only";
import { prisma } from "@/lib/db/prisma";
import {
  coachedWeek,
  helsinkiDate,
} from "@/lib/coaching/weekly-coach-calendar";
import {
  parseWeeklyCoachPlan,
  parseMissedOccurrenceIds,
  weeklyOccurrenceFromSummary,
} from "@/lib/coaching/weekly-coach-runtime";
import { interpretEnergyPhase } from "@/lib/coaching/energy-phase";
import {
  photoIntervalDays,
  physiqueSettingsSchema,
  readVisualAssessment,
} from "@/lib/physique/policy";
import { draftSchema } from "@/lib/nutrition/schema";
import { phaseLabels } from "@/lib/programs/options";
import { activeExerciseWhere } from "./exercise-catalog-policy";
import {
  blockStatus,
  dayAfter,
  dateLabel,
  dueLabel,
  metricOverview,
  object,
  text,
  validDay,
  workoutHero,
  type HomeAction,
  type WeekOverview,
} from "@/lib/dashboard/overview";

/** Home is a read-only index of saved state. No templates, prescriptions, photos or AI are generated here. */
export async function getHomeDashboardData(userId: string, now = new Date()) {
  const today = helsinkiDate(now),
    week = coachedWeek(now);
  const day = new Date(`${today}T12:00:00Z`);
  const metricsSelect = {
    loggedAt: true,
    bodyweight: true,
    waist: true,
  } as const;
  const [
    program,
    draftSession,
    phases,
    nutritionState,
    nutritionEvent,
    latestPhoto,
    settings,
    designDraft,
    metrics,
    latestWeight,
    latestWaist,
  ] = await Promise.all([
    prisma.program.findFirst({
      where: { userId, isActive: true, isArchived: false },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        rotationStyle: true,
        rotationSequence: true,
        weeklyPlan: true,
        templates: {
          where: { userId, isActive: true, isArchived: false },
          orderBy: { sequenceIndex: "asc" },
          select: { id: true, name: true, sequenceIndex: true, weekday: true },
        },
      },
    }),
    prisma.workoutSession.findFirst({
      where: { userId, status: "DRAFT" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, programId: true, performedAt: true },
    }),
    prisma.energyPhase.findMany({
      where: { userId, startDate: { lte: day } },
      orderBy: { startDate: "desc" },
      take: 24,
      select: { phase: true, startDate: true },
    }),
    prisma.nutritionState.findUnique({
      where: { userId },
      select: { draft: true, requestToken: true, requestStartedAt: true },
    }),
    prisma.nutritionEvent.findFirst({
      where: {
        userId,
        kind: { in: ["BASELINE", "ACCEPTED"] },
        createdAt: { lte: now },
      },
      orderBy: { createdAt: "desc" },
      select: { kind: true, details: true, createdAt: true },
    }),
    // Schedule from capture date, not upload/analysis date. No photo bytes or signed URLs.
    prisma.physiqueCheckin.findFirst({
      where: { userId, takenOn: { lte: day }, photos: { some: {} } },
      orderBy: { takenOn: "desc" },
      select: {
        takenOn: true,
        analysisDraft: true,
        _count: { select: { photos: true } },
      },
    }),
    prisma.userSettings.findUnique({
      where: { userId },
      select: {
        physiqueTrainingLevel: true,
        physiqueGainWeeks: true,
        physiqueMaintenanceWeeks: true,
      },
    }),
    prisma.mesocycleDesign.findFirst({
      where: { userId, status: "DRAFT" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, updatedAt: true },
    }),
    prisma.metricLog.findMany({
      where: {
        userId,
        isDraft: false,
        loggedAt: {
          gte: new Date(`${dayAfter(today, -14)}T00:00:00Z`),
          lte: now,
        },
      },
      orderBy: { loggedAt: "desc" },
      take: 240,
      select: metricsSelect,
    }),
    prisma.metricLog.findFirst({
      where: {
        userId,
        isDraft: false,
        loggedAt: { lte: now },
        bodyweight: { not: null },
      },
      orderBy: { loggedAt: "desc" },
      select: metricsSelect,
    }),
    prisma.metricLog.findFirst({
      where: {
        userId,
        isDraft: false,
        loggedAt: { lte: now },
        waist: { not: null },
      },
      orderBy: { loggedAt: "desc" },
      select: metricsSelect,
    }),
  ]);
  const [blocks, savedWeek, weekSessions, recentCompleted] = program
    ? await Promise.all([
        prisma.programMesocycle.findMany({
          where: { userId, programId: program.id, isArchived: false },
          orderBy: { startDate: "desc" },
          take: 12,
          select: {
            id: true,
            name: true,
            phase: true,
            startDate: true,
            lengthWeeks: true,
            actualEndDate: true,
            t3EvaluationStatus: true,
            t3LastEvaluatedAt: true,
            musclePriorities: {
              orderBy: { muscle: { sortOrder: "asc" } },
              select: { priority: true, muscle: { select: { name: true } } },
            },
          },
        }),
        prisma.weeklyCoachPlan.findFirst({
          where: { userId, programId: program.id, weekStart: week.dbWeekStart },
          select: {
            status: true,
            proposal: true,
            allocation: true,
            missedIds: true,
            mesocycleId: true,
            unallocated: true,
          },
        }),
        prisma.workoutSession.findMany({
          where: {
            userId,
            programId: program.id,
            performedAt: { gte: week.start, lt: week.end, lte: now },
          },
          select: { status: true, prescriptionSummary: true },
        }),
        prisma.workoutSession.findMany({
          where: {
            userId,
            programId: program.id,
            status: "COMPLETED",
            performedAt: { lte: now },
          },
          orderBy: { performedAt: "desc" },
          take: 20,
          select: { templateId: true, performedAt: true },
        }),
      ])
    : ([[], null, [], []] as const);
  const current =
    blocks.find((b) => blockStatus(b, today).status === "Current") ?? null;
  const selectedBlock =
    current ??
    [...blocks]
      .reverse()
      .find((b) => blockStatus(b, today).status === "Upcoming") ??
    blocks[0] ??
    null;
  const review = selectedBlock
    ? await prisma.programMesocycle.findFirst({
        where: { id: selectedBlock.id, userId },
        select: {
          t3Assessment: true,
          aiRecommendation: true,
          aiRecommendedAt: true,
        },
      })
    : null;
  const volumeAssessment = object(review?.t3Assessment);
  const pendingVolume =
    current &&
    current.t3EvaluationStatus === "COMPLETE" &&
    typeof volumeAssessment.generationId === "string"
      ? await prisma.aiProgrammingDecision.count({
          where: {
            userId,
            mesocycleId: current.id,
            generationId: volumeAssessment.generationId,
            decisionType: "T3_MUSCLE_VOLUME",
            status: "PENDING",
          },
        })
      : 0;
  const block = selectedBlock
    ? {
        id: selectedBlock.id,
        name: selectedBlock.name,
        ...blockStatus(selectedBlock, today),
        lengthWeeks: selectedBlock.lengthWeeks,
        phaseLabel: phaseLabels[selectedBlock.phase],
        priorities: selectedBlock.musclePriorities
          .filter((p) => p.priority === "SPECIALIZE" || p.priority === "GROW")
          .map((p) => ({ name: p.muscle.name, priority: p.priority })),
        volumeSummary:
          current && current.t3EvaluationStatus === "COMPLETE"
            ? text(volumeAssessment.globalSummary, 400)
            : null,
        volumeReviewedOn: selectedBlock.t3LastEvaluatedAt
          ? helsinkiDate(selectedBlock.t3LastEvaluatedAt)
          : null,
      }
    : null;

  const approvedPlan =
    savedWeek?.status === "APPROVED"
      ? parseWeeklyCoachPlan(savedWeek.proposal)
      : null;
  const allocation = approvedPlan
    ? (parseWeeklyCoachPlan(savedWeek?.allocation) ?? approvedPlan)
    : null;
  const missed = new Set(parseMissedOccurrenceIds(savedWeek?.missedIds));
  const started = new Set(
    weekSessions.flatMap((s) => {
      const id = weeklyOccurrenceFromSummary(s.prescriptionSummary);
      return id ? [id] : [];
    }),
  );
  const completed = new Set(
    weekSessions
      .filter((s) => s.status === "COMPLETED")
      .flatMap((s) => {
        const id = weeklyOccurrenceFromSummary(s.prescriptionSummary);
        return id ? [id] : [];
      }),
  );
  const pending =
    allocation?.workouts.filter(
      (w) => !missed.has(w.id) && !started.has(w.id),
    ) ?? [];
  const exerciseIds = [
    ...new Set(pending.flatMap((w) => w.items.map((i) => i.exerciseId))),
  ];
  const availableExercises = exerciseIds.length
    ? await prisma.exercise.findMany({
        where: { id: { in: exerciseIds }, ...activeExerciseWhere(userId) },
        select: { id: true },
      })
    : [];
  const weekNeedsReview = Boolean(
    savedWeek?.status === "APPROVED" &&
    (!approvedPlan ||
      !allocation ||
      approvedPlan.weekStart !== week.weekStart ||
      (savedWeek.mesocycleId ?? null) !== (current?.id ?? null) ||
      pending.some(
        (w) => !program?.templates.some((t) => t.id === w.templateId),
      ) ||
      availableExercises.length !== exerciseIds.length),
  );
  const weekly: WeekOverview = {
    approved: Boolean(approvedPlan),
    needsReview: weekNeedsReview,
    pending: pending.map((w) => ({
      id: w.id,
      templateId: w.templateId,
      date: w.date,
      durationMinutes: w.durationMinutes,
    })),
    planned: allocation?.workouts.length ?? 0,
    completed:
      allocation?.workouts.filter((w) => completed.has(w.id)).length ?? 0,
    missed: allocation?.workouts.filter((w) => missed.has(w.id)).length ?? 0,
    unallocated: savedWeek?.unallocated ?? 0,
    draft: Boolean(
      savedWeek &&
      savedWeek.status !== "APPROVED" &&
      parseWeeklyCoachPlan(savedWeek.proposal),
    ),
  };
  const phase = interpretEnergyPhase(phases, day);
  const photoSettings = physiqueSettingsSchema.parse({
    trainingLevel: settings?.physiqueTrainingLevel ?? "UNSPECIFIED",
    gainWeeks: settings?.physiqueGainWeeks ?? 10,
    maintenanceWeeks: settings?.physiqueMaintenanceWeeks ?? 6,
    goal: "",
  });
  const photoInterval = photoIntervalDays(phase?.phase ?? null, photoSettings);
  const photoTakenOn = latestPhoto?.takenOn.toISOString().slice(0, 10) ?? null;
  const photoDueOn =
    photoTakenOn && photoInterval
      ? dayAfter(photoTakenOn, photoInterval)
      : null;
  const photoDraft = readVisualAssessment(latestPhoto?.analysisDraft);
  const photoHref = photoTakenOn
    ? `/physique?date=${photoTakenOn}`
    : "/physique";
  const nutritionDraft = draftSchema.safeParse(nutritionState?.draft);
  const nutritionBusy = Boolean(
    nutritionState?.requestToken &&
    nutritionState.requestStartedAt &&
    now.getTime() - nutritionState.requestStartedAt.getTime() < 300000,
  );
  const acceptedDiet =
    nutritionEvent?.kind === "ACCEPTED" ? object(nutritionEvent.details) : {};
  const nutritionDueOn = validDay(acceptedDiet.reviewDueOn);
  const nutritionDraftOld =
    nutritionDraft.success &&
    now.getTime() - Date.parse(nutritionDraft.data.reviewedAt) > 14 * 86400000;
  const actions: HomeAction[] = [];
  const add = (action: HomeAction) => actions.push(action);
  const weeklyHref = `/plan/week?week=${week.weekStart}`;
  if (weekNeedsReview)
    add({
      id: "weekly-unavailable",
      title: "Saved weekly plan needs review",
      detail:
        "Check the current block and exercise availability before starting a planned workout.",
      href: weeklyHref,
      label: "Review week",
      tone: "due",
    });
  else if (weekly.draft)
    add({
      id: "weekly-draft",
      title: "Weekly plan awaiting approval",
      detail: "Review the saved proposal before using it for workouts.",
      href: weeklyHref,
      label: "Review week",
      tone: "neutral",
    });
  if (pendingVolume > 0)
    add({
      id: "volume",
      title: `${pendingVolume} volume ${pendingVolume === 1 ? "decision" : "decisions"} to review`,
      detail: "From the current block’s latest saved coach assessment.",
      href: "/ai-analysis/volume",
      label: "Review volume",
      tone: "neutral",
    });
  else if (current?.t3EvaluationStatus === "FAILED")
    add({
      id: "volume-failed",
      title: "Volume review did not finish",
      detail:
        "Open the volume coach to check the saved status and retry when ready.",
      href: "/ai-analysis/volume",
      label: "Open volume coach",
      tone: "due",
    });
  if (nutritionDraft.success && !nutritionBusy)
    add({
      id: "nutrition-draft",
      title: nutritionDraftOld
        ? "Saved nutrition review needs refreshing"
        : "Nutrition proposal to review",
      detail:
        "Open the coach to discuss or review it. Freshness is checked before acceptance.",
      href: "/plan/nutrition",
      label: "Open nutrition",
      tone: nutritionDraftOld ? "due" : "neutral",
    });
  else if (nutritionDueOn && nutritionDueOn <= today && !nutritionBusy)
    add({
      id: "nutrition-due",
      title: "Nutrition outcome review due",
      detail: `Your accepted plan set a review for ${dateLabel(nutritionDueOn)}.`,
      href: "/plan/nutrition",
      label: "Review outcomes",
      tone: "due",
    });
  if (photoDraft)
    add({
      id: "photo-draft",
      title: "Photo assessment to review",
      detail: `Saved for the photos taken ${dateLabel(photoTakenOn!)}.`,
      href: photoHref,
      label: "Review assessment",
      tone: "neutral",
    });
  else if (photoDueOn && photoDueOn <= today)
    add({
      id: "photo-due",
      title: "Photo check-in due",
      detail: `Your current phase schedule points to ${dateLabel(photoDueOn)}.`,
      href: "/physique",
      label: "Open check-in",
      tone: "due",
    });
  if (designDraft)
    add({
      id: "mesocycle-draft",
      title: "Continue your mesocycle draft",
      detail: `Last saved ${dateLabel(helsinkiDate(designDraft.updatedAt))}.`,
      href: `/plan/blocks?tab=next&id=${designDraft.id}`,
      label: "Open draft",
      tone: "neutral",
    });
  else if (review?.aiRecommendation && review.aiRecommendedAt)
    add({
      id: "mesocycle-review",
      title: "Saved next-mesocycle review",
      detail: `For ${selectedBlock!.name}, reviewed ${dateLabel(helsinkiDate(review.aiRecommendedAt))}.`,
      href: "/plan/blocks?tab=next",
      label: "Read review",
      tone: "neutral",
    });
  else if (
    block?.status === "Completed" ||
    (block?.status === "Current" && block.daysRemaining <= 7)
  )
    add({
      id: "mesocycle-next",
      title:
        block.status === "Completed"
          ? "Plan your next mesocycle"
          : "This mesocycle is nearing its planned end",
      detail: "Review outcomes and decide the next structure with the coach.",
      href: "/plan/blocks?tab=next",
      label: "Open planner",
      tone: "neutral",
    });

  return {
    today,
    program: program ? { id: program.id, name: program.name } : null,
    hero: {
      ...workoutHero({
        today,
        program,
        draft: draftSession,
        week: weekly,
        completed: recentCompleted,
      }),
      ...(weekNeedsReview && !draftSession ? { href: weeklyHref } : {}),
    },
    weekly: {
      ...weekly,
      href: weeklyHref,
      completedSessions: weekSessions.filter((s) => s.status === "COMPLETED")
        .length,
    },
    phase: phase
      ? {
          phase: phase.phase,
          startDate: phase.startDate,
          transitionCaution: phase.transitionCaution,
        }
      : null,
    block,
    actions,
    nutrition: {
      configured: Boolean(nutritionState),
      busy: nutritionBusy,
      hasDraft: nutritionDraft.success,
      draftOld: nutritionDraftOld,
      summary: text(acceptedDiet.summary, 330),
      acceptedOn:
        nutritionEvent?.kind === "ACCEPTED"
          ? helsinkiDate(nutritionEvent.createdAt)
          : null,
      dueOn: nutritionDueOn,
      dueLabel: dueLabel(nutritionDueOn, today),
      criteria: text(acceptedDiet.reviewCriteria, 220),
    },
    physique: {
      takenOn: photoTakenOn,
      photoCount: latestPhoto?._count.photos ?? 0,
      intervalDays: photoInterval,
      dueOn: photoDueOn,
      dueLabel: dueLabel(photoDueOn, today),
      hasDraft: Boolean(photoDraft),
      href: photoHref,
    },
    metrics: {
      bodyweight: metricOverview(metrics, "bodyweight", latestWeight, now),
      waist: metricOverview(metrics, "waist", latestWaist, now),
    },
  };
}
export type HomeDashboardData = Awaited<
  ReturnType<typeof getHomeDashboardData>
>;
