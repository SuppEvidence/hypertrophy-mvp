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

function volumeProgress(
  effective: number,
  target: number | null | undefined,
) {
  if (!target || target <= 0) return "0%";
  return `${Math.min(Math.max((effective / target) * 100, 0), 100)}%`;
}

function statusClass(status: string) {
  if (status === "Below target")
    return "border-amber-400/20 bg-amber-500/10 text-amber-200";
  if (status === "Above target")
    return "border-sky-400/20 bg-sky-500/10 text-sky-200";
  if (status === "Excessive")
    return "border-red-400/20 bg-red-500/10 text-red-200";
  if (status === "On target")
    return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
  return "border-slate-700 bg-slate-800/60 text-slate-300";
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
            priority volume, and Coach signals onto Home.
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

  const neutralCoach =
    dashboard.flags.length === 1 &&
    dashboard.flags[0]?.severity === "neutral";

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Home"
        description="Next session, current block, priority volume, and anything that actually needs attention."
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

          <div className="mt-4 flex flex-wrap gap-2">
            {dashboard.activeProgram.priorityMuscles.length > 0 ? (
              dashboard.activeProgram.priorityMuscles.map((muscle) => (
                <span
                  key={muscle}
                  className="rounded-full border border-orange-400/15 bg-orange-500/[0.08] px-2.5 py-1 text-xs font-medium text-orange-200"
                >
                  {muscle}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500">
                No priority muscles set
              </span>
            )}
          </div>

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

      <section
        className={`rounded-2xl border p-4 ${coachClass(
          dashboard.flags[0]?.severity ?? "neutral",
        )}`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
              neutralCoach
                ? "bg-emerald-400"
                : dashboard.flags.some((flag) => flag.severity === "high")
                  ? "bg-red-400"
                  : "bg-amber-400"
            }`}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Coach
            </p>
            {dashboard.flags.length > 0 ? (
              <div className={neutralCoach ? "mt-1" : "mt-2 space-y-3"}>
                {dashboard.flags.map((flag) => (
                  <div key={`${flag.type}-${flag.title}`}>
                    <p className="font-semibold text-slate-100">{flag.title}</p>
                    <p className="mt-1 text-sm leading-5 text-slate-400">
                      {flag.detail}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm text-slate-400">
                No Coach signal available yet.
              </p>
            )}
          </div>
        </div>
      </section>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Priority volume
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Effective volume in the current reporting window.
            </p>
          </div>
          <Link
            href="/progress"
            className="shrink-0 text-xs font-semibold text-orange-300 hover:text-orange-200"
          >
            Full progress
          </Link>
        </div>

        {dashboard.priorityRows.length > 0 ? (
          <div className="mt-4 space-y-4">
            {dashboard.priorityRows.map((row) => (
              <div key={row.muscleId}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-100">
                    {row.muscleName}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm tabular-nums text-slate-300">
                      {formatNumber(row.effective)}{" "}
                      <span className="text-slate-600">/</span>{" "}
                      {formatNumber(row.target)}
                    </p>
                    <span
                      className={`hidden rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:inline-flex ${statusClass(
                        row.status,
                      )}`}
                    >
                      {row.status}
                    </span>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-slate-300"
                    style={{
                      width: volumeProgress(row.effective, row.target),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">
            No priority muscles configured.
          </p>
        )}
      </Card>

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

        <div className="mt-4 grid grid-cols-3 gap-4 divide-x divide-white/[0.06]">
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
          <div className="pl-4">
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
          <div className="pl-4">
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

      <Link
        href="/progress"
        className="flex min-h-12 items-center justify-between rounded-2xl border border-white/[0.07] bg-slate-900/[0.45] px-4 text-sm font-semibold text-slate-300 transition hover:border-slate-700 hover:bg-slate-900/70 hover:text-slate-100"
      >
        <span>View full training progress</span>
        <span className="text-slate-600">→</span>
      </Link>
    </div>
  );
}
