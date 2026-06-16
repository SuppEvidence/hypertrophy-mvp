import { createMetricLog } from "@/lib/server/metrics";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

type MetricVisibility = {
  bodyweight: boolean;
  waist: boolean;
  sleep: boolean;
  stress: boolean;
  readiness: boolean;
  fatigue: boolean;
  soreness: boolean;
  steps: boolean;
};

export function MetricsForm({ visibility }: { visibility: MetricVisibility }) {
  return (
    <form action={createMetricLog} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
      <div>
        <h2 className="font-semibold text-slate-100">Log metrics</h2>
        <p className="mt-1 text-sm text-slate-400">All visible fields are optional except date. Missing values are ignored in fatigue scoring.</p>
      </div>

      <Field label="Date" name="loggedAt" type="date" defaultValue={todayInputValue()} required />

      {(visibility.bodyweight || visibility.waist) ? (
        <div className="grid grid-cols-2 gap-3">
          {visibility.bodyweight ? <Field label="Bodyweight" name="bodyweight" type="number" step="0.1" inputMode="decimal" placeholder="75.6" /> : null}
          {visibility.waist ? <Field label="Waist" name="waist" type="number" step="0.1" inputMode="decimal" placeholder="770" /> : null}
        </div>
      ) : null}

      {(visibility.sleep || visibility.steps) ? (
        <div className="grid grid-cols-2 gap-3">
          {visibility.sleep ? <Field label="Sleep h" name="sleepDuration" type="number" step="0.25" inputMode="decimal" placeholder="7.5" /> : null}
          {visibility.steps ? <Field label="Steps" name="steps" type="number" step="1" inputMode="numeric" placeholder="10000" /> : null}
        </div>
      ) : null}

      {(visibility.sleep || visibility.stress || visibility.readiness || visibility.fatigue) ? (
        <div className="grid grid-cols-2 gap-3">
          {visibility.sleep ? <Field label="Sleep quality 1–5" name="sleepQuality" type="number" min="1" max="5" step="1" inputMode="numeric" /> : null}
          {visibility.stress ? <Field label="Stress 1–5" name="stress" type="number" min="1" max="5" step="1" inputMode="numeric" /> : null}
          {visibility.readiness ? <Field label="Readiness 1–5" name="readiness" type="number" min="1" max="5" step="1" inputMode="numeric" /> : null}
          {visibility.fatigue ? <Field label="Manual fatigue 1–5" name="manualFatigue" type="number" min="1" max="5" step="1" inputMode="numeric" /> : null}
        </div>
      ) : null}

      {visibility.soreness ? <Field label="Soreness / joint irritation 1–5" name="sorenessJointIrritation" type="number" min="1" max="5" step="1" inputMode="numeric" /> : null}

      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</span>
        <textarea
          name="notes"
          rows={3}
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-slate-400"
          placeholder="Optional context"
        />
      </label>

      <Button type="submit" className="w-full">Save metrics</Button>
    </form>
  );
}
