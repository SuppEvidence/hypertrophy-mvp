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
        description="Hypertrophy decision surface based on selected program, completed workouts, metrics, volume targets, and set-type exposure."
      />

      {dashboard.activeProgram ? (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active program</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-100">{dashboard.activeProgram.name}</h2>
            </div>
            <Link href="/log" className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-white">
              Log
            </Link>
          </div>
          <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
            <p><span className="text-slate-500">Type:</span> {dashboard.activeProgram.typeLabel}</p>
            <p><span className="text-slate-500">Phase:</span> {dashboard.activeProgram.phaseLabel}</p>
            <p><span className="text-slate-500">Window:</span> {dashboard.activeProgram.volumeWindowLabel} ({dashboard.windowDays}d)</p>
            <p><span className="text-slate-500">Secondary:</span> {dashboard.activeProgram.secondaryContribution}</p>
            <p><span className="text-slate-500">Completed sessions:</span> {dashboard.completedSessionsCount}</p>
            <p><span className="text-slate-500">Since:</span> {formatDate(dashboard.windowStart)}</p>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested next workout</p>
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

      {dashboard.activeProgram ? (
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
                    Effective {formatNumber(row.effective)} / target {formatNumber(row.target)} · Direct {formatNumber(row.direct)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-400">No priority muscles configured for active program.</p>
          )}
        </Card>
      ) : null}

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fatigue context</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-100">{dashboard.fatigueTrend.latest?.category ?? "No metric log"}</h2>
          </div>
          {dashboard.fatigueTrend.latest?.score !== null && dashboard.fatigueTrend.latest?.score !== undefined ? (
            <span className="rounded-full bg-slate-800 px-3 py-1 text-sm font-semibold text-slate-200">{dashboard.fatigueTrend.latest.score}/100</span>
          ) : null}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-300">
          <p><span className="text-slate-500">Previous avg:</span> {formatNumber(dashboard.fatigueTrend.previousAverageScore, "/100", 0)}</p>
          <p><span className="text-slate-500">Trend:</span> {dashboard.fatigueTrend.isRising ? "Rising" : "Not rising"}</p>
        </div>
        <p className="mt-3 text-xs text-slate-500">Uses available metric values only. Missing fields are ignored.</p>
      </Card>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Decision flags</p>
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
                      <p><span className="text-slate-500">Direct</span><br />{formatNumber(row.direct)}</p>
                      <p><span className="text-slate-500">Effective</span><br />{formatNumber(row.effective)}</p>
                      <p><span className="text-slate-500">Target</span><br />{formatNumber(row.target)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-400">No completed workout volume in the selected window yet.</p>
            )}
          </Card>

          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Performance trend</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-100">{dashboard.performanceTrend.status}</h2>
            <p className="mt-1 text-sm text-slate-400">Compared exercises: {dashboard.performanceTrend.comparedExercises}</p>
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
          </Card>

          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Intensifier analytics</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-300">
              <p><span className="text-slate-500">Intensifier sets:</span><br />{dashboard.intensifiers.intensifierSets}</p>
              <p><span className="text-slate-500">Completed sets:</span><br />{dashboard.intensifiers.completedSets}</p>
              <p><span className="text-slate-500">Effective volume:</span><br />{dashboard.intensifiers.effectiveVolume}</p>
              <p><span className="text-slate-500">Intensifier share:</span><br />{dashboard.intensifiers.share}%</p>
            </div>
          </Card>

          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Movement coverage</p>
            {dashboard.movementCoverage.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {dashboard.movementCoverage.slice(0, 12).map((row: any) => (
                  <span key={row.movementGroupId} className="rounded-full border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-200">
                    {row.movementGroupName}: {row.completedSets}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-400">No completed movement exposure in the selected window yet.</p>
            )}
          </Card>

          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bodyweight / waist context</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-300">
              <p><span className="text-slate-500">Bodyweight:</span><br />{formatNumber(dashboard.bodyMetrics.latestBodyweight, " kg")}</p>
              <p><span className="text-slate-500">BW change:</span><br />{formatNumber(dashboard.bodyMetrics.bodyweightChange, " kg")}</p>
              <p><span className="text-slate-500">Waist:</span><br />{formatNumber(dashboard.bodyMetrics.latestWaist, " mm", 0)}</p>
              <p><span className="text-slate-500">Waist change:</span><br />{formatNumber(dashboard.bodyMetrics.waistChange, " mm", 0)}</p>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
