"use server";

import { revalidatePath } from "next/cache";
import { zodTextFormat } from "openai/helpers/zod";
import type { Prisma } from "@prisma/client";
import { getOpenAIClient, getOpenAIModel } from "@/lib/ai/openai";
import { WorkoutAnalysisSchema, type WorkoutAnalysis } from "@/lib/ai/workout-analysis-schema";
import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";

const HISTORY_EXPOSURES = 8;
const PATTERN_HISTORY_EXPOSURES = 60;
const MAX_BATCH_HISTORY_EXPOSURES = 500;

type CompletedSet = {
  setNumber: number;
  weight: unknown;
  reps: number | null;
  rir: unknown;
  startedAt?: Date | null;
  endedAt?: Date | null;
  intensifierDetails?: unknown;
  painFlag: boolean;
  painNote: string | null;
  setType: {
    name: string;
    slug: string;
    multiplier: unknown;
    isIntensifier: boolean;
  };
};

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function secondsBetween(start: Date | null | undefined, end: Date | null | undefined) {
  if (!start || !end) return null;
  const seconds = Math.round((end.getTime() - start.getTime()) / 1000);
  return seconds >= 0 ? seconds : null;
}

function estimatedPerformanceIndex(set: CompletedSet) {
  const weight = finiteNumber(set.weight);
  const reps = set.reps;
  const rir = finiteNumber(set.rir);
  if (weight === null || reps === null || reps <= 0 || weight <= 0) return null;

  // Epley-style within-exercise comparison, adjusted by observed RIR.
  // This is a trend feature, not a literal 1RM estimate for all exercise types.
  const estimatedFailureReps = Math.max(reps, reps + (rir ?? 0));
  return weight * (1 + estimatedFailureReps / 30);
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function normalizeIntensifierDetails(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      clusterCount: null,
      dropSets: [] as Array<{ weight: number | null; reps: number | null }>,
      filmed: false,
    };
  }

  const raw = value as Record<string, unknown>;
  const clusterCount = finiteNumber(raw.clusterCount);
  const dropSets = Array.isArray(raw.dropSets)
    ? raw.dropSets
        .map((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
          const drop = entry as Record<string, unknown>;
          return {
            weight: finiteNumber(drop.weight),
            reps: finiteNumber(drop.reps),
          };
        })
        .filter((entry): entry is { weight: number | null; reps: number | null } => entry !== null)
    : [];

  return {
    clusterCount: clusterCount === null ? null : Math.round(clusterCount),
    dropSets,
    filmed: raw.filmed === true,
  };
}

function serializeExposureSets(sets: CompletedSet[]) {
  const ordered = [...sets].sort((a, b) => a.setNumber - b.setNumber);
  const firstIndex = ordered.map(estimatedPerformanceIndex).find((value) => value !== null) ?? null;

  return ordered.map((set, index) => {
    const performanceIndex = estimatedPerformanceIndex(set);
    const previous = index > 0 ? ordered[index - 1] : null;
    const intensifier = normalizeIntensifierDetails(set.intensifierDetails);
    const previousIntensifier = previous
      ? normalizeIntensifierDetails(previous.intensifierDetails)
      : null;
    const relativeToFirstPct =
      performanceIndex !== null && firstIndex !== null && firstIndex > 0
        ? Math.round(((performanceIndex / firstIndex) - 1) * 1000) / 10
        : null;

    return {
      setNumber: set.setNumber,
      weight: finiteNumber(set.weight),
      reps: set.reps,
      observedRir: finiteNumber(set.rir),
      setType: set.setType.name,
      setTypeSlug: set.setType.slug,
      setMultiplier: finiteNumber(set.setType.multiplier),
      isIntensifier: set.setType.isIntensifier,
      painFlag: set.painFlag,
      painNote: set.painNote,
      filmed: intensifier.filmed,
      wholeSetDurationSeconds: intensifier.filmed
        ? null
        : secondsBetween(set.startedAt, set.endedAt),
      restAfterPreviousSetSeconds:
        previous && !intensifier.filmed && !previousIntensifier?.filmed
          ? secondsBetween(previous.endedAt, set.startedAt)
          : null,
      performanceIndex: performanceIndex === null ? null : Math.round(performanceIndex * 100) / 100,
      performanceChangeVsFirstPct: relativeToFirstPct,
      intensifier,
    };
  });
}

