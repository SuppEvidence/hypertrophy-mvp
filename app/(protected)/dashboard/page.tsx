import Link from "next/link";
import { createClient } from "@/lib/auth/server";
import { ensureProfile } from "@/lib/auth/profile";
import { getDashboardData } from "@/lib/server/dashboard";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function formatNumber(value: number | null | undefined, suffix = "", decimals = 1) {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toFixed(decimals).replace(/\.0$/, "")}${suffix}`;
}

function progressWidth(value: number | null | undefined) {
  const safeValue = Math.min(Math.max(Number(value ?? 0), 0), 100);
  return `${safeValue}%`;
}

function statusClass(status: string) {
  if (status === "Below target") return "border-amber-700/60 bg-amber-950/20 text-amber-100";
  if (status === "Above target") return "border-sky-700/60 bg-sky-950/20 text-sky-100";
  if (status === "Excessive") return "border-red-700/60 bg-red-950/20 text-red-100";
  if (status === "On target") return "border-emerald-700/60 bg-emerald-950/20 text-emerald-100";
  return "border-slate-700 bg-slate-800/60 text-slate-200";
}

function flagClass(severity: "neutral" | "watch" | "high") {
  if (severity === "high") return "border-red-800 bg-red-950/30";
  if (severity === "watch") return "border-amber-800 bg-amber-950/20";
  return "border-slate-800 bg-slate-900/80";
}

function MetricTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-100">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function DetailsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  await ensureProfile(user);
  const dashboard = await getDashboardData(user.id);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description="Decision surface for hypertrophy stimulus, volume targets, effort quality, and bodyweight/waist trend. Detailed performance data stays available separately."
      />

      {dashboard.activeProgram ? (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active setup</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-100">{dashboard.activeProgram.name}</h2>
              <p className="mt-1 text-sm text-slate-400">
                {dashboard.activeProgram.phaseLabel} · {dashboard.activeProgram.volumeWindowLabel} · {dashboard.completedSessionsCount} sessions
              </p>
            </div>
            <Link href="/log" className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-white">
              Log
            </Link>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next workout</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">{dashboard.suggestedTemplate?.name ?? "No template available"}</p>
          </div>
          <p className="mt-3 text-sm text-slate-400">
            <span className="text-slate-500">Priority:</span> {dashboard.activeProgram.priorityMuscles.join(", ") || "—"}
          </p>
        </Card>
      ) : (
        <Card>
          <h2 className="font-semibold text-slate-100">No active program</h2>
          <p className="mt-1 text-sm text-slate-400">Create or activate a program before dashboard calculations can run.</p>
          <Link href="/programs" className="mt-4 inline-flex rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-white">
            Open Programs
          </Link>
        </Card>
      )}

      {dashboard.activeProgram && dashboard.mesocycle ? (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mesocycle</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-100">{dashboard.mesocycle.name}</h2>
              <p className="mt-1 text-sm text-slate-400">
                {dashboard.mesocycle.status} · {dashboard.mesocycle.phaseLabel} · week {dashboard.mesocycle.currentWeek || "—"}/{dashboard.mesocycle.lengthWeeks}
              </p>
            </div>
            <Link href={`/programs/${dashboard.activeProgram.id}`} className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">
              Review
            </Link>
          </div>
          <div className="mt-4">
            <div className="h-2 rounded-full bg-slate-800">
              <div className="h-2 rounded-full bg-slate-200" style={{ width: progressWidth(dashboard.mesocycle.progressPct) }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {dashboard.mesocycle.progressPct}% complete · {dashboard.mesocycle.daysRemaining} days remaining · {formatDate(dashboard.mesocycle.startDate)} to {formatDate(dashboard.mesocycle.endDate)}
            </p>
          </div>
        </Card>
      ) : dashboard.activeProgram ? (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mesocycle</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-100">No mesocycle set</h2>
              <p className="mt-1 text-sm text-slate-400">Add a block to enable mesocycle-level review.</p>
            </div>
            <Link href={`/programs/${dashboard.activeProgram.id}`} className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">
              Add
            </Link>
          </div>
        </Card>
      ) : null}

      {dashboard.activeProgram ? (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bodyweight / waist</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-300 md:grid-cols-4">
            <MetricTile label="7d BW" value={formatNumber(dashboard.bodyMetrics.latestBodyweight, " kg")} hint={`${formatNumber(dashboard.bodyMetrics.bodyweightChange, " kg")} vs prev`} />
            <MetricTile label="7d waist" value={formatNumber(dashboard.bodyMetrics.latestWaist, " mm", 0)} hint={`${formatNumber(dashboard.bodyMetrics.waistChange, " mm", 0)} vs prev`} />
            <MetricTile label="Fatigue" value={dashboard.fatigueTrend.latest?.category ?? "—"} hint={dashboard.fatigueTrend.latest?.score !== null && dashboard.fatigueTrend.latest?.score !== undefined ? `${dashboard.fatigueTrend.latest.score}/100` : "No metric log"} />
            <MetricTile label="Samples" value={`${dashboard.bodyMetrics.bodyweightSampleCount ?? 0}/${dashboard.bodyMetrics.waistSampleCount ?? 0}`} hint="BW / waist in 7d" />
          </div>
        </Card>
      ) : null}

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Coach signals</p>
        <div className="mt-3 space-y-2">
          {dashboard.flags.length > 0 ? dashboard.flags.map((flag: any) => (
            <div key={`${flag.type}-${flag.title}`} className={`rounded-2xl border p-3 ${flagClass(flag.severity)}`}>
              <p className="font-semibold text-slate-100">{flag.title}</p>
              <p className="mt-1 text-sm text-slate-400">{flag.detail}</p>
            </div>
          )) : <p className="text-sm text-slate-400">No flags available until an active program exists.</p>}
        </div>
      </Card>

      {dashboard.activeProgram ? (
        <>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stimulus quality</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-300 md:grid-cols-4">
              <MetricTile label="Completed" value={dashboard.stimulusQuality.completedSets} />
              <MetricTile label="Too easy" value={`${dashboard.stimulusQuality.tooEasyShare}%`} hint={`${dashboard.stimulusQuality.effort.tooEasy} sets`} />
              <MetricTile label="Very hard/failure" value={`${dashboard.stimulusQuality.hardShare}%`} hint={`${dashboard.stimulusQuality.effort.veryHard + dashboard.stimulusQuality.effort.failure} sets`} />
              <MetricTile label="Rep issues" value={`${dashboard.stimulusQuality.repIssueShare}%`} />
            </div>
            <details className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">Rep range breakdown</summary>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400 md:grid-cols-5">
                <p>In range: {dashboard.stimulusQuality.repRange.inRange}</p>
                <p>Too low: {dashboard.stimulusQuality.repRange.tooLow}</p>
                <p>Too high: {dashboard.stimulusQuality.repRange.tooHigh}</p>
                <p>Mixed: {dashboard.stimulusQuality.repRange.mixed}</p>
                <p>Not logged: {dashboard.stimulusQuality.repRange.notLogged}</p>
              </div>
            </details>
          </Card>

          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priority muscle status</p>
            {dashboard.priorityRows.length > 0 ? (
              <div className="mt-3 space-y-2">
                {dashboard.priorityRows.map((row: any) => (
                  <div key={row.muscleId} className={`rounded-2xl border p-3 ${statusClass(row.status)}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{row.muscleName}</p>
                      <p className="text-xs font-semibold uppercase tracking-wide">{row.status}</p>
                    </div>
                    <p className="mt-1 text-sm opacity-90">
                      Productive equiv. {formatNumber(row.effective)} / target {formatNumber(row.target)} · Completed {formatNumber(row.direct)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-400">No priority muscles configured for active program.</p>
            )}
          </Card>

          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actual vs target volume</p>
            {dashboard.volumeRows.length > 0 ? (
              <div className="mt-3 space-y-2">
                {dashboard.volumeRows.slice(0, 12).map((row: any) => (
                  <div key={row.muscleId} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-100">{row.muscleName}</p>
                      <span className={`rounded-full border px-2 py-1 text-xs ${statusClass(row.status)}`}>{row.status}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-sm text-slate-300">
                      <p><span className="text-slate-500">Completed</span><br />{formatNumber(row.direct)}</p>
                      <p><span className="text-slate-500">Productive equiv.</span><br />{formatNumber(row.effective)}</p>
                      <p><span className="text-slate-500">Target</span><br />{formatNumber(row.target)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-400">No completed workout volume in the selected window yet.</p>
            )}
          </Card>

          <DetailsCard title="Movement coverage">
            {dashboard.movementCoverage.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {dashboard.movementCoverage.slice(0, 16).map((row: any) => (
                  <span key={row.movementGroupId} className="rounded-full border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-200">
                    {row.movementGroupName}: {row.completedSets}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No completed movement exposure in the selected window yet.</p>
            )}
          </DetailsCard>

          <DetailsCard title="Advanced analytics">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-100">Intensifiers</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-300 md:grid-cols-4">
                  <MetricTile label="Intensifier sets" value={dashboard.intensifiers.intensifierSets} />
                  <MetricTile label="Completed sets" value={dashboard.intensifiers.completedSets} />
                  <MetricTile label="Productive equiv." value={dashboard.intensifiers.effectiveVolume} />
                  <MetricTile label="Share" value={`${dashboard.intensifiers.share}%`} />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">Performance trend</p>
                <p className="mt-1 text-sm text-slate-400">{dashboard.performanceTrend.status} · compared exercises: {dashboard.performanceTrend.comparedExercises}</p>
                {dashboard.performanceTrend.declining.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {dashboard.performanceTrend.declining.slice(0, 3).map((item: any) => (
                      <div key={item.exerciseName} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-300">
                        <p className="font-semibold text-slate-100">{item.exerciseName}</p>
                        <p className="mt-1">{item.changePct}% · {item.previousE1rm} → {item.latestE1rm} e1RM</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </DetailsCard>
        </>
      ) : null}
    </div>
  );
}
