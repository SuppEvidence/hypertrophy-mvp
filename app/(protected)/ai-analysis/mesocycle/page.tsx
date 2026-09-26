import { Card } from "@/components/ui/Card";
import Link from "next/link";
import { requireUserId } from "@/lib/auth/user";
import {
  getCurrentMesocycleRecommendationForUser,
} from "@/lib/server/ai-mesocycle-recommendations";

const DAY_MS = 24 * 60 * 60 * 1000;

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function confidenceClass(value: string) {
  if (value === "HIGH")
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
  if (value === "MODERATE")
    return "border-sky-400/25 bg-sky-400/10 text-sky-200";
  return "border-slate-700 bg-slate-900 text-slate-400";
}

function actionClass(value: string) {
  if (["INCREASE", "PROMOTE"].includes(value))
    return "border-sky-400/25 bg-sky-400/10 text-sky-200";
  if (["DECREASE", "DEMOTE", "REDUCE"].includes(value))
    return "border-amber-400/25 bg-amber-400/10 text-amber-200";
  if (value === "REVIEW_EXERCISE")
    return "border-violet-400/25 bg-violet-400/10 text-violet-200";
  return "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200";
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function MesocycleRecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const userId = await requireUserId();
  const current = await getCurrentMesocycleRecommendationForUser(userId);

  if (!current) {
    return (
      <Card>
        <h2 className="font-semibold text-slate-100">No block review yet</h2>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Configure T3 priorities for a current block. Its next-block review runs near the end once comparable start and end circumference check-ins are saved.
        </p>
      </Card>
    );
  }

  const plannedEnd = new Date(
    current.startDate.getTime() + current.lengthWeeks * 7 * DAY_MS - DAY_MS,
  );
  const recommendation = current.aiRecommendation;

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2.5 text-sm text-rose-200">
          {error}
        </div>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            Next-block review
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-500">
            An automatic transition review for next-block priorities, movement
            implementation, symptom precautions, and future template changes. T3 owns current-block volume.
          </p>
        </div>
      </div>

      <Card className="border-orange-400/15 bg-gradient-to-br from-slate-900 to-orange-950/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-orange-300/80">
              Reviewed block
            </p>
            <h3 className="mt-1 text-xl font-semibold text-slate-50">
              {current.name}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {label(current.phase)} · {current.lengthWeeks} weeks · planned end {formatDate(plannedEnd)}
            </p>
          </div>
          <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-300">
            Planned end {formatDate(plannedEnd)}
          </span>
        </div>
      </Card>

      {!recommendation ? (
        <Card>
          <p className="font-semibold text-slate-100">Review will appear near the block transition</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            The first AI-era transition does not need a prior completed
            mesocycle. The Advisor will treat historical dose-response as
            insufficient, default toward HOLD when evidence is unclear, and use
            this block mainly to establish the baseline for later comparisons.
          </p>
          {current.checkinStatus ? (
            <div className="mt-3 space-y-2 text-sm text-slate-400">
              <p>
                {!current.checkinStatus.startSaved
                  ? "Save a mesocycle start circumference check-in. A previous block's end check-in within seven days of this start also counts."
                  : !current.checkinStatus.endSaved
                    ? "Save a mesocycle end circumference check-in within seven days of the block end."
                    : !current.checkinStatus.comparable
                      ? "The start and end check-ins need at least one matching circumference measurement."
                      : "Check-ins are ready. The review runs after a completed workout or a saved check-in."}
              </p>
              {!current.checkinStatus.comparable ? (
                <Link href={`/metrics?logType=${"MESOCYCLE_CHECKIN"}`}
                  className="inline-flex text-xs font-semibold text-orange-300 hover:text-orange-200">
                  Open metrics check-in
                </Link>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-xs leading-5 text-slate-500">
              The review waits until the last week and uses saved start and end circumference check-ins. It does not modify the next block or templates automatically.
            </p>
          )}
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Next-block summary
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {recommendation.summary}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-2 py-1 text-[11px] ${confidenceClass(
                    recommendation.confidence,
                  )}`}
                >
                  {label(recommendation.confidence)} confidence
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-400">
                  {label(recommendation.historyMode)}
                </span>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Current block
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {recommendation.currentBlockAssessment}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Body metrics
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {recommendation.bodyMetricInterpretation}
                </p>
              </div>
            </div>
            {current.aiRecommendedAt ? (
              <p className="mt-3 text-[11px] text-slate-600">
                Generated {formatDate(current.aiRecommendedAt)}
                {current.aiRecommendationModel
                  ? ` · ${current.aiRecommendationModel}`
                  : ""}
              </p>
            ) : null}
          </Card>

          {recommendation.symptomPrecautions.length > 0 ? (
            <Card className="border-amber-400/20 bg-amber-400/[0.04]">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-200/80">
                Symptom precautions
              </p>
              <div className="mt-3 space-y-3">
                {recommendation.symptomPrecautions.map((item, index) => (
                  <div
                    key={`${item.location}-${item.side ?? "none"}-${index}`}
                    className="rounded-xl border border-amber-400/15 bg-slate-950/45 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-100">
                        {item.location}
                        {item.side ? ` · ${item.side}` : ""}
                      </p>
                      <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                        {label(item.signalStrength)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      {item.recommendation}
                    </p>
                    {item.affectedMovementPatterns.length > 0 ? (
                      <p className="mt-2 text-[11px] text-slate-500">
                        Patterns: {item.affectedMovementPatterns.join(" · ")}
                      </p>
                    ) : null}
                    {item.affectedExercises.length > 0 ? (
                      <p className="mt-1 text-[11px] text-slate-500">
                        Exercises: {item.affectedExercises.join(" · ")}
                      </p>
                    ) : null}
                    {item.clinicalReviewSuggested ? (
                      <p className="mt-2 text-[11px] leading-4 text-amber-200/80">
                        Repeated/function-limiting symptoms justify appropriate
                        clinical assessment rather than trying to diagnose the
                        issue inside the tracker.
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <Card>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Priority direction
            </p>
            <div className="mt-3 divide-y divide-white/[0.06]">
              {recommendation.nextPriorities.length > 0 ? (
                recommendation.nextPriorities.map((item, index) => (
                  <div
                    key={`${item.muscleName}-${index}`}
                    className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        {item.muscleName}
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-300">
                        {label(item.currentPriority)} → {label(item.suggestedPriority)}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {item.rationale}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${actionClass(
                        item.action,
                      )}`}
                    >
                      {label(item.action)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No priority changes suggested.</p>
              )}
            </div>
          </Card>

          <details className="rounded-2xl border border-white/[0.07] bg-slate-900/55 p-4">
            <summary className="cursor-pointer font-semibold text-slate-100">
              Movement-pattern implications · {recommendation.movementRecommendations.length}
            </summary>
            <div className="mt-3 divide-y divide-white/[0.06]">
              {recommendation.movementRecommendations.map((item, index) => (
                <div
                  key={`${item.movementPatternName}-${index}`}
                  className="py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-200">
                      {item.movementPatternName}
                    </p>
                    <span
                      className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${actionClass(
                        item.action,
                      )}`}
                    >
                      {label(item.action)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {item.rationale}
                  </p>
                </div>
              ))}
            </div>
          </details>

          <details className="rounded-2xl border border-white/[0.07] bg-slate-900/55 p-4">
            <summary className="cursor-pointer font-semibold text-slate-100">
              Template implications · {recommendation.templateImplications.length}
            </summary>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-400">
              {recommendation.templateImplications.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </details>

          {recommendation.cautionNotes.length > 0 ? (
            <details className="rounded-2xl border border-white/[0.07] bg-slate-950/45 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-300">
                Evidence cautions · {recommendation.cautionNotes.length}
              </summary>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-5 text-slate-500">
                {recommendation.cautionNotes.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}
