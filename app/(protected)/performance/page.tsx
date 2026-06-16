import Link from "next/link";
import { BarChart3, Trophy } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { getExercisePerformanceData } from "@/lib/server/performance";

type PageProps = {
  searchParams: Promise<{ exerciseId?: string }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fi-FI", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatNumber(value: number | null | undefined, suffix = "", digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}${suffix}`;
}

function trendClass(status: string) {
  if (status === "Improving") return "border-emerald-800 bg-emerald-950/30 text-emerald-100";
  if (status === "Declining") return "border-red-800 bg-red-950/30 text-red-100";
  if (status === "Stable") return "border-slate-700 bg-slate-800/60 text-slate-200";
  return "border-slate-800 bg-slate-950/50 text-slate-300";
}

export default async function PerformancePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await getExercisePerformanceData(params);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Exercise Performance"
        description="Exercise-level progression view from completed workout sessions. Best set uses e1RM; volume load is secondary context."
      />

      <Card>
        <form className="space-y-3" action="/performance" method="get">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="exerciseId">
            Exercise
          </label>
          <div className="flex gap-2">
            <select
              id="exerciseId"
              name="exerciseId"
              defaultValue={data.selectedExercise?.id ?? ""}
              className="min-h-12 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-slate-400"
            >
              {data.exerciseOptions.length === 0 ? <option value="">No completed exercise data yet</option> : null}
              {data.exerciseOptions.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name} · {exercise.movementGroupName}
                </option>
              ))}
            </select>
            <button className="rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-950 hover:bg-white" type="submit">
              Load
            </button>
          </div>
        </form>
      </Card>

      {!data.selectedExercise ? (
        <Card>
          <h2 className="font-semibold text-slate-100">No completed exercise data</h2>
          <p className="mt-1 text-sm text-slate-400">Finish at least one workout before the performance view can show exercise trends.</p>
          <Link href="/log" className="mt-4 inline-flex rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-white">
            Open Logger
          </Link>
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected exercise</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-100">{data.selectedExercise.name}</h2>
              </div>
              <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-300">
                {data.selectedExercise.movementGroupName}
              </span>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
              <p><span className="text-slate-500">Primary:</span> {data.selectedExercise.primaryMuscles.join(", ") || "—"}</p>
              <p><span className="text-slate-500">Secondary:</span> {data.selectedExercise.secondaryMuscles.join(", ") || "—"}</p>
            </div>
          </Card>

          <Card className={trendClass(data.trend.status)}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">e1RM trend</p>
            <h2 className="mt-2 text-2xl font-semibold">{data.trend.status}</h2>
            <p className="mt-1 text-sm opacity-90">
              Change: {data.trend.changePct === null ? "insufficient data" : `${data.trend.changePct}%`}
            </p>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <div className="flex items-center gap-2 text-slate-100">
                <Trophy size={18} />
                <h2 className="font-semibold">Lifetime PR</h2>
              </div>
              {data.lifetimeBest ? (
                <div className="mt-3 text-sm text-slate-300">
                  <p className="text-xl font-semibold text-slate-100">{formatNumber(data.lifetimeBest.e1rm, " kg")}</p>
                  <p>{formatNumber(data.lifetimeBest.weight, " kg")} × {data.lifetimeBest.reps ?? "—"}</p>
                  <p className="text-slate-500">{formatDate(data.lifetimeBest.performedAt)} · {data.lifetimeBest.programName}</p>
                </div>
              ) : <p className="mt-2 text-sm text-slate-400">No completed weighted set yet.</p>}
            </Card>

            <Card>
              <div className="flex items-center gap-2 text-slate-100">
                <BarChart3 size={18} />
                <h2 className="font-semibold">Program PR</h2>
              </div>
              {data.programBest ? (
                <div className="mt-3 text-sm text-slate-300">
                  <p className="text-xl font-semibold text-slate-100">{formatNumber(data.programBest.e1rm, " kg")}</p>
                  <p>{formatNumber(data.programBest.weight, " kg")} × {data.programBest.reps ?? "—"}</p>
                  <p className="text-slate-500">{formatDate(data.programBest.performedAt)} · {data.activeProgramName}</p>
                </div>
              ) : <p className="mt-2 text-sm text-slate-400">No completed set for the active program yet.</p>}
            </Card>
          </div>

          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trend points</p>
            {data.e1rmTrend.length > 0 ? (
              <div className="mt-3 space-y-2">
                {data.e1rmTrend.slice(-8).map((point, index) => (
                  <div key={`${point.label}-${index}`} className="grid grid-cols-[92px_1fr_84px] items-center gap-2 text-sm text-slate-300">
                    <span className="text-slate-500">{formatDate(point.label)}</span>
                    <div className="h-2 rounded-full bg-slate-800">
                      <div
                        className="h-2 rounded-full bg-slate-300"
                        style={{ width: `${Math.min(100, Math.max(4, ((point.value ?? 0) / Math.max(...data.e1rmTrend.map((p) => p.value ?? 0), 1)) * 100))}%` }}
                      />
                    </div>
                    <span className="text-right">{formatNumber(point.value, " kg")}</span>
                  </div>
                ))}
              </div>
            ) : <p className="mt-2 text-sm text-slate-400">No e1RM points available.</p>}
          </Card>

          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent exposures</p>
            <div className="mt-3 space-y-3">
              {data.exposures.length > 0 ? data.exposures.slice(0, 10).map((exposure) => (
                <div key={exposure.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-100">{formatDate(exposure.performedAt)}</p>
                      <p className="text-sm text-slate-400">{exposure.programName} · {exposure.templateName}</p>
                    </div>
                    <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">{exposure.completedSetCount} sets</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-300">
                    <p><span className="text-slate-500">Best e1RM</span><br />{formatNumber(exposure.bestSet?.e1rm, " kg")}</p>
                    <p><span className="text-slate-500">Volume load</span><br />{formatNumber(exposure.volumeLoad, " kg", 0)}</p>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-slate-400">
                    {exposure.sets.filter((set) => set.isCompleted).map((set) => (
                      <p key={set.id}>
                        Set {set.setNumber}: {formatNumber(set.weight, " kg")} × {set.reps ?? "—"}, RIR {set.rir ?? "—"}, {set.setTypeName}{set.isIntensifier ? " · intensifier" : ""}
                      </p>
                    ))}
                  </div>
                  {exposure.painFlag ? <p className="mt-2 text-xs text-amber-300">Pain/discomfort flag: {exposure.painNote || "noted"}</p> : null}
                  {exposure.isSubstitution ? <p className="mt-1 text-xs text-slate-500">Substitution exposure</p> : null}
                </div>
              )) : <p className="text-sm text-slate-400">No completed exposures for this exercise yet.</p>}
            </div>
          </Card>

          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comparable exercise context</p>
            {data.comparable.length > 0 ? (
              <div className="mt-3 space-y-2">
                {data.comparable.map((item) => (
                  <div key={item.exerciseName} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-100">{item.exerciseName}</p>
                      <p>{item.exposures} exposures</p>
                    </div>
                    <p className="mt-1 text-slate-400">Best e1RM: {formatNumber(item.bestE1rm, " kg")} · Latest {formatDate(item.latestExposureAt)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-400">No comparable completed exercises from the same movement group yet.</p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
