"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { zodTextFormat } from "openai/helpers/zod";
import type { Prisma } from "@prisma/client";

import {
  ProgrammingRecommendationsSchema,
  StoredProgrammingOptionsSchema,
  type ProgrammingDecisionProposal,
  type ProgrammingOption,
  type ProgrammingRecommendations,
} from "@/lib/ai/programming-decision-schema";
import {
  TRAINING_POLICY_VERSION,
  TRAINING_PROGRAMMING_POLICY,
} from "@/lib/ai/training-policy";
import {
  WorkoutAnalysisSchema,
  type WorkoutAnalysis,
} from "@/lib/ai/workout-analysis-schema";
import { getOpenAIClient, getOpenAIModel } from "@/lib/ai/openai";
import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";
import { getDashboardData } from "@/lib/server/dashboard";
import { getStimulusContribution } from "@/lib/workouts/stimulus";

const RECENT_AI_SESSIONS = 10;
const DECISION_MEMORY_LIMIT = 24;
const HISTORICAL_MESOCYCLES = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

type AvailableExerciseType = "COMPOUND" | "ISOLATION";

type CandidatePattern = {
  movementPatternId: string;
  movementPatternName: string;
  primaryExerciseCount: number;
  secondaryExerciseCount: number;
  availableExerciseTypes: AvailableExerciseType[];
  exampleExercises: string[];
};

function isAvailableExerciseType(
  value: ProgrammingOption["preferredExerciseType"],
): value is AvailableExerciseType {
  return value === "COMPOUND" || value === "ISOLATION";
}

type DecisionValidationContext = {
  validMuscleIds: Set<string>;
  canonicalMuscleNames: Map<string, string>;
  validPatternsByMuscle: Map<string, Map<string, CandidatePattern>>;
  targetByMuscle: Map<
    string,
    {
      target: number | null;
      minimum: number | null;
      maximum: number | null;
    }
  >;
  currentMovementSets: Map<string, number>;
};

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function daysBetween(start: Date, end: Date) {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1);
}

function parseStoredAnalysis(value: unknown): WorkoutAnalysis | null {
  const current = WorkoutAnalysisSchema.safeParse(value);
  if (current.success) return current.data;

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const legacy = WorkoutAnalysisSchema.safeParse({
      ...(value as Record<string, unknown>),
      movementPatternAssessments: [],
    });
    if (legacy.success) return legacy.data;
  }

  return null;
}

function metricSnapshot(metric: {
  loggedAt: Date;
  logType: string;
  bodyweight: unknown;
  waist: unknown;
  chest: unknown;
  shoulders: unknown;
  arms: unknown;
  thighs: unknown;
  glutes: unknown;
  calves: unknown;
} | null) {
  if (!metric) return null;

  return {
    loggedAt: metric.loggedAt.toISOString(),
    logType: metric.logType,
    bodyweight: finiteNumber(metric.bodyweight),
    waist: finiteNumber(metric.waist),
    chest: finiteNumber(metric.chest),
    shoulders: finiteNumber(metric.shoulders),
    arms: finiteNumber(metric.arms),
    thighs: finiteNumber(metric.thighs),
    glutes: finiteNumber(metric.glutes),
    calves: finiteNumber(metric.calves),
  };
}

function closestMetric(
  metrics: Array<{
    loggedAt: Date;
    logType: string;
    bodyweight: unknown;
    waist: unknown;
    chest: unknown;
    shoulders: unknown;
    arms: unknown;
    thighs: unknown;
    glutes: unknown;
    calves: unknown;
  }>,
  target: Date,
  preferredType: "MESOCYCLE_START" | "MESOCYCLE_END",
) {
  const withinWindow = metrics.filter(
    (metric) => Math.abs(metric.loggedAt.getTime() - target.getTime()) <= 14 * DAY_MS,
  );
  const preferred = withinWindow.filter(
    (metric) => metric.logType === preferredType,
  );
  const candidates = preferred.length > 0 ? preferred : withinWindow;

  return (
    [...candidates].sort(
      (a, b) =>
        Math.abs(a.loggedAt.getTime() - target.getTime()) -
        Math.abs(b.loggedAt.getTime() - target.getTime()),
    )[0] ?? null
  );
}

