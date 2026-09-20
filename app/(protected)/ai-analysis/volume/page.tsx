import { Card } from "@/components/ui/Card";
import { StoredProgrammingOptionsSchema } from "@/lib/ai/programming-decision-schema";
import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";
import {
  generateAdvisorVolumeRecommendationsAction,
  selectAdvisorProgrammingDecisionAction,
} from "@/lib/server/ai-advisor-actions";

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

export default async function VolumeRecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const userId = await requireUserId();
  const recent = await prisma.aiProgrammingDecision.findMany({
    where: { userId, status: { in: ["PENDING", "SELECTED"] } },
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

  const latestGenerationId = recent[0]?.generationId ?? null;
  const decisions = latestGenerationId
    ? recent
        .filter((decision) => decision.generationId === latestGenerationId)
        .sort((a, b) => a.targetMuscleName.localeCompare(b.targetMuscleName))
    : [];
  const summary = decisions[0] ? globalSummary(decisions[0].context) : null;

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
            Volume recommendations
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-500">
            Current-block decisions from workout evidence, recovery, movement
            patterns, historical response, and recorded symptom context.
          </p>
        </div>
        <form action={generateAdvisorVolumeRecommendationsAction}>
          <button
            type="submit"
            className="min-h-10 rounded-xl bg-orange-500 px-4 text-xs font-bold text-white transition hover:bg-orange-400"
          >
            {decisions.length > 0 ? "Refresh recommendations" : "Generate recommendations"}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-sky-400/15 bg-sky-400/[0.05] px-3 py-2.5 text-xs leading-5 text-slate-400">
        Pain/ache flags are attached to the exercise exposure rather than every
        set. After that workout is analyzed, the Advisor can use the symptom as
        part of exercise and movement-pattern evidence without multiplying one
        issue by the number of sets performed.
      </div>

      {decisions.length === 0 ? (
        <Card>
          <p className="font-semibold text-slate-100">No active volume review</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Generate recommendations once you have enough properly logged and
            analyzed workouts. HOLD remains the default when evidence is sparse.
          </p>
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Latest review
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {summary ?? "Current programming review generated."}
                </p>
              </div>
              <div className="text-right text-[11px] text-slate-600">
                <p>{formatDate(decisions[0].createdAt)}</p>
                <p className="mt-1">{decisions[0].model}</p>
              </div>
            </div>
          </Card>

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
                              <button
                                type="submit"
                                className="min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs font-semibold text-slate-200 transition hover:border-orange-400/40 hover:text-orange-200"
                              >
                                Choose this option
                              </button>
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
                        <button
                          type="submit"
                          className="min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs font-semibold text-slate-200 transition hover:border-emerald-400/40 hover:text-emerald-200"
                        >
                          Keep current setup
                        </button>
                      </form>
                    ) : null}
                  </div>

                  {selected ? (
                    <p className="mt-3 text-xs leading-5 text-emerald-300">
                      Selection recorded as AI learning memory. It has not
                      changed the program or templates automatically.
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
