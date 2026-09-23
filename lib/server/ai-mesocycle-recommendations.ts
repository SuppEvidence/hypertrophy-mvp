"use server";

import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import {
  MesocycleMovementRecommendationSchema,
  MesocyclePriorityRecommendationSchema,
  MesocycleRecommendationSchema,
  type MesocycleRecommendation,
} from "@/lib/ai/mesocycle-recommendation-schema";
import { getOpenAIClient } from "@/lib/ai/openai";
import { getCoachingModelConfig, logCoachingModelUsage } from "@/lib/ai/coaching-models";
import { TRAINING_PROGRAMMING_POLICY } from "@/lib/ai/training-policy";
import {
  WorkoutAnalysisSchema,
  type WorkoutAnalysis,
} from "@/lib/ai/workout-analysis-schema";
import { prisma } from "@/lib/db/prisma";
import { getStimulusContribution } from "@/lib/workouts/stimulus";

const DAY_MS = 24 * 60 * 60 * 1000;

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function dateOnly(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function humanize(value: string | null | undefined) {
  if (!value) return null;
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
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

function symptomKey(location: string | null, side: string | null) {
  return `${location ?? "OTHER"}:${side ?? "NA"}`;
}

function parseExecutionCompromise(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { compromised: false, reasons: [] as string[] };
  }
  const raw = value as Record<string, unknown>;
  return {
    compromised: raw.executionCompromised === true,
    reasons: Array.isArray(raw.executionReasons)
      ? raw.executionReasons
          .filter((reason): reason is string => typeof reason === "string")
          .slice(0, 6)
      : [],
  };
}

type ExecutionAccumulator = {
  exerciseName: string;
  movementPatternName: string;
  completedSets: number;
  compromisedSets: number;
  affectedExposures: number;
  reasons: Set<string>;
};

function summarizeExecutionQuality(
  sessions: Array<{
    exercises: Array<{
      exercise: {
        name: string;
        movementGroup: { name: string };
      };
      sets: Array<{
        isCompleted: boolean;
        intensifierDetails?: unknown;
      }>;
    }>;
  }>,
) {
  const byExercise = new Map<string, ExecutionAccumulator>();
  let completedSets = 0;
  let compromisedSets = 0;
  let affectedExerciseExposures = 0;

  for (const session of sessions) {
    for (const exposure of session.exercises) {
      const completed = exposure.sets.filter((set) => set.isCompleted);
      if (completed.length === 0) continue;
      completedSets += completed.length;

      const compromised = completed.filter(
        (set) => parseExecutionCompromise(set.intensifierDetails).compromised,
      );
      if (compromised.length === 0) continue;

      compromisedSets += compromised.length;
      affectedExerciseExposures += 1;
      const key = `${exposure.exercise.name}:${exposure.exercise.movementGroup.name}`;
      const existing = byExercise.get(key) ?? {
        exerciseName: exposure.exercise.name,
        movementPatternName: exposure.exercise.movementGroup.name,
        completedSets: 0,
        compromisedSets: 0,
        affectedExposures: 0,
        reasons: new Set<string>(),
      };
      existing.completedSets += completed.length;
      existing.compromisedSets += compromised.length;
      existing.affectedExposures += 1;
      for (const set of compromised) {
        for (const reason of parseExecutionCompromise(set.intensifierDetails).reasons) {
          existing.reasons.add(reason);
        }
      }
      byExercise.set(key, existing);
    }
  }

  return {
    completedSets,
    compromisedSets,
    affectedExerciseExposures,
    compromisedSetPct:
      completedSets > 0 ? round((compromisedSets / completedSets) * 100, 1) : 0,
    byExercise: [...byExercise.values()]
      .sort((a, b) => b.compromisedSets - a.compromisedSets)
      .slice(0, 12)
      .map((item) => ({
        exerciseName: item.exerciseName,
        movementPatternName: item.movementPatternName,
        completedSets: item.completedSets,
        compromisedSets: item.compromisedSets,
        affectedExposures: item.affectedExposures,
        reasons: [...item.reasons],
      })),
  };
}

type SymptomAccumulator = {
  location: string;
  side: string | null;
  exposures: number;
  firstDate: Date;
  lastDate: Date;
  exercises: Set<string>;
  movementPatterns: Set<string>;
  impacts: Set<string>;
  notes: string[];
};

function summarizeSymptoms(
  sessions: Array<{
    performedAt: Date;
    exercises: Array<{
      painFlag: boolean;
      painLocation: string | null;
      painSide: string | null;
      painImpact: string | null;
      painNote: string | null;
      exercise: {
        name: string;
        movementGroup: { name: string };
      };
    }>;
  }>,
) {
  const byRegion = new Map<string, SymptomAccumulator>();

  for (const session of sessions) {
    for (const exposure of session.exercises) {
      if (!exposure.painFlag) continue;
      const key = symptomKey(exposure.painLocation, exposure.painSide);
      const existing = byRegion.get(key) ?? {
        location: humanize(exposure.painLocation) ?? "Other / unspecified",
        side:
          exposure.painSide && exposure.painSide !== "NA"
            ? humanize(exposure.painSide)
            : null,
        exposures: 0,
        firstDate: session.performedAt,
        lastDate: session.performedAt,
        exercises: new Set<string>(),
        movementPatterns: new Set<string>(),
        impacts: new Set<string>(),
        notes: [],
      };

      existing.exposures += 1;
      if (session.performedAt < existing.firstDate) existing.firstDate = session.performedAt;
      if (session.performedAt > existing.lastDate) existing.lastDate = session.performedAt;
      existing.exercises.add(exposure.exercise.name);
      existing.movementPatterns.add(exposure.exercise.movementGroup.name);
      if (exposure.painImpact) existing.impacts.add(humanize(exposure.painImpact) ?? exposure.painImpact);
      if (exposure.painNote && existing.notes.length < 4) existing.notes.push(exposure.painNote);
      byRegion.set(key, existing);
    }
  }

  return [...byRegion.values()]
    .sort((a, b) => b.exposures - a.exposures)
    .map((item) => {
      const spanDays = Math.max(
        0,
        Math.round((item.lastDate.getTime() - item.firstDate.getTime()) / DAY_MS),
      );
      const functionLimiting = item.impacts.has("Changed Or Stopped");
      const signalStrength =
        item.exposures >= 3 && (spanDays >= 7 || functionLimiting)
          ? "PERSISTENT"
          : item.exposures >= 2
            ? "REPEATED"
            : "ISOLATED";

      return {
        location: item.location,
        side: item.side,
        exposures: item.exposures,
        firstDate: dateOnly(item.firstDate),
        lastDate: dateOnly(item.lastDate),
        spanDays,
        signalStrength,
        affectedExercises: [...item.exercises],
        affectedMovementPatterns: [...item.movementPatterns],
        impacts: [...item.impacts],
        notes: item.notes,
      };
    });
}

async function buildMesocycleContext(userId: string, requestedMesocycleId?: string) {
  const program = await prisma.program.findFirst({
    where: { userId, isActive: true, isArchived: false },
    select: {
      id: true,
      name: true,
      activePhase: true,
      secondaryContribution: true,
      priorityMuscles: {
        select: { muscleId: true, muscle: { select: { name: true } } },
      },
    },
  });

  if (!program) {
    throw new Error("No active program is available for mesocycle recommendations.");
  }

  const mesocycle = await prisma.programMesocycle.findFirst({
    where: {
      userId,
      programId: program.id,
      isArchived: false,
      ...(requestedMesocycleId
        ? { id: requestedMesocycleId }
        : { actualEndDate: null, startDate: { lte: new Date() } }),
    },
    orderBy: { startDate: "desc" },
    include: {
      musclePriorities: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
      volumeTargets: {
        include: { muscle: true },
        orderBy: { muscle: { sortOrder: "asc" } },
      },
      movementVolumeTargets: {
        include: { movementGroup: true },
        orderBy: { movementGroup: { sortOrder: "asc" } },
      },
    },
  });

  if (!mesocycle || (!requestedMesocycleId && mesocycle.startDate.getTime() + mesocycle.lengthWeeks * 7 * DAY_MS <= Date.now())) {
    throw new Error("A current mesocycle is required for mesocycle recommendations.");
  }
  if (!mesocycle.t3ActivatedAt || mesocycle.musclePriorities.length === 0) {
    throw new Error("Configure T3 muscle priorities before a next-block review.");
  }

  const plannedEnd = new Date(
    mesocycle.startDate.getTime() + mesocycle.lengthWeeks * 7 * DAY_MS - DAY_MS,
  );
  const now = new Date();

  const [sessions, metrics, priorMesocycles] = await Promise.all([
    prisma.workoutSession.findMany({
      where: {
        userId,
        programId: program.id,
        mesocycleId: mesocycle.id,
        status: "COMPLETED",
      },
      orderBy: { performedAt: "asc" },
      select: {
        id: true,
        name: true,
        performedAt: true,
        aiAnalysis: true,
        exercises: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            painFlag: true,
            painLocation: true,
            painSide: true,
            painImpact: true,
            painNote: true,
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
            sets: {
              where: { isCompleted: true },
              orderBy: { setNumber: "asc" },
              select: {
                setNumber: true,
                isCompleted: true,
                intensifierDetails: true,
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
          gte: new Date(mesocycle.startDate.getTime() - 14 * DAY_MS),
          lte: new Date(plannedEnd.getTime() + 14 * DAY_MS),
        },
      },
      orderBy: { loggedAt: "asc" },
      take: 200,
      select: {
        loggedAt: true,
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
    prisma.programMesocycle.findMany({
      where: {
        userId,
        programId: program.id,
        actualEndDate: { not: null },
        startDate: { lt: mesocycle.startDate },
      },
      orderBy: { startDate: "desc" },
      take: 3,
      select: {
        id: true,
        name: true,
        phase: true,
        startDate: true,
        actualEndDate: true,
        aiRecommendation: true,
        musclePriorities: {
          select: { priority: true, coachTargetWeeklySets: true, muscle: { select: { name: true } } },
        },
        volumeTargets: {
          select: {
            targetSets: true,
            priorityLevel: true,
            muscle: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const effectiveNow = mesocycle.actualEndDate && mesocycle.actualEndDate < now
    ? mesocycle.actualEndDate : now;
  const elapsedDays = Math.max(
    1,
    Math.min(
      mesocycle.lengthWeeks * 7,
      Math.floor((effectiveNow.getTime() - mesocycle.startDate.getTime()) / DAY_MS) + 1,
    ),
  );
  const elapsedWeeks = Math.max(1, elapsedDays / 7);
  const totals = new Map<string, number>();

  for (const session of sessions) {
    for (const exposure of session.exercises) {
      const contribution = getStimulusContribution({ sets: exposure.sets });
      if (contribution.completed <= 0) continue;

      for (const link of exposure.exercise.primaryMuscles) {
        totals.set(
          link.muscleId,
          (totals.get(link.muscleId) ?? 0) + contribution.productiveEquivalent,
        );
      }
      for (const link of exposure.exercise.secondaryMuscles) {
        totals.set(
          link.muscleId,
          (totals.get(link.muscleId) ?? 0) +
            contribution.productiveEquivalent * Number(program.secondaryContribution),
        );
      }
    }
  }

  const startMetric = metrics.at(0) ?? null;
  const endMetric = metrics.at(-1) ?? null;
  const symptomSummary = summarizeSymptoms(sessions);
  const executionSummary = summarizeExecutionQuality(sessions);
  const analyzedSessions = sessions
    .map((session) => ({
      session,
      analysis: parseStoredAnalysis(session.aiAnalysis),
    }))
    .filter(
      (row): row is { session: (typeof sessions)[number]; analysis: WorkoutAnalysis } =>
        Boolean(row.analysis),
    );

  const historyMode =
    priorMesocycles.length === 0
      ? "FIRST_MESOCYCLE"
      : priorMesocycles.length === 1
        ? "LIMITED_HISTORY"
        : "ESTABLISHED_HISTORY";

  const context = {
    policy: TRAINING_PROGRAMMING_POLICY,
    historyMode,
    historyInterpretation:
      historyMode === "FIRST_MESOCYCLE"
        ? "No completed prior mesocycle is available for individualized dose-response comparison. Prefer HOLD under uncertainty and make only well-supported changes."
        : historyMode === "LIMITED_HISTORY"
          ? "One completed prior mesocycle exists. Historical response is supporting evidence, not a stable individualized dose-response model."
          : "Multiple completed prior mesocycles exist. Historical response can carry more weight when measurement and training exposure are comparable.",
    program: {
      id: program.id,
      name: program.name,
      phase: program.activePhase,
      priorityMuscles: program.priorityMuscles.map((row) => ({
        muscleId: row.muscleId,
        muscleName: row.muscle.name,
      })),
    },
    currentMesocycle: {
      id: mesocycle.id,
      name: mesocycle.name,
      phase: mesocycle.phase,
      startDate: dateOnly(mesocycle.startDate),
      plannedEndDate: dateOnly(plannedEnd),
      lengthWeeks: mesocycle.lengthWeeks,
      actualEndDate: dateOnly(mesocycle.actualEndDate),
      elapsedDays,
      completedSessions: sessions.length,
      analyzedSessions: analyzedSessions.length,
      analysisCoveragePct:
        sessions.length > 0
          ? round((analyzedSessions.length / sessions.length) * 100, 0)
          : 0,
      priorityAssignments: mesocycle.musclePriorities.map((target) => ({
        muscleName: target.muscle.name,
        priority: target.priority,
        baselineWeeklySets: finiteNumber(target.baselineWeeklySets),
        coachTargetWeeklySets: finiteNumber(target.coachTargetWeeklySets),
        usefulDoseRange: [finiteNumber(target.rangeMinimumSets), finiteNumber(target.rangeMaximumSets)],
        coachingStatus: target.coachingStatus,
        actualAverageWeeklyEffectiveSets: round((totals.get(target.muscleId) ?? 0) / elapsedWeeks, 1),
      })),
      legacyMuscleVolumes: mesocycle.volumeTargets.map((target) => ({
        muscleId: target.muscleId,
        muscleName: target.muscle.name,
        prescribedWeeklyTarget: finiteNumber(target.targetSets),
        minimumWeekly: finiteNumber(target.minimumSets),
        maximumWeekly: finiteNumber(target.maximumSets),
        priorityLevel: target.priorityLevel,
        actualAverageWeeklyEffectiveSets: round(
          (totals.get(target.muscleId) ?? 0) / elapsedWeeks,
          1,
        ),
      })),
      movementTargets: mesocycle.movementVolumeTargets.map((target) => ({
        movementPatternId: target.movementGroupId,
        movementPatternName: target.movementGroup.name,
        targetWeeklySets: finiteNumber(target.targetSets),
      })),
    },
    workoutEvidence: analyzedSessions.slice(-10).map(({ session, analysis }) => ({
      date: dateOnly(session.performedAt),
      workoutName: session.name,
      summary: analysis.workoutSummary,
      overallFatigueSignal: analysis.overallFatigueSignal,
      confidence: analysis.confidence,
      exercises: analysis.exerciseAssessments.map((exercise) => ({
        exerciseName: exercise.exerciseName,
        stimulus: exercise.overallStimulus,
        fatigueCost: exercise.overallFatigueCost,
        performanceDecay: exercise.performanceDecay,
        confidence: exercise.confidence,
        notableSignals: exercise.notableSignals,
      })),
      movementPatterns: analysis.movementPatternAssessments.map((pattern) => ({
        movementPatternName: pattern.movementPatternName,
        stimulus: pattern.overallStimulus,
        fatigueCost: pattern.overallFatigueCost,
        progressionSignal: pattern.progressionSignal,
        exerciseConsistency: pattern.exerciseConsistency,
        implementationInterpretation: pattern.implementationInterpretation,
        confidence: pattern.confidence,
        notableSignals: pattern.notableSignals,
      })),
    })),
    symptomEvidence: symptomSummary,
    executionEvidence: executionSummary,
    bodyMetrics: {
      start: metricSnapshot(startMetric),
      latest: metricSnapshot(endMetric),
      caution:
        "Circumference measures are noisy supporting evidence. Interpret with bodyweight, waist, training response, and measurement timing; do not infer precise muscle gain from a single change.",
    },
    priorMesocycles: priorMesocycles.map((prior) => ({
      name: prior.name,
      phase: prior.phase,
      startDate: dateOnly(prior.startDate),
      endDate: dateOnly(prior.actualEndDate),
      targets: prior.volumeTargets.map((target) => ({
        muscleName: target.muscle.name,
        targetSets: finiteNumber(target.targetSets),
        priorityLevel: target.priorityLevel,
      })),
      priorityAssignments: prior.musclePriorities.map((target) => ({
        muscleName: target.muscle.name,
        priority: target.priority,
        coachTargetWeeklySets: finiteNumber(target.coachTargetWeeklySets),
      })),
      hasStoredAiRecommendation: Boolean(prior.aiRecommendation),
    })),
  };

  return { context, mesocycleId: mesocycle.id };
}


function createRuntimeMesocycleSchema(context: Awaited<ReturnType<typeof buildMesocycleContext>>["context"]) {
  const muscleNames = [
    ...new Set(context.currentMesocycle.priorityAssignments.map((row) => row.muscleName)),
  ];
  const movementNames = [
    ...new Set([
      ...context.currentMesocycle.movementTargets.map((row) => row.movementPatternName),
      ...context.workoutEvidence.flatMap((workout) =>
        workout.movementPatterns.map((row) => row.movementPatternName),
      ),
    ]),
  ];

  if (muscleNames.length === 0) {
    return MesocycleRecommendationSchema;
  }

  const muscleNameSchema = z.enum(muscleNames as [string, ...string[]]);
  return MesocycleRecommendationSchema.extend({
    historyMode: z.literal(context.historyMode),
    nextPriorities: z
      .array(
        MesocyclePriorityRecommendationSchema.extend({
          muscleName: muscleNameSchema,
        }),
      )
      .max(10),
    ...(movementNames.length ? { movementRecommendations: z
      .array(
        MesocycleMovementRecommendationSchema.extend({
          movementPatternName: z.enum(movementNames as [string, ...string[]]),
        }),
      )
      .max(10) } : {}),
  });
}

const MESOCYCLE_SYSTEM_INSTRUCTIONS = `
You are the end-of-mesocycle hypertrophy programming advisor inside a training tracker.

Use the supplied deterministic data and the Programming Policy as hard guidance. Your job is to recommend the NEXT mesocycle, not to diagnose injury and not to rewrite the entire program without cause.

Decision rules:
- HOLD is the default when evidence is mixed, sparse, or already productive.
- T3 owns in-block numeric dose assessment and adjustment proposals. This next-block review recommends outcome priorities and qualitative movement/template implications only. Do not prescribe exact weekly set targets or independently redo T3's volume decisions.
- Movement-pattern actions may keep, shift emphasis, or review an exercise implementation for the NEXT block; they do not authorize a numeric volume change or edit a template.
- Each priority suggestion must name its current and suggested priority. KEEP means identical priorities; PROMOTE means more direct focus; DEMOTE means less direct focus. The athlete decides whether to adopt it for the next block.
- Priority status alone is not evidence that volume must increase.
- Current movement-pattern quality and historical response outrank generic volume theory.
- Do not infer individualized dose-response when historyMode is FIRST_MESOCYCLE. In that mode, make only conservative, well-supported changes and explicitly reflect lower confidence.
- Prefer changing an exercise implementation or reallocating a movement pattern before cutting an entire muscle's volume when symptoms are isolated to one exercise.
- Repeated symptoms across multiple exercises of the same movement pattern can justify a local movement-pattern volume reduction or substitution even when global recovery looks acceptable.
- A single mild symptom exposure is context, not automatic cause for a reduction.
- Repeated, persistent, worsening, or function-limiting symptom patterns can justify a precaution and may warrant professional clinical assessment. Do not name or diagnose a pathology.
- Symptom evidence outranks an otherwise marginal case for increasing the aggravating pattern.
- Treat repeated execution-compromised sets as context about exercise implementation and evidence quality. A heavier or higher-rep compromised set is not clean positive progression.
- A single compromised set is not a reason to change the next mesocycle. Repeated compromise across exposures, especially with the same reason or movement pattern, can justify setup/exercise review or reallocation when it aligns with other evidence.
- Do not interpret flat or noisy load/reps as a mesocycle failure when stimulus, execution, recovery, symptoms, and body-composition context are otherwise productive.
- Never prescribe a generic/global deload merely because one region or movement is problematic. Use local reductions/reallocation where appropriate.
- Circumference data are supporting evidence only and must be contextualized by bodyweight and waist.
- Return practical implications that can later be translated into template changes, but do not assume they have been applied automatically.
- Use only the exact muscle and movement-pattern names supplied in the context.
- Keep recommendations concise and specific. Avoid generic coaching filler.
- The athlete-facing summary should state the few conclusions that materially affect the next block. Do not enumerate every small performance fluctuation or create implied logbook targets. Internal reasoning can be richer than the visible explanation.
`;

export async function generateMesocycleRecommendationForUser(userId: string, requestedMesocycleId?: string) {
  const { context, mesocycleId } = await buildMesocycleContext(userId, requestedMesocycleId);
  const client = getOpenAIClient();
  const aiConfig = getCoachingModelConfig("T3_MESOCYCLE");
  const model = aiConfig.request.model;
  const requestStartedAt = Date.now();
  const runtimeSchema = createRuntimeMesocycleSchema(context);

  const response = await client.responses.parse({
    ...aiConfig.request,
    input: [
      { role: "system", content: MESOCYCLE_SYSTEM_INSTRUCTIONS },
      {
        role: "user",
        content: `Review the current mesocycle and recommend the next mesocycle using the supplied evidence. Respect the historyMode, symptom evidence, execution-quality evidence, recovery/fatigue, body metrics, and hypertrophy-first policy.\n\n${JSON.stringify(context)}`,
      },
    ],
    text: {
      format: zodTextFormat(
        runtimeSchema,
        "hypertrophy_mesocycle_recommendation",
      ),
    },
  }, aiConfig.options);
  logCoachingModelUsage(aiConfig, response, requestStartedAt);

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error(
      `OpenAI returned no parsed mesocycle recommendation. Response status: ${response.status}`,
    );
  }

  const assigned = new Map(context.currentMesocycle.priorityAssignments.map((row) => [row.muscleName, row.priority]));
  const rank = { INDIRECT_ONLY: 0, MAINTAIN: 1, GROW: 2, SPECIALIZE: 3 };
  const seen = new Set<string>();
  for (const row of parsed.nextPriorities) {
    if (!assigned.has(row.muscleName) || seen.has(row.muscleName)) {
      throw new Error("Next-block review returned an unknown or duplicate muscle.");
    }
    seen.add(row.muscleName);
    if (assigned.get(row.muscleName) !== row.currentPriority) {
      throw new Error("Next-block review changed the recorded current priority.");
    }
    const direction = Math.sign(rank[row.suggestedPriority] - rank[row.currentPriority]);
    if ((direction > 0 ? "PROMOTE" : direction < 0 ? "DEMOTE" : "KEEP") !== row.action) {
      throw new Error("Next-block priority direction is inconsistent.");
    }
  }

  await prisma.programMesocycle.update({
    where: { id: mesocycleId },
    data: {
      aiRecommendation: parsed as unknown as Prisma.InputJsonValue,
      aiRecommendationModel: model,
      aiRecommendedAt: new Date(),
    },
  });

  return parsed;
}

export async function maybeGenerateMesocycleRecommendationForUser(userId: string) {
  if (process.env.AUTO_MESOCYCLE_REVIEW_ENABLED === "false") return null;
  const program = await prisma.program.findFirst({
    where: { userId, isActive: true, isArchived: false },
    select: { id: true },
  });
  if (!program) return null;
  const now = new Date();
  const candidates = await prisma.programMesocycle.findMany({
    where: { userId, programId: program.id, isArchived: false, actualEndDate: null, startDate: { lte: now } },
    orderBy: { startDate: "desc" },
    take: 12,
    select: { id: true, startDate: true, lengthWeeks: true, aiRecommendedAt: true, t3ActivatedAt: true },
  });
  const current = candidates.find((row) => row.startDate.getTime() + row.lengthWeeks * 7 * DAY_MS > now.getTime());
  if (!current?.t3ActivatedAt) return null;
  if (current.aiRecommendedAt && now.getTime() - current.aiRecommendedAt.getTime() < 48 * 3_600_000) return null;
  const end = current.startDate.getTime() + current.lengthWeeks * 7 * DAY_MS;
  if (end - now.getTime() > 7 * DAY_MS) return null;
  const sessionCount = await prisma.workoutSession.count({
    where: { userId, mesocycleId: current.id, status: "COMPLETED",
      ...(current.aiRecommendedAt ? { completedAt: { gt: current.aiRecommendedAt } } : {}),
    },
  });
  if (sessionCount === 0) return null;
  return generateMesocycleRecommendationForUser(userId, current.id);
}

export async function getCurrentMesocycleRecommendationForUser(userId: string): Promise<{
  id: string;
  name: string;
  phase: string;
  startDate: Date;
  lengthWeeks: number;
  aiRecommendation: MesocycleRecommendation | null;
  aiRecommendationModel: string | null;
  aiRecommendedAt: Date | null;
} | null> {
  const program = await prisma.program.findFirst({
    where: { userId, isActive: true, isArchived: false },
    select: { id: true },
  });
  if (!program) return null;

  const current = await prisma.programMesocycle.findFirst({
    where: {
      userId,
      programId: program.id,
      isArchived: false,
      actualEndDate: null,
      startDate: { lte: new Date() },
    },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      phase: true,
      startDate: true,
      lengthWeeks: true,
      aiRecommendation: true,
      aiRecommendationModel: true,
      aiRecommendedAt: true,
    },
  });
  const currentIsActive = current && current.startDate.getTime() + current.lengthWeeks * 7 * DAY_MS > Date.now();
  const mesocycle = currentIsActive && current.aiRecommendation
    ? current
    : await prisma.programMesocycle.findFirst({
        where: { userId, programId: program.id, isArchived: false, aiRecommendedAt: { not: null } },
        orderBy: { startDate: "desc" },
        select: {
          id: true, name: true, phase: true, startDate: true, lengthWeeks: true,
          aiRecommendation: true, aiRecommendationModel: true, aiRecommendedAt: true,
        },
      }) ?? (currentIsActive ? current : null);
  if (!mesocycle) return null;
  const parsed = MesocycleRecommendationSchema.safeParse(mesocycle.aiRecommendation);

  return {
    ...mesocycle,
    aiRecommendation: parsed.success ? parsed.data : null,
  };
}
