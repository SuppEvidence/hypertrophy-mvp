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

function QuickLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-white/[0.07] bg-slate-900/[0.55] p-4 transition hover:border-slate-700 hover:bg-slate-900"
    >
      <p className="font-semibold text-slate-100">{title}</p>
      <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
    </Link>
  );
}

export default async function ProgressPage() {
  const userId = await requireUserId();
  const dashboard = await getDashboardData(userId);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Progress"
        description="Full volume, movement, performance, body-metric, and AI review without cluttering Home."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <QuickLink
          href="/metrics"
          title="Body & recovery"
          description="Bodyweight, waist, recovery, and fatigue logs."
        />
        <QuickLink
          href="/performance"
          title="Exercise performance"
          description="Exercise-level exposure, progression, and PR context."
        />
        <QuickLink
          href="/ai-analysis"
          title="AI Advisor"
          description="Workout interpretation and programming recommendations."
        />
      </div>

      {!dashboard.activeProgram ? (
        <Card>
          <p className="font-semibold text-slate-100">No active program</p>
          <p className="mt-1 text-sm text-slate-400">
            Activate a program before volume and movement progress can be
            calculated.
          </p>
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Current trend
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Seven-day averages and current recovery context.
                </p>
              </div>
              <p className="text-xs text-slate-600">
                {dashboard.activeProgram.volumeWindowLabel}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-slate-500">Bodyweight</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">
                  {formatNumber(
                    dashboard.bodyMetrics.latestBodyweight,
                    " kg",
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Waist</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">
                  {formatNumber(
                    dashboard.bodyMetrics.latestWaist,
                    " mm",
                    0,
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Fatigue</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">
                  {dashboard.fatigueTrend.latest?.category ?? "—"}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Volume by muscle
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Exact selected-window volume. Coach Signals may use schedule
              tolerance separately.
            </p>

            {dashboard.volumeRows.length > 0 ? (
              <div className="mt-4 divide-y divide-white/[0.06]">
                {dashboard.volumeRows.map((row) => (
                  <div
                    key={row.muscleId}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-slate-100">
                          {row.muscleName}
                        </p>
                        {row.isPriority ? (
                          <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-300">
                            Priority
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Completed {formatNumber(row.direct)} · Effective{" "}
                        {formatNumber(row.effective)} · Target{" "}
                        {formatNumber(row.target)}
                      </p>
                    </div>
                    <span
                      className={`self-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClass(
                        row.status,
                      )}`}
                    >
                      {row.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">
                No completed workout volume in the selected window yet.
              </p>
            )}
          </Card>

          <Card>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Movement coverage
            </p>
            {dashboard.movementCoverage.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {dashboard.movementCoverage.map((row) => (
                  <span
                    key={row.movementGroupId}
                    className="rounded-xl border border-white/[0.07] bg-slate-950/40 px-3 py-2 text-sm text-slate-300"
                  >
                    {row.movementGroupName}
                    <span className="ml-2 text-slate-600">
                      {row.completedSets}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">
                No movement exposure in the selected window yet.
              </p>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Intensifier use
              </p>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Intensifier sets</p>
                  <p className="mt-1 text-xl font-semibold text-slate-100">
                    {dashboard.intensifiers.intensifierSets}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Effective share</p>
                  <p className="mt-1 text-xl font-semibold text-slate-100">
                    {dashboard.intensifiers.share}%
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Performance trend
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-100">
                {dashboard.performanceTrend.status}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {dashboard.performanceTrend.comparedExercises} comparable
                exercises
              </p>

              {dashboard.performanceTrend.declining.length > 0 ? (
                <div className="mt-3 space-y-2 border-t border-white/[0.06] pt-3">
                  {dashboard.performanceTrend.declining
                    .slice(0, 3)
                    .map((item) => (
                      <div
                        key={item.exerciseName}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="truncate text-slate-300">
                          {item.exerciseName}
                        </span>
                        <span className="shrink-0 tabular-nums text-slate-500">
                          {item.changePct}%
                        </span>
                      </div>
                    ))}
                </div>
              ) : null}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
