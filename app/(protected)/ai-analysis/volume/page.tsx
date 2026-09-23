import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { StoredProgrammingOptionsSchema } from "@/lib/ai/programming-decision-schema";
import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";
import { getDashboardData } from "@/lib/server/dashboard";
import { t3PriorityLabel } from "@/lib/coaching/t3-volume-policy";
import { T3_REVIEW_LEASE_MS } from "@/lib/coaching/t3-volume-policy";
import { T3PlanPreviewSchema } from "@/lib/coaching/t3-prescription-preview";
import {
  generateAdvisorVolumeRecommendationsAction,
  selectAdvisorProgrammingDecisionAction,
} from "@/lib/server/ai-advisor-actions";

export const maxDuration = 120;

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function globalSummary(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const summary = (value as Record<string, unknown>).globalSummary;
  return typeof summary === "string" ? summary : null;
}

function signedSets(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function confidenceClass(value: string) {
  if (value === "HIGH")
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
  if (value === "MODERATE")
    return "border-sky-400/25 bg-sky-400/10 text-sky-200";
  return "border-slate-700 bg-slate-900 text-slate-400";
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

async function staleT3Cutoff() {
  return new Date(Date.now() - T3_REVIEW_LEASE_MS);
}

export default async function VolumeRecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const userId = await requireUserId();
  const staleBefore = await staleT3Cutoff();
  const dashboard = await getDashboardData(userId);
  const mesocycle = dashboard.mesocycle?.status === "Current"
    ? await prisma.programMesocycle.findFirst({
        where: { id: dashboard.mesocycle.id, userId },
        include: {
          musclePriorities: {
            include: { muscle: true },
            orderBy: { muscle: { sortOrder: "asc" } },
          },
        },
      })
    : null;
  const recent = await prisma.aiProgrammingDecision.findMany({
    where: {
      userId,
      mesocycleId: mesocycle?.id ?? "00000000-0000-0000-0000-000000000000",
      decisionType: "T3_MUSCLE_VOLUME",
      status: { in: ["PENDING", "SELECTED"] },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      generationId: true,
      targetMuscleName: true,
      decisionSummary: true,
      confidence: true,
      evidence: true,
      options: true,
      recommendedOptionKey: true,
      keepAsIsRationale: true,
      selectedOptionKey: true,
      status: true,
      context: true,
      model: true,
      policyVersion: true,
      createdAt: true,
    },
  });

  const storedAssessment = mesocycle?.t3Assessment && typeof mesocycle.t3Assessment === "object" && !Array.isArray(mesocycle.t3Assessment)
    ? mesocycle.t3Assessment as Record<string, unknown>
    : null;
  const latestGenerationId = typeof storedAssessment?.generationId === "string"
    ? storedAssessment.generationId : null;
  const decisions = latestGenerationId
    ? recent
        .filter((decision) => decision.generationId === latestGenerationId)
        .sort((a, b) => a.targetMuscleName.localeCompare(b.targetMuscleName))
    : [];
  const summary = typeof storedAssessment?.globalSummary === "string"
    ? storedAssessment.globalSummary : decisions[0] ? globalSummary(decisions[0].context) : null;
  const bodyContext = typeof storedAssessment?.bodyCompositionContext === "string"
    ? storedAssessment.bodyCompositionContext : null;
  const configured = Boolean(mesocycle?.t3ActivatedAt && mesocycle.musclePriorities.length > 0);
  const staleReview = Boolean(
    mesocycle &&
    ["PENDING", "RUNNING"].includes(mesocycle.t3EvaluationStatus) &&
    mesocycle.updatedAt < staleBefore,
  );

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
            Volume coaching
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-500">
            T3 reviews the current block automatically using outcome priorities,
            workout evidence, recovery, Metrics, symptoms, and historical response.
          </p>
        </div>
        {configured && (mesocycle?.t3EvaluationStatus !== "RUNNING" || staleReview) ? (
          <form action={generateAdvisorVolumeRecommendationsAction}>
            <Button type="submit" pendingText="Reviewing volume…" className="text-xs">
              {mesocycle?.t3EvaluationStatus === "FAILED" || staleReview ? "Retry T3 review" : "Review volume"}
            </Button>
          </form>
        ) : null}
      </div>

      <div className="rounded-xl border border-sky-400/15 bg-sky-400/[0.05] px-3 py-2.5 text-xs leading-5 text-slate-400">
        Pain/ache flags are attached to the exercise exposure rather than every
        set. After that workout is analyzed, the Advisor can use the symptom as
        part of exercise and movement-pattern evidence without multiplying one
        issue by the number of sets performed.
      </div>

      {!configured ? (
        <Card>
          <p className="font-semibold text-slate-100">Set your block priorities</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Activate T3 in the current mesocycle. It captures the current prescription as the transition baseline and then evaluates evidence automatically.
          </p>
          {dashboard.activeProgram ? <Link href={`/programs/${dashboard.activeProgram.id}`} className="mt-3 inline-flex text-xs font-semibold text-orange-300">Open mesocycle priorities</Link> : null}
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Latest T3 assessment · {mesocycle?.t3EvaluationStatus.toLowerCase().replaceAll("_", " ")}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {summary ?? "Waiting for enough current-block evidence to assess the useful dose. The baseline remains in place."}
                </p>
                {bodyContext ? <p className="mt-2 text-xs leading-5 text-slate-500">{bodyContext}</p> : null}
                {mesocycle?.t3EvaluationError ? <p className="mt-2 text-xs text-rose-300">{mesocycle.t3EvaluationError}</p> : null}
                {stringArray(storedAssessment?.reviewNotes).map((note, index) => <p key={index} className="mt-2 text-xs text-amber-200">{note}</p>)}
                {mesocycle?.t3EvaluationStatus === "RUNNING" ? <p role="status" className="mt-2 text-xs text-orange-300">Reviewing volume… Refresh shortly to see the result.</p> : null}
              </div>
              <div className="text-right text-[11px] text-slate-600">
                {mesocycle?.t3LastEvaluatedAt ? <p>{formatDate(mesocycle.t3LastEvaluatedAt)}</p> : null}
              </div>
            </div>
          </Card>

          <div className="grid gap-2 sm:grid-cols-2">
            {mesocycle?.musclePriorities.map((row) => (
              <Card key={row.muscleId}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-100">{row.muscle.name}</p>
                  <span className="text-[11px] text-orange-300">{t3PriorityLabel(row.priority)}</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Approved target {Number(row.coachTargetWeeklySets)} · estimated useful range {Number(row.rangeMinimumSets)}–{Number(row.rangeMaximumSets)} effective sets/wk
                </p>
                <p className="mt-1 text-xs text-slate-500">{label(row.coachingStatus)}{row.confidence ? ` · ${label(row.confidence)} confidence` : ""}</p>
                {row.rationale ? <p className="mt-2 text-xs leading-5 text-slate-500">{row.rationale}</p> : null}
              </Card>
            ))}
          </div>

          {decisions.length > 0 ? <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Approval-needed changes</h3> : null}

          <div className="space-y-3">
            {decisions.map((decision) => {
              const parsedOptions = StoredProgrammingOptionsSchema.safeParse(
                decision.options,
              );
              const options = parsedOptions.success ? parsedOptions.data : [];
              const evidence = stringArray(decision.evidence);
              const selected =
                decision.status === "SELECTED" && decision.selectedOptionKey;

              return (
                <Card key={decision.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-orange-300/80">
                        {decision.targetMuscleName}
                      </p>
                      <p className="mt-1 font-semibold leading-6 text-slate-100">
                        {decision.decisionSummary}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-[11px] ${confidenceClass(
                        decision.confidence,
                      )}`}
                    >
                      {label(decision.confidence)} confidence
                    </span>
                  </div>

                  <details className="mt-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-400">
                      Evidence · {evidence.length}
                    </summary>
                    {evidence.length > 0 ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-500">
                        {evidence.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">
                        No stored evidence bullets.
                      </p>
                    )}
                  </details>

                  <div className="mt-3 grid gap-2 lg:grid-cols-2">
                    {options.map((option) => {
                      const context = decision.context && typeof decision.context === "object" && !Array.isArray(decision.context) ? decision.context : {};
                      const previews = context.optionPreviews && typeof context.optionPreviews === "object" && !Array.isArray(context.optionPreviews) ? context.optionPreviews : {};
                      const preview = T3PlanPreviewSchema.safeParse(previews[option.optionKey]);
                      const preferred =
                        decision.recommendedOptionKey === option.optionKey;
                      const isSelected =
                        decision.selectedOptionKey === option.optionKey;
                      return (
                        <div
                          key={option.optionKey}
                          className={`rounded-xl border p-3 ${
                            isSelected
                              ? "border-emerald-400/30 bg-emerald-400/[0.05]"
                              : preferred
                                ? "border-orange-400/30 bg-orange-400/[0.05]"
                                : "border-slate-800 bg-slate-950/50"
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-100">
                              {option.title}
                            </p>
                            {preferred ? (
                              <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-200">
                                AI preferred
                              </span>
                            ) : null}
                            {isSelected ? (
                              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                                Selected
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-2 text-xs font-medium text-slate-300">
                            {label(option.action)} · {signedSets(option.deltaWeeklySets)} sets/wk
                          </p>
                          {option.movementChanges.length > 0 ? (
                            <div className="mt-2 space-y-1 text-xs text-slate-400">
                              {option.movementChanges.map((movement) => (
                                <p key={movement.movementPatternId}>
                                  {signedSets(movement.deltaSets)} · {movement.movementPatternName}
                                </p>
                              ))}
                            </div>
                          ) : null}
                          <p className="mt-2 text-xs leading-5 text-slate-500">
                            {option.rationale}
                          </p>
                          {preview.success ? <div className="mt-3 space-y-1 text-xs text-slate-300">
                            <p className="font-semibold">Changes if approved</p>
                            {preview.data.slots.map((slot) => <p key={slot.id}>{slot.template} · {slot.exercise}: {slot.before} → {slot.after} sets</p>)}
                            {preview.data.muscles.map((muscle) => <p key={muscle.muscleId}>{muscle.name}: {muscle.before} → {muscle.after} effective sets/week</p>)}
                            <p className="text-slate-500">Physical set changes follow the template’s repeat frequency. Secondary-muscle effects are included above.</p>
                          </div> : <p className="mt-2 text-xs text-amber-200">Run a new volume review to preview this older option.</p>}

                          {!selected ? (
                            <form
                              action={selectAdvisorProgrammingDecisionAction}
                              className="mt-3"
                            >
                              <input
                                type="hidden"
                                name="decisionId"
                                value={decision.id}
                              />
                              <input
                                type="hidden"
                                name="selectionKey"
                                value={option.optionKey}
                              />
                              <Button
                                type="submit"
                                variant="secondary"
                                pendingText="Applying…"
                                disabled={!preview.success}
                                className="min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs font-semibold text-slate-200 transition hover:border-orange-400/40 hover:text-orange-200"
                              >
                                Choose this option
                              </Button>
                            </form>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  <div
                    className={`mt-2 rounded-xl border p-3 ${
                      decision.selectedOptionKey === "KEEP_AS_IS"
                        ? "border-emerald-400/30 bg-emerald-400/[0.05]"
                        : decision.recommendedOptionKey === "KEEP_AS_IS"
                          ? "border-orange-400/30 bg-orange-400/[0.05]"
                          : "border-slate-800 bg-slate-950/40"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-100">
                        Keep as is
                      </p>
                      {decision.recommendedOptionKey === "KEEP_AS_IS" ? (
                        <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-200">
                          AI preferred
                        </span>
                      ) : null}
                      {decision.selectedOptionKey === "KEEP_AS_IS" ? (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                          Selected
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {decision.keepAsIsRationale}
                    </p>
                    {!selected ? (
                      <form
                        action={selectAdvisorProgrammingDecisionAction}
                        className="mt-3"
                      >
                        <input
                          type="hidden"
                          name="decisionId"
                          value={decision.id}
                        />
                        <input
                          type="hidden"
                          name="selectionKey"
                          value="KEEP_AS_IS"
                        />
                        <Button
                          type="submit"
                          variant="secondary"
                          pendingText="Saving…"
                          className="min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs font-semibold text-slate-200 transition hover:border-emerald-400/40 hover:text-emerald-200"
                        >
                          Keep current setup
                        </Button>
                      </form>
                    ) : null}
                  </div>

                  {selected ? (
                    <p className="mt-3 text-xs leading-5 text-emerald-300">
                      Selection recorded. A chosen dose change updates this mesocycle’s coach target; structural slot changes remain approval-gated.
                    </p>
                  ) : null}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