function historicalDecayBySetNumber(exposures: Array<{ sets: CompletedSet[] }>) {
  const bySet = new Map<number, number[]>();

  for (const exposure of exposures) {
    const serialized = serializeExposureSets(exposure.sets);
    for (const set of serialized) {
      if (set.setNumber <= 1 || set.performanceChangeVsFirstPct === null) continue;
      const values = bySet.get(set.setNumber) ?? [];
      values.push(set.performanceChangeVsFirstPct);
      bySet.set(set.setNumber, values);
    }
  }

  return [...bySet.entries()]
    .sort(([a], [b]) => a - b)
    .map(([setNumber, values]) => ({
      setNumber,
      medianPerformanceChangeVsFirstPct: median(values),
      observations: values.length,
    }));
}

function usablePerformanceSets(sets: CompletedSet[]) {
  return sets.filter((set) => {
    const weight = finiteNumber(set.weight);
    return weight !== null && weight > 0 && set.reps !== null && set.reps > 0;
  });
}

function firstUsableSet(sets: CompletedSet[]) {
  return [...sets]
    .sort((a, b) => a.setNumber - b.setNumber)
    .find((set) => estimatedPerformanceIndex(set) !== null) ?? null;
}

function recentVsEarlierPerformancePct(exposures: Array<{ sets: CompletedSet[] }>) {
  const ordered = exposures
    .map((exposure) => {
      const first = firstUsableSet(exposure.sets);
      return first ? estimatedPerformanceIndex(first) : null;
    })
    .filter((value): value is number => value !== null);

  // Avoid manufacturing a "trend" from only one or two exposures.
  if (ordered.length < 3) return null;

  const recent =
    ordered.length >= 6
      ? ordered.slice(0, 3)
      : ordered.slice(0, 1);

  const earlier =
    ordered.length >= 6
      ? ordered.slice(3, 6)
      : ordered.slice(1);

  const recentMedian = median(recent);
  const earlierMedian = median(earlier);

  if (recentMedian === null || earlierMedian === null || earlierMedian <= 0) return null;
  return Math.round((((recentMedian / earlierMedian) - 1) * 100) * 10) / 10;
}

function medianFirstSetRir(exposures: Array<{ sets: CompletedSet[] }>) {
  const values = exposures
    .map((exposure) => firstUsableSet(exposure.sets))
    .map((set) => (set ? finiteNumber(set.rir) : null))
    .filter((value): value is number => value !== null);

  return median(values);
}

const SYSTEM_INSTRUCTIONS = `
You are the workout-analysis reasoning layer for a hypertrophy training application.

Your job in this version is ONLY to assess set-level, exercise-level, and movement-pattern-level stimulus, fatigue, and progression from the supplied workout evidence. Do not recommend volume changes, program changes, deloads, exercise replacements, or mesocycle changes.

Core interpretation rules:
- Do not use a rigid rule such as "2 RIR is productive". Observed RIR is evidence, not ground truth.
- Evaluate RIR plausibility using exercise-specific history, weight/reps progression, within-exercise degradation, rest intervals, and failure exposures when available.
- Separate hypertrophic stimulus from fatigue cost. A set may be HIGH stimulus and HIGH fatigue.
- Compare performance decay primarily with the athlete's own history for the same exercise. Do not assume one universal acceptable decay rate.
- Whole-set timer duration covers the complete set. For myo-rep/rest-pause/EDT-style work it includes the activation set plus all clusters. Cluster count is post-activation clusters. For drop sets, drop portions are explicitly supplied.
- When filmed=true, camera handling contaminates set-duration and adjacent-rest timing. Those timing fields are intentionally omitted/null. Do not interpret that missing timing as fatigue or lower evidence quality. Continue to use weight, reps, observed RIR, pain, set type, intensifier details, and performance decay normally.
- Do not compare absolute set duration across exercises. For unilateral exercises, duration may consistently represent only one side and should be treated as an exercise-specific within-history signal.
- Primary muscles only means the app classifies the exercise as isolation. Any secondary muscle means compound. Treat this only as context; do not assume every compound is equally fatiguing.
- Pain is an adverse signal and should raise fatigue/uncertainty where appropriate, but do not diagnose injuries.
- Use exercise history over generic assumptions whenever enough history exists.
- Historical logging quality can differ by era. Older exposures may have weight/reps/RIR but no set timer, cluster count, or drop-set detail because those fields were added later. Still use the available weight/reps/RIR evidence rather than discarding the exposure.
- A historical exposure with at least one usable weight+reps set is valid evidence for performance progression. If RIR is also present, it can inform RIR plausibility/calibration.
- Within-exercise performance decay requires at least two usable weight+reps sets in the same historical exposure. Do not confuse a lack of decay-comparable exposures with a total lack of exercise history.
- If history or logging data is insufficient for a specific inference, say so through INSUFFICIENT_DATA / INSUFFICIENT_HISTORY / LOW confidence rather than inventing precision.
- Do not output pseudo-precise physiological scores or estimated "hypertrophy units".
- Movement-pattern progression is NOT a direct load comparison across different exercises or machines. Never equate absolute weights between exercises.
- Infer movement-pattern progression by synthesizing within-exercise normalized performance trends, repeated stimulus/fatigue signals, pain, RIR-supported history, and whether multiple exercise implementations point in the same direction.
- Distinguish a weak exercise implementation from a weak movement pattern. If one exercise is flat/poor while other exercises in the same pattern are progressing with good stimulus, prefer EXERCISE_SPECIFIC_LIMITATION over PATTERN_WIDE_STALL.
- A new exercise can improve rapidly from familiarization. Do not treat early performance gains on a newly introduced exercise as strong evidence of movement-pattern progression unless supported by broader pattern history.
- Return one movementPatternAssessment for every distinct movement pattern present in the current workout, preserving movementPatternId exactly as supplied.
- Keep rationales concise and tied directly to supplied evidence.
`;

