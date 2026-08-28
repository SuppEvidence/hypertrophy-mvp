"use server";

import { revalidatePath } from "next/cache";
import { zodTextFormat } from "openai/helpers/zod";
import type { Prisma } from "@prisma/client";
import { getOpenAIClient, getOpenAIModel } from "@/lib/ai/openai";
import { WorkoutAnalysisSchema, type WorkoutAnalysis } from "@/lib/ai/workout-analysis-schema";
import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";

const HISTORY_EXPOSURES = 8;

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
    return { clusterCount: null, dropSets: [] as Array<{ weight: number | null; reps: number | null }> };
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
  };
}

function serializeExposureSets(sets: CompletedSet[]) {
  const ordered = [...sets].sort((a, b) => a.setNumber - b.setNumber);
  const firstIndex = ordered.map(estimatedPerformanceIndex).find((value) => value !== null) ?? null;

  return ordered.map((set, index) => {
    const performanceIndex = estimatedPerformanceIndex(set);
    const previous = index > 0 ? ordered[index - 1] : null;
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
      wholeSetDurationSeconds: secondsBetween(set.startedAt, set.endedAt),
      restAfterPreviousSetSeconds: previous ? secondsBetween(previous.endedAt, set.startedAt) : null,
      performanceIndex: performanceIndex === null ? null : Math.round(performanceIndex * 100) / 100,
      performanceChangeVsFirstPct: relativeToFirstPct,
      intensifier: normalizeIntensifierDetails(set.intensifierDetails),
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

const SYSTEM_INSTRUCTIONS = `
You are the workout-analysis reasoning layer for a hypertrophy training application.

Your job in this version is ONLY to assess set-level and exercise-level stimulus and fatigue from the supplied workout evidence. Do not recommend volume changes, program changes, deloads, exercise replacements, or mesocycle changes.

Core interpretation rules:
- Do not use a rigid rule such as "2 RIR is productive". Observed RIR is evidence, not ground truth.
- Evaluate RIR plausibility using exercise-specific history, weight/reps progression, within-exercise degradation, rest intervals, and failure exposures when available.
- Separate hypertrophic stimulus from fatigue cost. A set may be HIGH stimulus and HIGH fatigue.
- Compare performance decay primarily with the athlete's own history for the same exercise. Do not assume one universal acceptable decay rate.
- Whole-set timer duration covers the complete set. For myo-rep/rest-pause/EDT-style work it includes the activation set plus all clusters. Cluster count is post-activation clusters. For drop sets, drop portions are explicitly supplied.
- Primary muscles only means the app classifies the exercise as isolation. Any secondary muscle means compound. Treat this only as context; do not assume every compound is equally fatiguing.
- Pain is an adverse signal and should raise fatigue/uncertainty where appropriate, but do not diagnose injuries.
- Use exercise history over generic assumptions whenever enough history exists.
- If history or logging data is insufficient, say so through INSUFFICIENT_DATA / INSUFFICIENT_HISTORY / LOW confidence rather than inventing precision.
- Do not output pseudo-precise physiological scores or estimated "hypertrophy units".
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

  const recentRecovery = await prisma.metricLog.findMany({
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
  });

  const exerciseContexts = await Promise.all(
    session.exercises.map(async (sessionExercise) => {
      const previousExposures = await prisma.workoutSessionExercise.findMany({
        where: {
          exerciseId: sessionExercise.exerciseId,
          session: {
            userId,
            status: "COMPLETED",
            performedAt: { lt: session.performedAt },
          },
        },
        orderBy: { session: { performedAt: "desc" } },
        take: HISTORY_EXPOSURES,
        include: {
          session: { select: { performedAt: true } },
          sets: {
            where: { isCompleted: true },
            orderBy: { setNumber: "asc" },
            include: { setType: true },
          },
        },
      });

      return {
        sessionExerciseId: sessionExercise.id,
        exerciseId: sessionExercise.exerciseId,
        exerciseName: sessionExercise.exercise.name,
        movementPattern: sessionExercise.exercise.movementGroup.name,
        derivedExerciseType:
          sessionExercise.exercise.secondaryMuscles.length > 0 ? "COMPOUND" : "ISOLATION",
        primaryMuscles: sessionExercise.exercise.primaryMuscles.map((link) => link.muscle.name),
        secondaryMuscles: sessionExercise.exercise.secondaryMuscles.map((link) => link.muscle.name),
        currentExposure: {
          performedAt: session.performedAt.toISOString(),
          sets: serializeExposureSets(sessionExercise.sets as CompletedSet[]),
        },
        history: {
          exposureCount: previousExposures.length,
          historicalMedianDecayBySetNumber: historicalDecayBySetNumber(
            previousExposures as Array<{ sets: CompletedSet[] }>,
          ),
          previousExposures: previousExposures.map((exposure) => ({
            performedAt: exposure.session.performedAt.toISOString(),
            sets: serializeExposureSets(exposure.sets as CompletedSet[]),
          })),
        },
      };
    }),
  );

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
