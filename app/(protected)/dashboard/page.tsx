import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUserId } from "@/lib/auth/user";
import { getDashboardData } from "@/lib/server/dashboard";

function formatNumber(
  value: number | null | undefined,
  suffix = "",
  decimals = 1,
) {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toFixed(decimals).replace(/\.0$/, "")}${suffix}`;
}

function formatDelta(
  value: number | null | undefined,
  suffix = "",
  decimals = 1,
) {
  if (value === null || value === undefined) return "No comparison";
  const rounded = Number(value).toFixed(decimals).replace(/\.0$/, "");
  return `${Number(value) > 0 ? "+" : ""}${rounded}${suffix} vs previous 7d`;
}

function progressWidth(value: number | null | undefined) {
  const safeValue = Math.min(Math.max(Number(value ?? 0), 0), 100);
  return `${safeValue}%`;
}

function coachClass(severity: "neutral" | "watch" | "high") {
  if (severity === "high")
    return "border-red-400/20 bg-red-500/[0.08]";
  if (severity === "watch")
    return "border-amber-400/20 bg-amber-500/[0.08]";
  return "border-emerald-400/15 bg-emerald-500/[0.06]";
}

function TrendItem({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-slate-100">
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-slate-500">{hint}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const userId = await requireUserId();
  const dashboard = await getDashboardData(userId);

  if (!dashboard.activeProgram) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Home"
          description="Your current training block, next session, and the few signals that need attention."
        />
        <Card className="overflow-hidden">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            Training setup
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-50">
            No active program
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
            Activate a program to bring your next workout, mesocycle status,
            and Coach signals onto Home.
          </p>
          <Link
            href="/programs"
            className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-400"
          >
            Open Plan
          </Link>
        </Card>
      </div>
    );
  }

  const actionableFlags = dashboard.flags.filter((flag) => flag.severity !== "neutral" &&
    !["PRIORITY_EFFECTIVE_VOLUME_LOW", "PRIORITY_EFFECTIVE_VOLUME_HIGH", "MISSED_TEMPLATE_UNDEREXPOSURE"].includes(flag.type) &&
    !(flag.type === "WAIST_TREND_UP" && (dashboard.declaredEnergyPhase?.transitionCaution || dashboard.declaredEnergyPhase?.phase === "GAINING")));

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Home"
        description="Next session, current block, and anything that needs attention."
      />

      <Card className="relative overflow-hidden border-orange-400/15 bg-gradient-to-br from-slate-900 via-slate-900 to-orange-950/20">
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-orange-500/[0.08] blur-3xl"
          aria-hidden="true"
        />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-orange-300/80">
                Next workout
              </p>
              <h2 className="mt-2 truncate text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
                {dashboard.suggestedTemplate?.name ?? "Choose workout"}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {dashboard.activeProgram.name}
              </p>
            </div>

            <Link
              href="/log"
              className="shrink-0 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-orange-950/30 transition hover:bg-orange-400"
            >
              Start
            </Link>
          </div>

          {dashboard.mesocycle ? (
            <div className="mt-6 border-t border-white/[0.07] pt-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-200">
                    {dashboard.mesocycle.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {dashboard.mesocycle.phaseLabel} · Week{" "}
                    {dashboard.mesocycle.currentWeek || "—"}/
                    {dashboard.mesocycle.lengthWeeks}
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  {dashboard.mesocycle.progressPct}%
                </span>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                  style={{
                    width: progressWidth(dashboard.mesocycle.progressPct),
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="mt-6 border-t border-white/[0.07] pt-4">
              <p className="text-sm text-slate-400">
                No current mesocycle configured.
              </p>
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <Link
              href="/plan/mesocycle"
              className="rounded-xl border border-slate-700 bg-slate-950/30 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-slate-100"
            >
              Adjust mesocycle
            </Link>
            <Link
              href="/ai-analysis"
              className="rounded-xl border border-slate-700 bg-slate-950/30 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-slate-100"
            >
              AI Advisor
            </Link>
          </div>
        </div>
      </Card>

      {dashboard.mesocycle?.status === "Current" && (
        dashboard.t3PendingDecisions > 0 ||
        (dashboard.mesocycle.t3Activated && dashboard.mesocycle.t3EvaluationStatus === "FAILED") ||
        dashboard.mesocycle.nextBlockReviewReady
      ) ? (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            Coach follow-up
          </p>
          <div className="mt-3 space-y-3">
            {dashboard.t3PendingDecisions > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-300">
                  {dashboard.t3PendingDecisions} volume {dashboard.t3PendingDecisions === 1 ? "decision" : "decisions"} to review for this block.
                </p>
                <Link href="/ai-analysis/volume" className="text-xs font-semibold text-orange-300 hover:text-orange-200">
                  Review volume
                </Link>
              </div>
            ) : null}
            {dashboard.mesocycle.t3Activated && dashboard.mesocycle.t3EvaluationStatus === "FAILED" ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-300">The latest volume review failed.</p>
                <Link href="/ai-analysis/volume" className="text-xs font-semibold text-orange-300 hover:text-orange-200">
                  Retry review
                </Link>
              </div>
            ) : null}
            {dashboard.mesocycle.nextBlockReviewReady ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-300">Your next-block review is ready.</p>
                <Link href="/ai-analysis/mesocycle" className="text-xs font-semibold text-orange-300 hover:text-orange-200">
                  Read review
                </Link>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {actionableFlags.length > 0 ? <section
        className={`rounded-2xl border p-4 ${coachClass(
          actionableFlags[0]?.severity ?? "neutral",
        )}`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
              actionableFlags.some((flag) => flag.severity === "high")
                  ? "bg-red-400"
                  : "bg-amber-400"
            }`}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Coach
            </p>
            <div className="mt-2 space-y-3">
                {actionableFlags.map((flag) => (
                  <div key={`${flag.type}-${flag.title}`}>
                    <p className="font-semibold text-slate-100">{flag.title}</p>
                    <p className="mt-1 text-sm leading-5 text-slate-400">
                      {flag.detail}
                    </p>
                  </div>
                ))}
              </div>
          </div>
        </div>
      </section> : null}

      <Card>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            Current trend
          </p>
          <Link
            href="/metrics"
            className="text-xs font-semibold text-slate-500 transition hover:text-slate-300"
          >
            Metrics
          </Link>
        </div>

        {dashboard.declaredEnergyPhase ? <p className="mt-3 text-xs text-slate-400">
          {dashboard.declaredEnergyPhase.phase.toLowerCase()} since {dashboard.declaredEnergyPhase.startDate}
          {dashboard.declaredEnergyPhase.transitionCaution ? " · early transition; trends can lag" : ""}
        </p> : <p className="mt-3 text-xs text-slate-500">Set a cutting, maintaining or gaining phase in Metrics to add context to coaching.</p>}

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <TrendItem
            label="Bodyweight"
            value={formatNumber(
              dashboard.bodyMetrics.latestBodyweight,
              " kg",
            )}
            hint={formatDelta(
              dashboard.bodyMetrics.bodyweightChange,
              " kg",
            )}
          />
          <div>
            <TrendItem
              label="Waist"
              value={formatNumber(
                dashboard.bodyMetrics.latestWaist,
                " mm",
                0,
              )}
              hint={formatDelta(
                dashboard.bodyMetrics.waistChange,
                " mm",
                0,
              )}
            />
          </div>
          <div>
            <TrendItem
              label="Fatigue"
              value={dashboard.fatigueTrend.latest?.category ?? "—"}
              hint={
                dashboard.fatigueTrend.latest?.score !== null &&
                dashboard.fatigueTrend.latest?.score !== undefined
                  ? `${dashboard.fatigueTrend.latest.score}/100`
                  : "No recent score"
              }
            />
          </div>
        </div>
      </Card>

    </div>
  );
}