async function buildWorkoutContext(sessionId: string, userId: string) {
  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId, status: "COMPLETED" },
    include: {
      exercises: {
        orderBy: { sortOrder: "asc" },
        include: {
          exercise: {
            include: {
              movementGroup: true,
              primaryMuscles: { include: { muscle: true } },
              secondaryMuscles: { include: { muscle: true } },
            },
          },
          sets: {
            where: { isCompleted: true },
            orderBy: { setNumber: "asc" },
            include: { setType: true },
          },
        },
      },
    },
  });

  if (!session) throw new Error("Completed workout not found.");

  const currentMovementPatterns = [
    ...new Map(
      session.exercises.map((sessionExercise) => [
        sessionExercise.exercise.movementGroup.id,
        {
          movementPatternId: sessionExercise.exercise.movementGroup.id,
          movementPatternName: sessionExercise.exercise.movementGroup.name,
          currentExercises: session.exercises
            .filter(
              (candidate) =>
                candidate.exercise.movementGroup.id ===
                sessionExercise.exercise.movementGroup.id,
            )
            .map((candidate) => ({
              sessionExerciseId: candidate.id,
              exerciseId: candidate.exerciseId,
              exerciseName: candidate.exercise.name,
              derivedExerciseType:
                candidate.exercise.secondaryMuscles.length > 0
                  ? "COMPOUND"
                  : "ISOLATION",
            })),
        },
      ]),
    ).values(),
  ];

  const movementPatternIds = currentMovementPatterns.map(
    (pattern) => pattern.movementPatternId,
  );

  // One recovery query + one batched history query. The previous implementation
  // performed separate history queries for every exercise and every movement
  // pattern in the workout.
  const [recentRecovery, historicalExposures] = await Promise.all([
    prisma.metricLog.findMany({
      where: {
        userId,
        isDraft: false,
        loggedAt: { lte: session.performedAt },
      },
      orderBy: { loggedAt: "desc" },
      take: 3,
      select: {
        loggedAt: true,
        sleepDuration: true,
        sleepQuality: true,
        stress: true,
        readiness: true,
        manualFatigue: true,
        sorenessJointIrritation: true,
      },
    }),
    movementPatternIds.length === 0
      ? Promise.resolve([])
      : prisma.workoutSessionExercise.findMany({
          where: {
            exercise: {
              movementGroupId: { in: movementPatternIds },
            },
            session: {
              userId,
              status: "COMPLETED",
              performedAt: { lt: session.performedAt },
            },
            sets: {
              some: {
                isCompleted: true,
                weight: { not: null },
                reps: { not: null },
              },
            },
          },
          orderBy: { session: { performedAt: "desc" } },
          take: MAX_BATCH_HISTORY_EXPOSURES,
          include: {
            session: { select: { performedAt: true } },
            exercise: {
              include: {
                movementGroup: true,
                secondaryMuscles: true,
              },
            },
            sets: {
              where: { isCompleted: true },
              orderBy: { setNumber: "asc" },
              include: { setType: true },
            },
          },
        }),
  ]);

  const historyByExercise = new Map<string, typeof historicalExposures>();
  const historyByPattern = new Map<string, typeof historicalExposures>();

  for (const exposure of historicalExposures) {
    const exerciseRows = historyByExercise.get(exposure.exerciseId) ?? [];
    exerciseRows.push(exposure);
    historyByExercise.set(exposure.exerciseId, exerciseRows);

    const patternId = exposure.exercise.movementGroupId;
    const patternRows = historyByPattern.get(patternId) ?? [];
    patternRows.push(exposure);
    historyByPattern.set(patternId, patternRows);
  }

  const usablePerformanceSetCount = (sets: CompletedSet[]) =>
    sets.filter((set) => {
      const weight = finiteNumber(set.weight);
      return weight !== null && weight > 0 && set.reps !== null && set.reps > 0;
    }).length;

  const exerciseContexts = session.exercises.map((sessionExercise) => {
    const previousExposures = (
      historyByExercise.get(sessionExercise.exerciseId) ?? []
    )
      .filter(
        (exposure) =>
          usablePerformanceSetCount(exposure.sets as CompletedSet[]) >= 1,
      )
      .slice(0, HISTORY_EXPOSURES);

    const decayComparableExposures = previousExposures.filter(
      (exposure) =>
        usablePerformanceSetCount(exposure.sets as CompletedSet[]) >= 2,
    );

    const rirSupportedExposures = previousExposures.filter((exposure) =>
      (exposure.sets as CompletedSet[]).some((set) => {
        const weight = finiteNumber(set.weight);
        const rir = finiteNumber(set.rir);
        return (
          weight !== null &&
          weight > 0 &&
          set.reps !== null &&
          set.reps > 0 &&
          rir !== null
        );
      }),
    );

    return {
      sessionExerciseId: sessionExercise.id,
      exerciseId: sessionExercise.exerciseId,
      exerciseName: sessionExercise.exercise.name,
      movementPattern: sessionExercise.exercise.movementGroup.name,
      derivedExerciseType:
        sessionExercise.exercise.secondaryMuscles.length > 0
          ? "COMPOUND"
          : "ISOLATION",
      primaryMuscles: sessionExercise.exercise.primaryMuscles.map(
        (link) => link.muscle.name,
      ),
      secondaryMuscles: sessionExercise.exercise.secondaryMuscles.map(
        (link) => link.muscle.name,
      ),
      currentExposure: {
        performedAt: session.performedAt.toISOString(),
        sets: serializeExposureSets(sessionExercise.sets as CompletedSet[]),
      },
      history: {
        performanceExposureCount: previousExposures.length,
        decayComparableExposureCount: decayComparableExposures.length,
        rirSupportedExposureCount: rirSupportedExposures.length,
        historicalMedianDecayBySetNumber: historicalDecayBySetNumber(
          decayComparableExposures as Array<{ sets: CompletedSet[] }>,
        ),
        previousExposures: previousExposures.map((exposure) => ({
          performedAt: exposure.session.performedAt.toISOString(),
          sets: serializeExposureSets(exposure.sets as CompletedSet[]),
        })),
      },
    };
  });

  const movementPatternContexts = currentMovementPatterns.map((pattern) => {
    const patternHistory = (
      historyByPattern.get(pattern.movementPatternId) ?? []
    ).slice(0, PATTERN_HISTORY_EXPOSURES);

    const byExercise = new Map<
      string,
      {
        exerciseId: string;
        exerciseName: string;
        derivedExerciseType: "COMPOUND" | "ISOLATION";
        exposures: Array<{
          performedAt: string;
          sets: CompletedSet[];
        }>;
      }
    >();

    for (const exposure of patternHistory) {
      const existing = byExercise.get(exposure.exerciseId) ?? {
        exerciseId: exposure.exerciseId,
        exerciseName: exposure.exercise.name,
        derivedExerciseType:
          exposure.exercise.secondaryMuscles.length > 0
            ? ("COMPOUND" as const)
            : ("ISOLATION" as const),
        exposures: [],
      };

      existing.exposures.push({
        performedAt: exposure.session.performedAt.toISOString(),
        sets: exposure.sets as CompletedSet[],
      });
      byExercise.set(exposure.exerciseId, existing);
    }

    const exerciseHistories = [...byExercise.values()].map((exercise) => {
      const decayComparable = exercise.exposures.filter(
        (exposure) => usablePerformanceSets(exposure.sets).length >= 2,
      );

      const rirSupportedExposureCount = exercise.exposures.filter((exposure) =>
        usablePerformanceSets(exposure.sets).some(
          (set) => finiteNumber(set.rir) !== null,
        ),
      ).length;

      const painExposureCount = exercise.exposures.filter((exposure) =>
        exposure.sets.some((set) => set.painFlag),
      ).length;

      const latestExposure = exercise.exposures[0] ?? null;
      const latestFirstSet = latestExposure
        ? firstUsableSet(latestExposure.sets)
        : null;
      const latestFirstSetPerformance = latestFirstSet
        ? estimatedPerformanceIndex(latestFirstSet)
        : null;

      return {
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        derivedExerciseType: exercise.derivedExerciseType,
        performanceExposureCount: exercise.exposures.length,
        decayComparableExposureCount: decayComparable.length,
        rirSupportedExposureCount,
        painExposureCount,
        mostRecentExposureAt: latestExposure?.performedAt ?? null,
        latestFirstSetPerformanceIndex:
          latestFirstSetPerformance === null
            ? null
            : Math.round(latestFirstSetPerformance * 100) / 100,
        recentVsEarlierFirstSetPerformancePct:
          recentVsEarlierPerformancePct(exercise.exposures),
        recentMedianFirstSetObservedRir: medianFirstSetRir(
          exercise.exposures.slice(0, 5),
        ),
        historicalMedianDecayBySetNumber:
          historicalDecayBySetNumber(decayComparable),
      };
    });

    return {
      ...pattern,
      history: {
        totalPerformanceExposures: patternHistory.length,
        historicalExerciseCount: exerciseHistories.length,
        exerciseHistories,
      },
    };
  });

  return {
    workout: {
      sessionId: session.id,
      name: session.name,
      performedAt: session.performedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
    },
    recentRecovery: recentRecovery.map((entry) => ({
      loggedAt: entry.loggedAt.toISOString(),
      sleepDuration: finiteNumber(entry.sleepDuration),
      sleepQuality: entry.sleepQuality,
      stress: entry.stress,
      readiness: entry.readiness,
      manualFatigue: entry.manualFatigue,
      sorenessJointIrritation: entry.sorenessJointIrritation,
    })),
    movementPatterns: movementPatternContexts,
    exercises: exerciseContexts,
  };
}

