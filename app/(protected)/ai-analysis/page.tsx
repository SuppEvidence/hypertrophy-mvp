import type { ReactNode } from "react";
import { analyzeWorkoutAction } from "@/lib/server/ai-workout-analysis";
import {
  WorkoutAnalysisSchema,
  type WorkoutAnalysis,
} from "@/lib/ai/workout-analysis-schema";
import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type EvidenceReadiness = "NEW" | "EMERGING" | "USEFUL" | "STRONG";

type ExerciseEvidence = {
  comparableExposures: number;
  readiness: EvidenceReadiness;
};

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function readinessFor(exposures: number): EvidenceReadiness {
  if (exposures <= 0) return "NEW";
  if (exposures <= 2) return "EMERGING";
  if (exposures <= 5) return "USEFUL";
  return "STRONG";
}

function readinessClass(value: EvidenceReadiness) {
  if (value === "STRONG") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
  if (value === "USEFUL") {
    return "border-sky-400/30 bg-sky-400/10 text-sky-200";
  }
  if (value === "EMERGING") {
    return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  }
  return "border-slate-700 bg-slate-900 text-slate-400";
}

function stimulusClass(value: string) {
  if (value === "HIGH") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
  if (value === "MODERATE") {
    return "border-sky-400/30 bg-sky-400/10 text-sky-200";
  }
  if (value === "LOW") {
    return "border-slate-700 bg-slate-900 text-slate-300";
  }
  return "border-slate-700 bg-slate-900 text-slate-400";
}

function fatigueClass(value: string) {
  if (value === "HIGH") {
    return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  }
  if (value === "MODERATE") {
    return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  }
  if (value === "LOW") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
  return "border-slate-700 bg-slate-900 text-slate-400";
}

function decayClass(value: string) {
  if (value === "HIGHER_THAN_USUAL") {
    return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  }
  if (value === "LOWER_THAN_USUAL") {
    return "border-sky-400/30 bg-sky-400/10 text-sky-200";
  }
  if (value === "NORMAL_FOR_EXERCISE") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
  return "border-slate-700 bg-slate-900 text-slate-400";
}

function confidenceClass(value: string) {
  if (value === "HIGH") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
  if (value === "MODERATE") {
    return "border-sky-400/30 bg-sky-400/10 text-sky-200";
  }
  return "border-slate-700 bg-slate-900 text-slate-400";
}

function rirClass(value: string) {
  if (value === "CONSISTENT_WITH_REPORTED_RIR") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
  if (
    value === "LIKELY_CLOSER_TO_FAILURE" ||
    value === "LIKELY_FARTHER_FROM_FAILURE"
  ) {
    return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  }
  return "border-slate-700 bg-slate-900 text-slate-400";
}

function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span className={`rounded-full border px-2 py-1 text-xs ${className}`}>
      {children}
    </span>
  );
}