function buildCandidatePatterns(
  exercises: Array<{
    name: string;
    movementGroupId: string;
    movementGroup: { name: string };
    primaryMuscles: Array<{ muscleId: string }>;
    secondaryMuscles: Array<{ muscleId: string }>;
  }>,
) {
  const byMuscle = new Map<string, Map<string, CandidatePattern>>();

  for (const exercise of exercises) {
    const type: "COMPOUND" | "ISOLATION" =
      exercise.secondaryMuscles.length > 0 ? "COMPOUND" : "ISOLATION";

    const add = (muscleId: string, role: "primary" | "secondary") => {
      const patternMap = byMuscle.get(muscleId) ?? new Map<string, CandidatePattern>();
      const existing = patternMap.get(exercise.movementGroupId) ?? {
        movementPatternId: exercise.movementGroupId,
        movementPatternName: exercise.movementGroup.name,
        primaryExerciseCount: 0,
        secondaryExerciseCount: 0,
        availableExerciseTypes: [],
        exampleExercises: [],
      };

      if (role === "primary") existing.primaryExerciseCount += 1;
      else existing.secondaryExerciseCount += 1;

      if (!existing.availableExerciseTypes.includes(type)) {
        existing.availableExerciseTypes.push(type);
      }
      if (
        existing.exampleExercises.length < 4 &&
        !existing.exampleExercises.includes(exercise.name)
      ) {
        existing.exampleExercises.push(exercise.name);
      }

      patternMap.set(exercise.movementGroupId, existing);
      byMuscle.set(muscleId, patternMap);
    };

    for (const link of exercise.primaryMuscles) add(link.muscleId, "primary");
    for (const link of exercise.secondaryMuscles) add(link.muscleId, "secondary");
  }

  return byMuscle;
}

function summarizeHistoricalMesocycle(args: {
  mesocycle: {
    id: string;
    name: string;
    phase: string;
    startDate: Date;
    lengthWeeks: number;
    actualEndDate: Date | null;
    volumeTargets: Array<{
      muscleId: string;
      targetSets: unknown;
      minimumSets: unknown;
      maximumSets: unknown;
      priorityLevel: number;
      muscle: { name: string };
    }>;
  };
  sessions: Array<{
    mesocycleId: string | null;
    exercises: Array<{
      exercise: {
        primaryMuscles: Array<{ muscleId: string }>;
        secondaryMuscles: Array<{ muscleId: string }>;
      };
      sets: Array<{
        setNumber: number;
        isCompleted: boolean;
        setType: { multiplier: unknown; isIntensifier: boolean };
      }>;
    }>;
  }>;
  secondaryContribution: number;
  metrics: Array<{
    loggedAt: Date;
    logType: string;
    bodyweight: unknown;
    waist: unknown;
    chest: unknown;
    shoulders: unknown;
    arms: unknown;
    thighs: unknown;
    glutes: unknown;
    calves: unknown;
  }>;
}) {
  const { mesocycle, sessions, secondaryContribution, metrics } = args;
  const totals = new Map<string, number>();

  for (const session of sessions) {
    if (session.mesocycleId !== mesocycle.id) continue;

    for (const sessionExercise of session.exercises) {
      const contribution = getStimulusContribution({ sets: sessionExercise.sets });
      if (contribution.completed === 0) continue;

      for (const link of sessionExercise.exercise.primaryMuscles) {
        totals.set(
          link.muscleId,
          (totals.get(link.muscleId) ?? 0) + contribution.productiveEquivalent,
        );
      }
      for (const link of sessionExercise.exercise.secondaryMuscles) {
        totals.set(
          link.muscleId,
          (totals.get(link.muscleId) ?? 0) +
            contribution.productiveEquivalent * secondaryContribution,
        );
      }
    }
  }

  const endDate =
    mesocycle.actualEndDate ??
    new Date(mesocycle.startDate.getTime() + mesocycle.lengthWeeks * 7 * DAY_MS - DAY_MS);
  const weeks = mesocycle.actualEndDate
    ? Math.max(1, daysBetween(mesocycle.startDate, mesocycle.actualEndDate) / 7)
    : Math.max(1, mesocycle.lengthWeeks);

  const startMetric = closestMetric(metrics, mesocycle.startDate, "MESOCYCLE_START");
  const endMetric = closestMetric(metrics, endDate, "MESOCYCLE_END");

  return {
    mesocycleId: mesocycle.id,
    name: mesocycle.name,
    phase: mesocycle.phase,
    startDate: dateOnly(mesocycle.startDate),
    endDate: dateOnly(endDate),
    approximateWeeks: round(weeks, 1),
    muscleDoses: mesocycle.volumeTargets.map((target) => ({
      muscleId: target.muscleId,
      muscleName: target.muscle.name,
      prescribedWeeklyTarget: finiteNumber(target.targetSets),
      minimum: finiteNumber(target.minimumSets),
      maximum: finiteNumber(target.maximumSets),
      priorityLevel: target.priorityLevel,
      actualAverageWeeklyEffectiveSets: round(
        (totals.get(target.muscleId) ?? 0) / weeks,
        1,
      ),
    })),
    startMetrics: metricSnapshot(startMetric),
    endMetrics: metricSnapshot(endMetric),
    circumferenceCaution:
      "Circumference changes are indirect/noisy and must be interpreted with bodyweight, waist, training response, and measurement availability.",
  };
}