export async function analyzeCompletedWorkoutForUser(sessionId: string, userId: string): Promise<WorkoutAnalysis> {
  const context = await buildWorkoutContext(sessionId, userId);
  const client = getOpenAIClient();
  const model = getOpenAIModel();

  const response = await client.responses.parse({
    model,
    input: [
      { role: "system", content: SYSTEM_INSTRUCTIONS },
      {
        role: "user",
        content: `Analyze this completed workout. Return one exerciseAssessment for every exercise and one set assessment for every completed set. Preserve each sessionExerciseId exactly as supplied.\n\n${JSON.stringify(context)}`,
      },
    ],
    text: {
      format: zodTextFormat(WorkoutAnalysisSchema, "hypertrophy_workout_analysis"),
    },
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error(`OpenAI returned no parsed workout analysis. Response status: ${response.status}`);
  }

  const validSessionExerciseIds = new Set(context.exercises.map((exercise) => exercise.sessionExerciseId));
  for (const assessment of parsed.exerciseAssessments) {
    if (!validSessionExerciseIds.has(assessment.sessionExerciseId)) {
      throw new Error("AI analysis returned an unknown sessionExerciseId.");
    }
  }

  const validMovementPatternIds = new Set(
    context.movementPatterns.map((pattern) => pattern.movementPatternId),
  );
  for (const assessment of parsed.movementPatternAssessments) {
    if (!validMovementPatternIds.has(assessment.movementPatternId)) {
      throw new Error("AI analysis returned an unknown movementPatternId.");
    }
  }

  await prisma.workoutSession.update({
    where: { id: sessionId },
    data: {
      aiAnalysis: parsed as unknown as Prisma.InputJsonValue,
      aiAnalysisModel: model,
      aiAnalyzedAt: new Date(),
    },
  });

  return parsed;
}

export async function analyzeWorkoutAction(formData: FormData) {
  const userId = await requireUserId();
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId) throw new Error("Missing workout session id.");

  await analyzeCompletedWorkoutForUser(sessionId, userId);
  revalidatePath("/ai-analysis");
}