function Stage({
  title,
  description,
  active,
}: {
  title: string;
  description: string;
  active: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        active
          ? "border-emerald-400/20 bg-emerald-400/5"
          : "border-slate-800 bg-slate-950"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-100">{title}</p>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] ${
            active
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
              : "border-slate-700 text-slate-500"
          }`}
        >
          {active ? "Active" : "Not enabled"}
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

function AnalysisView({
  analysis,
  evidenceBySessionExerciseId,
}: {
  analysis: WorkoutAnalysis;
  evidenceBySessionExerciseId: Map<string, ExerciseEvidence>;
}) {
  const usefulOrStrong = analysis.exerciseAssessments.filter((exercise) => {
    const evidence = evidenceBySessionExerciseId.get(exercise.sessionExerciseId);
    return evidence?.readiness === "USEFUL" || evidence?.readiness === "STRONG";
  }).length;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Pill className={fatigueClass(analysis.overallFatigueSignal)}>
            Overall fatigue: {label(analysis.overallFatigueSignal)}
          </Pill>
          <Pill className={confidenceClass(analysis.confidence)}>
            AI confidence: {label(analysis.confidence)}
          </Pill>
          <Pill className="border-slate-700 bg-slate-900 text-slate-300">
            History useful+: {usefulOrStrong}/{analysis.exerciseAssessments.length}
          </Pill>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-200">
          {analysis.workoutSummary}
        </p>
      </div>

      {analysis.exerciseAssessments.map((exercise) => {
        const evidence = evidenceBySessionExerciseId.get(
          exercise.sessionExerciseId,
        ) ?? {
          comparableExposures: 0,
          readiness: "NEW" as const,
        };

        return (
          <div
            key={exercise.sessionExerciseId}
            className="rounded-xl border border-slate-800 bg-slate-950 p-3"
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-100">
                    {exercise.exerciseName}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {evidence.comparableExposures} comparable prior{" "}
                    {evidence.comparableExposures === 1
                      ? "exposure"
                      : "exposures"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Pill className={readinessClass(evidence.readiness)}>
                    History: {label(evidence.readiness)}
                  </Pill>
                  <Pill className={confidenceClass(exercise.confidence)}>
                    Confidence: {label(exercise.confidence)}
                  </Pill>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Stimulus
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-100">
                    {label(exercise.overallStimulus)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Fatigue cost
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-100">
                    {label(exercise.overallFatigueCost)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Performance decay
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-100">
                    {label(exercise.performanceDecay)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Pill className={stimulusClass(exercise.overallStimulus)}>
                  Stimulus: {label(exercise.overallStimulus)}
                </Pill>
                <Pill className={fatigueClass(exercise.overallFatigueCost)}>
                  Fatigue: {label(exercise.overallFatigueCost)}
                </Pill>
                <Pill className={decayClass(exercise.performanceDecay)}>
                  Decay: {label(exercise.performanceDecay)}
                </Pill>
              </div>

              <p className="text-xs leading-5 text-slate-400">
                {exercise.rationale}
              </p>

              {exercise.notableSignals.length > 0 ? (
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Evidence signals
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-400">
                    {exercise.notableSignals.map((signal, index) => (
                      <li key={index}>{signal}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <details className="group rounded-lg border border-slate-800 bg-slate-900/40">
                <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-medium text-slate-300">
                  <div className="flex items-center justify-between gap-2">
                    <span>Set-by-set analysis</span>
                    <span className="text-slate-500 group-open:hidden">
                      {exercise.sets.length} sets
                    </span>
                    <span className="hidden text-slate-500 group-open:inline">
                      Hide
                    </span>
                  </div>
                </summary>

                <div className="space-y-2 border-t border-slate-800 p-2.5">
                  {exercise.sets.map((set) => (
                    <div
                      key={set.setNumber}
                      className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-slate-200">
                          Set {set.setNumber}
                        </strong>
                        <Pill className={stimulusClass(set.stimulus)}>
                          Stimulus {label(set.stimulus)}
                        </Pill>
                        <Pill className={fatigueClass(set.fatigueCost)}>
                          Fatigue {label(set.fatigueCost)}
                        </Pill>
                        <Pill className={rirClass(set.rirPlausibility)}>
                          RIR {label(set.rirPlausibility)}
                        </Pill>
                        <Pill className={confidenceClass(set.confidence)}>
                          {label(set.confidence)} confidence
                        </Pill>
                      </div>
                      <p className="mt-2 leading-5 text-slate-400">
                        {set.rationale}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function AiAnalysisPage() {
  const userId = await requireUserId();

  const sessions = await prisma.workoutSession.findMany({
    where: { userId, status: "COMPLETED" },
    orderBy: { performedAt: "desc" },
    take: 8,
    select: {
      id: true,
      name: true,
      performedAt: true,
      aiAnalysis: true,
      aiAnalysisModel: true,
      aiAnalyzedAt: true,
      exercises: {
        select: {
          id: true,
          exerciseId: true,
        },
      },
    },
  });

  const exerciseIds = [
    ...new Set(
      sessions.flatMap((session) =>
        session.exercises.map((exercise) => exercise.exerciseId),
      ),
    ),
  ];

  const historicalExposures =
    exerciseIds.length === 0
      ? []
      : await prisma.workoutSessionExercise.findMany({
          where: {
            exerciseId: { in: exerciseIds },
            session: {
              userId,
              status: "COMPLETED",
            },
          },
          select: {
            exerciseId: true,
            session: {
              select: {
                performedAt: true,
              },
            },
            sets: {
              where: {
                isCompleted: true,
              },
              select: {
                weight: true,
                reps: true,
              },
            },
          },
        });

  function evidenceFor(exerciseId: string, performedAt: Date): ExerciseEvidence {
    const comparableExposures = historicalExposures.filter((exposure) => {
      if (exposure.exerciseId !== exerciseId) return false;
      if (exposure.session.performedAt >= performedAt) return false;

      const comparableSets = exposure.sets.filter(
        (set) => set.weight !== null && set.reps !== null,
      );

      return comparableSets.length >= 2;
    }).length;

    return {
      comparableExposures,
      readiness: readinessFor(comparableExposures),
    };
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">
          Training Advisor
        </h1>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          AI interpretation of workout stimulus, fatigue and exercise-specific
          performance. Programming changes remain disabled while the evidence
          layer is being validated.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <Stage
          title="Workout understanding"
          description="Set stimulus, fatigue, RIR plausibility and exercise-specific performance decay."
          active
        />
        <Stage
          title="Volume decisions"
          description="Muscle-level increase, hold or decrease decisions using recovery, priorities and dose-response history."
          active={false}
        />
        <Stage
          title="Mesocycle priorities"
          description="Priority recommendations using circumference trends, bodyweight, waist and historical training response."
          active={false}
        />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          History readiness
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div>
            <p className="font-medium text-slate-300">New</p>
            <p className="mt-0.5 text-slate-500">0 comparable exposures</p>
          </div>
          <div>
            <p className="font-medium text-amber-200">Emerging</p>
            <p className="mt-0.5 text-slate-500">1–2 exposures</p>
          </div>
          <div>
            <p className="font-medium text-sky-200">Useful</p>
            <p className="mt-0.5 text-slate-500">3–5 exposures</p>
          </div>
          <div>
            <p className="font-medium text-emerald-200">Strong</p>
            <p className="mt-0.5 text-slate-500">6+ exposures</p>
          </div>
        </div>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-400">
            No completed workouts available yet.
          </p>
        </Card>
      ) : null}

      {sessions.map((session) => {
        const parsed = WorkoutAnalysisSchema.safeParse(session.aiAnalysis);

        const evidenceBySessionExerciseId = new Map<string, ExerciseEvidence>(
          session.exercises.map((sessionExercise) => [
            sessionExercise.id,
            evidenceFor(sessionExercise.exerciseId, session.performedAt),
          ]),
        );

        return (
          <Card key={session.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-100">
                  {session.name}
                </h2>
                <p className="text-xs leading-5 text-slate-500">
                  {session.performedAt.toLocaleString()}
                  {session.aiAnalyzedAt
                    ? ` · analyzed ${session.aiAnalyzedAt.toLocaleString()}`
                    : ""}
                  {session.aiAnalysisModel
                    ? ` · ${session.aiAnalysisModel}`
                    : ""}
                </p>
              </div>

              <form action={analyzeWorkoutAction}>
                <input type="hidden" name="sessionId" value={session.id} />
                <Button variant="secondary">
                  {parsed.success ? "Re-analyze" : "Analyze workout"}
                </Button>
              </form>
            </div>

            {parsed.success ? (
              <AnalysisView
                analysis={parsed.data}
                evidenceBySessionExerciseId={evidenceBySessionExerciseId}
              />
            ) : (
              <p className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-500">
                No AI analysis stored for this workout yet.
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