async function buildProgrammingContext(userId: string) {
  const dashboard = await getDashboardData(userId);

  if (!dashboard.activeProgram) {
    throw new Error("No active program is available for AI programming decisions.");
  }
  if (!dashboard.mesocycle || dashboard.mesocycle.status !== "Current") {
    throw new Error("A current mesocycle is required before generating programming recommendations.");
  }

  const programId = dashboard.activeProgram.id;
  const mesocycleId = dashboard.mesocycle.id;

  const [program, mesocycle, recentSessions, priorDecisions, exerciseCatalog, historicalMesocycles] =
    await Promise.all([
      prisma.program.findFirst({
        where: { id: programId, userId },
        select: {
          id: true,
          name: true,
          secondaryContribution: true,
          priorityMuscles: {
            select: { muscleId: true, muscle: { select: { name: true } } },
          },
        },
      }),
      prisma.programMesocycle.findFirst({
        where: { id: mesocycleId, userId },
        include: {
          volumeTargets: {
            include: { muscle: true },
            orderBy: { muscle: { sortOrder: "asc" } },
          },
          movementVolumeTargets: {
            include: { movementGroup: true },
            orderBy: { movementGroup: { sortOrder: "asc" } },
          },
        },
      }),
      prisma.workoutSession.findMany({
        where: { userId, programId, status: "COMPLETED" },
        orderBy: { performedAt: "desc" },
        take: RECENT_AI_SESSIONS,
        select: {
          id: true,
          performedAt: true,
          aiAnalysis: true,
          exercises: {
            select: {
              id: true,
              exerciseId: true,
              exercise: {
                select: {
                  name: true,
                  movementGroupId: true,
                  movementGroup: { select: { name: true } },
                  primaryMuscles: {
                    select: { muscleId: true, muscle: { select: { name: true } } },
                  },
                  secondaryMuscles: {
                    select: { muscleId: true, muscle: { select: { name: true } } },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.aiProgrammingDecision.findMany({
        where: { userId, status: "SELECTED" },
        orderBy: { selectedAt: "desc" },
        take: DECISION_MEMORY_LIMIT,
        select: {
          createdAt: true,
          selectedAt: true,
          targetMuscleId: true,
          targetMuscleName: true,
          decisionSummary: true,
          confidence: true,
          evidence: true,
          options: true,
          recommendedOptionKey: true,
          selectedOptionKey: true,
          selectionReason: true,
          outcome: true,
        },
      }),
      prisma.exercise.findMany({
        where: {
          isActive: true,
          isArchived: false,
          OR: [{ userId: null }, { userId }],
        },
        select: {
          name: true,
          movementGroupId: true,
          movementGroup: { select: { name: true } },
          primaryMuscles: { select: { muscleId: true } },
          secondaryMuscles: { select: { muscleId: true } },
        },
      }),
      prisma.programMesocycle.findMany({
        where: {
          userId,
          programId,
          isArchived: false,
          NOT: { id: mesocycleId },
          startDate: { lt: new Date() },
        },
        orderBy: { startDate: "desc" },
        take: HISTORICAL_MESOCYCLES,
        include: {
          volumeTargets: {
            include: { muscle: true },
            orderBy: { muscle: { sortOrder: "asc" } },
          },
        },
      }),
    ]);

  if (!program || !mesocycle) {
    throw new Error("Active program or current mesocycle could not be loaded.");
  }

  const candidatePatternsByMuscle = buildCandidatePatterns(exerciseCatalog);
  const historicalMesocycleIds = historicalMesocycles.map((item) => item.id);
  const earliestHistoricalStart = historicalMesocycles.at(-1)?.startDate ?? mesocycle.startDate;

  const [historicalSessions, historicalMetrics] = await Promise.all([
    historicalMesocycleIds.length === 0
      ? Promise.resolve([])
      : prisma.workoutSession.findMany({
          where: {
            userId,
            status: "COMPLETED",
            mesocycleId: { in: historicalMesocycleIds },
          },
          select: {
            mesocycleId: true,
            exercises: {
              select: {
                exercise: {
                  select: {
                    primaryMuscles: { select: { muscleId: true } },
                    secondaryMuscles: { select: { muscleId: true } },
                  },
                },
                sets: {
                  where: { isCompleted: true },
                  orderBy: { setNumber: "asc" },
                  select: {
                    setNumber: true,
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
      where: {
        userId,
        isDraft: false,
        loggedAt: {
          gte: new Date(earliestHistoricalStart.getTime() - 14 * DAY_MS),
        },
      },
      orderBy: { loggedAt: "asc" },
      take: 160,
      select: {
        loggedAt: true,
        logType: true,
        bodyweight: true,
        waist: true,
        chest: true,
        shoulders: true,
        arms: true,
        thighs: true,
        glutes: true,
        calves: true,
      },
    }),
  ]);

  const mesocycleTargetMap = new Map(
    mesocycle.volumeTargets.map((target) => [
      target.muscleId,
      {
        target: finiteNumber(target.targetSets),
        minimum: finiteNumber(target.minimumSets),
        maximum: finiteNumber(target.maximumSets),
        priorityLevel: target.priorityLevel,
        muscleName: target.muscle.name,
      },
    ]),
  );

  const programPriorityIds = new Set(
    program.priorityMuscles.map((link) => link.muscleId),
  );

  const currentMuscleVolumes = dashboard.volumeRows.map((row) => {
    const mesocycleTarget = mesocycleTargetMap.get(row.muscleId);
    return {
      muscleId: row.muscleId,
      muscleName: row.muscleName,
      actualWindowEffectiveSets: row.effective,
      actualWeeklyEffectiveSets:
        dashboard.windowDays && dashboard.windowDays > 0
          ? round((row.effective * 7) / dashboard.windowDays, 1)
          : row.effective,
      dashboardWindowTarget: row.target,
      mesocycleTargetWeekly: mesocycleTarget?.target ?? null,
      minimumWeekly: mesocycleTarget?.minimum ?? null,
      maximumWeekly: mesocycleTarget?.maximum ?? null,
      mesocyclePriorityLevel: mesocycleTarget?.priorityLevel ?? 0,
      programPriority: programPriorityIds.has(row.muscleId),
      currentVolumeStatus: row.status,
      candidateMovementPatterns: [
        ...(candidatePatternsByMuscle.get(row.muscleId)?.values() ?? []),
      ],
    };
  });

  // Include mesocycle targets even if the current selected-window dashboard has
  // not yet accumulated a row for that muscle.
  for (const target of mesocycle.volumeTargets) {
    if (currentMuscleVolumes.some((row) => row.muscleId === target.muscleId)) continue;
    currentMuscleVolumes.push({
      muscleId: target.muscleId,
      muscleName: target.muscle.name,
      actualWindowEffectiveSets: 0,
      actualWeeklyEffectiveSets: 0,
      dashboardWindowTarget: null,
      mesocycleTargetWeekly: finiteNumber(target.targetSets),
      minimumWeekly: finiteNumber(target.minimumSets),
      maximumWeekly: finiteNumber(target.maximumSets),
      mesocyclePriorityLevel: target.priorityLevel,
      programPriority: programPriorityIds.has(target.muscleId),
      currentVolumeStatus:
        (finiteNumber(target.targetSets) ?? 0) > 0 ? "Below target" : "No target",
      candidateMovementPatterns: [
        ...(candidatePatternsByMuscle.get(target.muscleId)?.values() ?? []),
      ],
    });
  }

  const recentAiEvidence = recentSessions.flatMap((session) => {
    const analysis = parseStoredAnalysis(session.aiAnalysis);
    if (!analysis) return [];

    const metadata = new Map(
      session.exercises.map((sessionExercise) => [
        sessionExercise.id,
        sessionExercise.exercise,
      ]),
    );

    return [
      {
        performedAt: session.performedAt.toISOString(),
        overallFatigueSignal: analysis.overallFatigueSignal,
        confidence: analysis.confidence,
        movementPatterns: analysis.movementPatternAssessments,
        exercises: analysis.exerciseAssessments.map((assessment) => {
          const exercise = metadata.get(assessment.sessionExerciseId);
          return {
            exerciseName: assessment.exerciseName,
            exerciseId: session.exercises.find(
              (item) => item.id === assessment.sessionExerciseId,
            )?.exerciseId ?? null,
            movementPatternId: exercise?.movementGroupId ?? null,
            movementPatternName: exercise?.movementGroup.name ?? null,
            derivedExerciseType:
              exercise && exercise.secondaryMuscles.length > 0
                ? "COMPOUND"
                : "ISOLATION",
            primaryMuscles:
              exercise?.primaryMuscles.map((link) => ({
                muscleId: link.muscleId,
                muscleName: link.muscle.name,
              })) ?? [],
            secondaryMuscles:
              exercise?.secondaryMuscles.map((link) => ({
                muscleId: link.muscleId,
                muscleName: link.muscle.name,
              })) ?? [],
            stimulus: assessment.overallStimulus,
            fatigueCost: assessment.overallFatigueCost,
            performanceDecay: assessment.performanceDecay,
            confidence: assessment.confidence,
            notableSignals: assessment.notableSignals,
          };
        }),
      },
    ];
  });

  const historicalDoseResponse = historicalMesocycles.map((historical) =>
    summarizeHistoricalMesocycle({
      mesocycle: historical,
      sessions: historicalSessions,
      secondaryContribution: finiteNumber(program.secondaryContribution) ?? 0.5,
      metrics: historicalMetrics.map((metric) => ({
        ...metric,
        logType: String(metric.logType),
      })),
    }),
  );

  const currentMovementVolumes = mesocycle.movementVolumeTargets.map((target) => {
    const coverage = dashboard.movementCoverage.find(
      (row) => row.movementGroupId === target.movementGroupId,
    );
    return {
      movementPatternId: target.movementGroupId,
      movementPatternName: target.movementGroup.name,
      targetWeeklySets: finiteNumber(target.targetSets),
      actualWindowCompletedSets: coverage?.completedSets ?? 0,
      approximateWeeklyCompletedSets:
        dashboard.windowDays && dashboard.windowDays > 0
          ? round(((coverage?.completedSets ?? 0) * 7) / dashboard.windowDays, 1)
          : coverage?.completedSets ?? 0,
    };
  });

  const decisionMemory = priorDecisions.map((decision) => ({
    createdAt: decision.createdAt.toISOString(),
    selectedAt: decision.selectedAt?.toISOString() ?? null,
    targetMuscleId: decision.targetMuscleId,
    targetMuscleName: decision.targetMuscleName,
    decisionSummary: decision.decisionSummary,
    confidence: decision.confidence,
    evidence: decision.evidence,
    options: decision.options,
    aiPreferred: decision.recommendedOptionKey,
    userSelected: decision.selectedOptionKey,
    optionalUserReason: decision.selectionReason,
    laterOutcomeEvidence: decision.outcome,
  }));

  const targetByMuscle = new Map(
    currentMuscleVolumes.map((row) => [
      row.muscleId,
      {
        target: row.mesocycleTargetWeekly,
        minimum: row.minimumWeekly,
        maximum: row.maximumWeekly,
      },
    ]),
  );

  const canonicalMuscleNames = new Map(
    currentMuscleVolumes.map((row) => [row.muscleId, row.muscleName]),
  );

  return {
    context: {
      policyVersion: TRAINING_POLICY_VERSION,
      generatedAt: new Date().toISOString(),
      program: {
        id: program.id,
        name: program.name,
        secondaryContribution: finiteNumber(program.secondaryContribution) ?? 0.5,
      },
      mesocycle: {
        id: mesocycle.id,
        name: mesocycle.name,
        phase: mesocycle.phase,
        week: dashboard.mesocycle.currentWeek,
        lengthWeeks: mesocycle.lengthWeeks,
        startDate: dateOnly(mesocycle.startDate),
      },
      volumeWindowDays: dashboard.windowDays,
      currentMuscleVolumes,
      currentMovementVolumes,
      recoveryAndFatigue: dashboard.fatigueTrend,
      currentIntensifierUse: dashboard.intensifiers,
      bodyMetrics: dashboard.bodyMetrics,
      recentAiEvidence,
      historicalDoseResponse,
      decisionMemory,
      decisionMemoryGuidance:
        "Past selections are contextual preference evidence. Do not turn one choice into a permanent rule. Later outcome evidence, when present, outranks preference.",
    },
    validation: {
      validMuscleIds: new Set(currentMuscleVolumes.map((row) => row.muscleId)),
      canonicalMuscleNames,
      validPatternsByMuscle: candidatePatternsByMuscle,
      targetByMuscle,
      currentMovementSets: new Map(
        dashboard.movementCoverage.map((row) => [
          row.movementGroupId,
          dashboard.windowDays && dashboard.windowDays > 0
            ? round((row.completedSets * 7) / dashboard.windowDays, 1)
            : row.completedSets,
        ]),
      ),
    } satisfies DecisionValidationContext,
    mesocycleId: mesocycle.id,
    mesocycleName: mesocycle.name,
  };
}

const PROGRAMMING_SYSTEM_INSTRUCTIONS = `
You are the programming-decision reasoning layer for a hypertrophy training application.

${TRAINING_PROGRAMMING_POLICY}

CURRENT TASK
- Use the supplied current training state, recent AI workout analyses, movement-pattern evidence, recovery/fatigue, mesocycle priorities, historical dose-response evidence, and prior user selections.
- Produce 1 to 5 decision cards for the muscles where a programming decision is most relevant now. A decision card may recommend KEEP AS IS.
- Do not create noise by proposing changes for every muscle.
- Each decision may contain ZERO, ONE, or TWO active options. KEEP AS IS is always separately available.
- If KEEP AS IS is clearly best, it may be the preferred recommendation and the active options may be empty or only include a credible alternative worth considering.
- The two active options, when present, must be materially different (for example: increase via isolation vs reallocate existing volume toward a better movement pattern).
- Never provide more than two active options.
- Use exact targetMuscleId and movementPatternId values supplied in the context. Do not invent IDs or movement patterns.
- The preferred exercise type must exist among the supplied candidate movement-pattern implementations for that muscle unless EITHER is used.
- deltaWeeklySets describes the change to the CURRENT PRESCRIBED weekly muscle target. Keep changes small, normally 1-2 sets.
- INCREASE_VOLUME requires a positive deltaWeeklySets. DECREASE_VOLUME requires a negative deltaWeeklySets. REALLOCATE_VOLUME requires deltaWeeklySets = 0.
- movementChanges must sum to deltaWeeklySets for increase/decrease options and sum to 0 for reallocation options.
- Respect configured minimum and maximum weekly volume.
- For priority muscles, use EARLIER_IF_LOGICAL when added work should be protected from overlapping fatigue; otherwise KEEP_CURRENT.
- Do not recommend exact workout/template edits yet. The deterministic planner will handle legal implementation later.
- Do not recommend global deloads.
- Keep rationales evidence-based and concise.
`;

function validateOption(
  option: ProgrammingOption,
  proposal: ProgrammingDecisionProposal,
  validation: DecisionValidationContext,
) {
  if (option.action === "INCREASE_VOLUME" && option.deltaWeeklySets <= 0) {
    throw new Error("AI increase option returned a non-positive set change.");
  }
  if (option.action === "DECREASE_VOLUME" && option.deltaWeeklySets >= 0) {
    throw new Error("AI decrease option returned a non-negative set change.");
  }
  if (option.action === "REALLOCATE_VOLUME" && option.deltaWeeklySets !== 0) {
    throw new Error("AI reallocation option must keep total muscle volume unchanged.");
  }

  const movementTotal = option.movementChanges.reduce(
    (sum, movement) => sum + movement.deltaSets,
    0,
  );
  if (movementTotal !== option.deltaWeeklySets) {
    throw new Error("AI movement allocation does not match the proposed muscle-volume change.");
  }

  const target = validation.targetByMuscle.get(proposal.targetMuscleId);
  if (target?.target !== null && target?.target !== undefined) {
    const newTarget = target.target + option.deltaWeeklySets;
    if (target.minimum !== null && newTarget < target.minimum) {
      throw new Error("AI recommendation falls below the configured muscle-volume minimum.");
    }
    if (target.maximum !== null && newTarget > target.maximum) {
      throw new Error("AI recommendation exceeds the configured muscle-volume maximum.");
    }
  }

  const patterns = validation.validPatternsByMuscle.get(proposal.targetMuscleId);
  for (const movement of option.movementChanges) {
    const canonical = patterns?.get(movement.movementPatternId);
    if (!canonical) {
      throw new Error("AI recommendation returned a movement pattern that is not valid for the target muscle.");
    }
    if (
      movement.deltaSets < 0 &&
      (validation.currentMovementSets.get(movement.movementPatternId) ?? 0) <= 0
    ) {
      throw new Error("AI recommendation tried to remove volume from a movement pattern with no current exposure.");
    }
    movement.movementPatternName = canonical.movementPatternName;
  }

  const preferredExerciseType = option.preferredExerciseType;
  if (
    isAvailableExerciseType(preferredExerciseType) &&
    option.movementChanges.length > 0
  ) {
    const supportsType = option.movementChanges.some((movement) =>
      patterns
        ?.get(movement.movementPatternId)
        ?.availableExerciseTypes.includes(preferredExerciseType),
    );
    if (!supportsType) {
      throw new Error("AI preferred an exercise type that is unavailable for the proposed movement allocation.");
    }
  }
}

function validateRecommendations(
  parsed: ProgrammingRecommendations,
  validation: DecisionValidationContext,
) {
  for (const proposal of parsed.decisions) {
    if (!validation.validMuscleIds.has(proposal.targetMuscleId)) {
      throw new Error("AI programming recommendation returned an unknown targetMuscleId.");
    }

    proposal.targetMuscleName =
      validation.canonicalMuscleNames.get(proposal.targetMuscleId) ??
      proposal.targetMuscleName;

    const keys = new Set(proposal.options.map((option) => option.optionKey));
    if (keys.size !== proposal.options.length) {
      throw new Error("AI programming recommendation returned duplicate option keys.");
    }
    if (
      proposal.recommendedOptionKey !== "KEEP_AS_IS" &&
      !keys.has(proposal.recommendedOptionKey)
    ) {
      throw new Error("AI preferred an option that was not returned.");
    }

    for (const option of proposal.options) {
      validateOption(option, proposal, validation);
    }
  }
}

export async function generateProgrammingRecommendationsForUser(userId: string) {
  const { context, validation, mesocycleId, mesocycleName } =
    await buildProgrammingContext(userId);
  const client = getOpenAIClient();
  const model = getOpenAIModel();

  const response = await client.responses.parse({
    model,
    input: [
      { role: "system", content: PROGRAMMING_SYSTEM_INSTRUCTIONS },
      {
        role: "user",
        content: `Generate the current hypertrophy-programming decision cards. Use prior user selections as contextual preference evidence, but let current physiological evidence and later outcomes outrank preference.\n\n${JSON.stringify(context)}`,
      },
    ],
    text: {
      format: zodTextFormat(
        ProgrammingRecommendationsSchema,
        "hypertrophy_programming_recommendations",
      ),
    },
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error(
      `OpenAI returned no parsed programming recommendations. Response status: ${response.status}`,
    );
  }

  validateRecommendations(parsed, validation);

  const generationId = randomUUID();
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.aiProgrammingDecision.updateMany({
      where: { userId, status: "PENDING" },
      data: { status: "SUPERSEDED" },
    });

    for (const decision of parsed.decisions) {
      const currentMuscle = context.currentMuscleVolumes.find(
        (row) => row.muscleId === decision.targetMuscleId,
      );
      const contextSnapshot = {
        globalSummary: parsed.globalSummary,
        generatedAt: now.toISOString(),
        mesocycleName,
        muscle: currentMuscle ?? null,
        recoveryAndFatigue: context.recoveryAndFatigue,
        relevantRecentAiEvidence: context.recentAiEvidence.slice(0, 5),
      };

      await tx.aiProgrammingDecision.create({
        data: {
          userId,
          generationId,
          mesocycleId,
          policyVersion: TRAINING_POLICY_VERSION,
          model,
          decisionType: "MUSCLE_VOLUME",
          targetMuscleId: decision.targetMuscleId,
          targetMuscleName: decision.targetMuscleName,
          decisionSummary: decision.decisionSummary,
          confidence: decision.confidence,
          evidence: decision.evidence as unknown as Prisma.InputJsonValue,
          options: decision.options as unknown as Prisma.InputJsonValue,
          recommendedOptionKey: decision.recommendedOptionKey,
          keepAsIsRationale: decision.keepAsIsRationale,
          status: "PENDING",
          context: contextSnapshot as unknown as Prisma.InputJsonValue,
        },
      });
    }
  });

  return parsed;
}

export async function generateProgrammingRecommendationsAction() {
  const userId = await requireUserId();
  await generateProgrammingRecommendationsForUser(userId);
  revalidatePath("/ai-analysis");
}

export async function selectProgrammingDecisionAction(formData: FormData) {
  const userId = await requireUserId();
  const decisionId = String(formData.get("decisionId") ?? "");
  const selectionKey = String(formData.get("selectionKey") ?? "");
  const selectionReason = String(formData.get("selectionReason") ?? "").trim();

  if (!decisionId) throw new Error("Missing AI programming decision id.");
  if (!selectionKey) throw new Error("Missing AI programming selection.");

  const decision = await prisma.aiProgrammingDecision.findFirst({
    where: { id: decisionId, userId },
    select: { id: true, options: true, status: true },
  });
  if (!decision) throw new Error("AI programming decision not found.");

  const parsedOptions = StoredProgrammingOptionsSchema.safeParse(decision.options);
  if (!parsedOptions.success) {
    throw new Error("Stored AI programming options are invalid.");
  }

  const allowed = new Set([
    "KEEP_AS_IS",
    ...parsedOptions.data.map((option) => option.optionKey),
  ]);
  if (!allowed.has(selectionKey)) {
    throw new Error("Selected AI programming option is not available.");
  }

  await prisma.aiProgrammingDecision.update({
    where: { id: decision.id },
    data: {
      selectedOptionKey: selectionKey,
      selectionReason: selectionReason || null,
      selectedAt: new Date(),
      status: "SELECTED",
    },
  });

  revalidatePath("/ai-analysis");
}
