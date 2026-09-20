import { Card } from "@/components/ui/Card";
import {
  WorkoutAnalysisSchema,
  type WorkoutAnalysis,
} from "@/lib/ai/workout-analysis-schema";
import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";
import { analyzeAdvisorWorkoutAction } from "@/lib/server/ai-advisor-actions";

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
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

function pillClass(value: string) {
  if (["HIGH", "POSITIVE", "PATTERN_PRODUCTIVE"].includes(value)) {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
  }
  if (["MODERATE", "STABLE", "NORMAL_FOR_EXERCISE"].includes(value)) {
    return "border-sky-400/25 bg-sky-400/10 text-sky-200";
  }
  if (
    [
      "MIXED",
      "EXERCISE_SPECIFIC_LIMITATION",
      "HIGHER_THAN_USUAL",
    ].includes(value)
  ) {
    return "border-amber-400/25 bg-amber-400/10 text-amber-200";
  }
  if (["NEGATIVE", "PATTERN_WIDE_STALL"].includes(value)) {
    return "border-rose-400/25 bg-rose-400/10 text-rose-200";
  }
  return "border-slate-700 bg-slate-900 text-slate-400";
}

function Pill({ value, prefix }: { value: string; prefix?: string }) {
  return (
    <span
      className={`rounded-full border px-2 py-1 text-[11px] ${pillClass(value)}`}
    >
      {prefix ? `${prefix}: ` : ""}
      {label(value)}
    </span>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function WorkoutAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const userId = await requireUserId();
  const sessions = await prisma.workoutSession.findMany({
    where: { userId, status: "COMPLETED" },
    orderBy: { performedAt: "desc" },
    take: 10,
    select: {
      id: true,
      name: true,
      performedAt: true,
      aiAnalysis: true,
      aiAnalysisModel: true,
      aiAnalyzedAt: true,
    },
  });

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2.5 text-sm text-rose-200">
          {error}
        </div>
      ) : null}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            Workout analysis
          </h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            Concise hypertrophy coaching first. Performance details stay collapsed unless you deliberately want to inspect them.
          </p>
        </div>
        <span className="shrink-0 text-xs text-slate-600">
          Latest {sessions.length}
        </span>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-400">
            Complete a workout before running analysis.
          </p>
        </Card>
      ) : (
        sessions.map((session) => {
          const analysis = parseStoredAnalysis(session.aiAnalysis);

          return (
            <Card key={session.id} className="overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-100">{session.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(session.performedAt)}
                    {session.aiAnalyzedAt
                      ? ` · analyzed ${formatDate(session.aiAnalyzedAt)}`
                      : " · not analyzed"}
                  </p>
                </div>

                <form action={analyzeAdvisorWorkoutAction}>
                  <input type="hidden" name="sessionId" value={session.id} />
                  <button
                    type="submit"
                    className="min-h-10 rounded-xl border border-orange-400/25 bg-orange-500/10 px-3 text-xs font-semibold text-orange-200 transition hover:bg-orange-500/15"
                  >
                    {analysis ? "Re-analyze" : "Analyze workout"}
                  </button>
                </form>
              </div>

              {analysis ? (
                <div className="mt-4">
                  <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/[0.04] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-300/70">
                      Coach read
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-200">
                      {analysis.workoutSummary}
                    </p>
                  </div>

                  <details className="mt-4 border-t border-white/[0.06] pt-3">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Analysis detail · movement patterns · {analysis.movementPatternAssessments.length}
                    </summary>
                    <div className="mt-3 space-y-2">
                      {analysis.movementPatternAssessments.length === 0 ? (
                        <p className="text-xs leading-5 text-slate-500">
                          This analysis predates movement-pattern synthesis.
                          Re-analyze it to add this layer.
                        </p>
                      ) : (
                        analysis.movementPatternAssessments.map((pattern) => (
                          <div
                            key={pattern.movementPatternId}
                            className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-100">
                                {pattern.movementPatternName}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                <Pill value={pattern.overallStimulus} prefix="Stim" />
                                <Pill value={pattern.overallFatigueCost} prefix="Fatigue" />
                                <Pill value={pattern.progressionSignal} prefix="Trend" />
                              </div>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-slate-400">
                              {pattern.rationale}
                            </p>
                            {pattern.notableSignals.length > 0 ? (
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-500">
                                {pattern.notableSignals.map((signal, signalIndex) => (
                                  <li key={signalIndex}>{signal}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </details>

                  <details className="mt-3 border-t border-white/[0.06] pt-3">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Analysis detail · exercises · {analysis.exerciseAssessments.length}
                    </summary>
                    <div className="mt-3 space-y-2">
                      {analysis.exerciseAssessments.map((exercise) => (
                        <details
                          key={exercise.sessionExerciseId}
                          className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                        >
                          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-100">
                                {exercise.exerciseName}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                <Pill value={exercise.overallStimulus} prefix="Stim" />
                                <Pill value={exercise.overallFatigueCost} prefix="Fatigue" />
                                <Pill value={exercise.performanceDecay} prefix="Decay" />
                              </div>
                            </div>
                          </summary>

                          <p className="mt-3 text-xs leading-5 text-slate-400">
                            {exercise.rationale}
                          </p>
                          {exercise.notableSignals.length > 0 ? (
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-500">
                              {exercise.notableSignals.map((signal, signalIndex) => (
                                <li key={signalIndex}>{signal}</li>
                              ))}
                            </ul>
                          ) : null}

                          <details className="mt-3 rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
                            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Set reasoning · {exercise.sets.length}
                            </summary>
                            <div className="mt-2 space-y-2">
                              {exercise.sets.map((set) => (
                                <div
                                  key={set.setNumber}
                                  className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5"
                                >
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-xs font-semibold text-slate-200">
                                      Set {set.setNumber}
                                    </span>
                                    <Pill value={set.stimulus} prefix="Stim" />
                                    <Pill value={set.fatigueCost} prefix="Fatigue" />
                                    <Pill value={set.rirPlausibility} prefix="RIR" />
                                  </div>
                                  <p className="mt-2 text-xs leading-5 text-slate-500">
                                    {set.rationale}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </details>
                        </details>
                      ))}
                    </div>
                  </details>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  No stored AI interpretation for this workout yet.
                </p>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
