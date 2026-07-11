import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricsForm } from "@/components/metrics/MetricsForm";
import { getMetricsPageData } from "@/lib/server/metrics";
import { getUserSettingsForMetrics } from "@/lib/server/settings";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function valueOrDash(value: number | string | null | undefined, suffix = "") {
  if (value === null || value === undefined || value === "") return "—";
  return `${value}${suffix}`;
}

export default async function MetricsPage({ searchParams }: { searchParams?: Promise<{ saved?: string; draft?: string }> }) {
  const params = await searchParams;
  const [metricsData, metricVisibility] = await Promise.all([getMetricsPageData(), getUserSettingsForMetrics()]);
  const { logs, draft } = metricsData;

  return (
    <div className="space-y-5">
      <PageHeader title="Metrics" description="Daily bodyweight/waist plus mesocycle start/end circumference check-ins." />

      {params?.saved ? (
        <div className="rounded-2xl border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-100">Metrics saved.</div>
      ) : null}

      {params?.draft ? (
        <div className="rounded-2xl border border-sky-900 bg-sky-950/40 p-3 text-sm text-sky-100">Metrics draft saved.</div>
      ) : null}

      {draft ? (
        <div className="rounded-2xl border border-amber-900 bg-amber-950/30 p-3 text-sm text-amber-100">You have an active metrics draft. The form below is prefilled from it.</div>
      ) : null}

      <MetricsForm visibility={metricVisibility} draft={draft} />

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-100">Recent logs</h2>
            <p className="mt-1 text-sm text-slate-400">Latest entries are shown first.</p>
          </div>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">{logs.length}</span>
        </div>

        <div className="mt-4 space-y-3">
          {logs.length === 0 ? (
            <p className="text-sm text-slate-500">No metric logs yet.</p>
          ) : (
            logs.map((log: any) => (
              <div key={log.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-100">{formatDate(log.loggedAt)}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{log.logType?.replaceAll("_", " ").toLowerCase()} · Fatigue: {log.fatigue.category}{log.fatigue.score !== null ? ` · ${log.fatigue.score}` : ""}</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-300">
                  <p><span className="text-slate-500">BW:</span> {valueOrDash(log.bodyweight, " kg")}</p>
                  <p><span className="text-slate-500">Waist:</span> {valueOrDash(log.waist, " mm")}</p>
                  <p><span className="text-slate-500">Sleep:</span> {valueOrDash(log.sleepDuration, " h")}</p>
                  <p><span className="text-slate-500">Steps:</span> {valueOrDash(log.steps)}</p>
                  <p><span className="text-slate-500">Stress:</span> {valueOrDash(log.stress)}</p>
                  <p><span className="text-slate-500">Readiness:</span> {valueOrDash(log.readiness)}</p>
                  <p><span className="text-slate-500">Fatigue:</span> {valueOrDash(log.manualFatigue)}</p>
                  <p><span className="text-slate-500">Soreness:</span> {valueOrDash(log.sorenessJointIrritation)}</p>
                </div>

                {[log.chest, log.shoulders, log.arms, log.thighs, log.glutes, log.calves].some((value) => value !== null && value !== undefined) ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-2 text-sm text-slate-300 md:grid-cols-3">
                    <p><span className="text-slate-500">Chest:</span> {valueOrDash(log.chest, " mm")}</p>
                    <p><span className="text-slate-500">Shoulders:</span> {valueOrDash(log.shoulders, " mm")}</p>
                    <p><span className="text-slate-500">Arms:</span> {valueOrDash(log.arms, " mm")}</p>
                    <p><span className="text-slate-500">Thighs:</span> {valueOrDash(log.thighs, " mm")}</p>
                    <p><span className="text-slate-500">Glutes:</span> {valueOrDash(log.glutes, " mm")}</p>
                    <p><span className="text-slate-500">Calves:</span> {valueOrDash(log.calves, " mm")}</p>
                  </div>
                ) : null}

                {log.notes ? <p className="mt-3 text-sm text-slate-400">{log.notes}</p> : null}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
