import { createMetricLog } from "@/lib/server/metrics";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

const selectClass = "min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-slate-400";

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

type MetricDraft = {
  id: string;
  loggedAt: string;
  logType: string;
  bodyweight: number | null;
  waist: number | null;
  chest: number | null;
  shoulders: number | null;
  arms: number | null;
  thighs: number | null;
  glutes: number | null;
  calves: number | null;
  sleepDuration: number | null;
  sleepQuality: number | null;
  stress: number | null;
  readiness: number | null;
  manualFatigue: number | null;
  sorenessJointIrritation: number | null;
  steps: number | null;
  notes: string | null;
} | null;

function dateInputFromIso(value: string | null | undefined) {
  if (!value) return todayInputValue();
  return value.slice(0, 10);
}

export function MetricsForm({ visibility, draft }: { visibility: MetricVisibility; draft?: MetricDraft }) {
  return (
    <form action={createMetricLog} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
      <input type="hidden" name="draftId" value={draft?.id ?? ""} />
      <div>
        <h2 className="font-semibold text-slate-100">{draft ? "Continue metrics draft" : "Log metrics"}</h2>
        <p className="mt-1 text-sm text-slate-400">Core daily fields are bodyweight and waist. Everything else is optional context.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_1.3fr]">
        <Field label="Date" name="loggedAt" type="date" defaultValue={dateInputFromIso(draft?.loggedAt)} required />
        <label className="block space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Log type</span>
          <select name="logType" defaultValue={draft?.logType ?? "DAILY"} className={selectClass}>
            <option value="DAILY">Daily: bodyweight / waist</option>
            <option value="MESOCYCLE_START">Mesocycle start check-in</option>
            <option value="MESOCYCLE_END">Mesocycle end check-in</option>
            <option value="OPTIONAL_CHECKIN">Optional check-in</option>
          </select>
        </label>
      </div>

      {(visibility.bodyweight || visibility.waist) ? (
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
          {visibility.bodyweight ? <Field label="Bodyweight" name="bodyweight" type="number" step="0.1" inputMode="decimal" placeholder="75.6" defaultValue={draft?.bodyweight ?? ""} /> : null}
          {visibility.waist ? <Field label="Waist" name="waist" type="number" step="0.1" inputMode="decimal" placeholder="770" defaultValue={draft?.waist ?? ""} /> : null}
        </div>
      ) : null}

      <details className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">Mesocycle circumference check-in</summary>
        <p className="mt-2 text-xs text-slate-500">Use mainly for mesocycle start/end logs. Leave blank for normal daily logs.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Chest" name="chest" type="number" step="0.1" inputMode="decimal" defaultValue={draft?.chest ?? ""} />
          <Field label="Shoulders" name="shoulders" type="number" step="0.1" inputMode="decimal" defaultValue={draft?.shoulders ?? ""} />
          <Field label="Arms" name="arms" type="number" step="0.1" inputMode="decimal" defaultValue={draft?.arms ?? ""} />
          <Field label="Thighs" name="thighs" type="number" step="0.1" inputMode="decimal" defaultValue={draft?.thighs ?? ""} />
          <Field label="Glutes" name="glutes" type="number" step="0.1" inputMode="decimal" defaultValue={draft?.glutes ?? ""} />
          <Field label="Calves" name="calves" type="number" step="0.1" inputMode="decimal" defaultValue={draft?.calves ?? ""} />
        </div>
      </details>

      <details className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">Recovery / lifestyle context</summary>
        <div className="mt-3 space-y-3">
          {(visibility.sleep || visibility.steps) ? (
            <div className="grid grid-cols-2 gap-3">
              {visibility.sleep ? <Field label="Sleep h" name="sleepDuration" type="number" step="0.25" inputMode="decimal" placeholder="7.5" defaultValue={draft?.sleepDuration ?? ""} /> : null}
              {visibility.steps ? <Field label="Steps" name="steps" type="number" step="1" inputMode="numeric" placeholder="10000" defaultValue={draft?.steps ?? ""} /> : null}
            </div>
          ) : null}

          {(visibility.sleep || visibility.stress || visibility.readiness || visibility.fatigue) ? (
            <div className="grid grid-cols-2 gap-3">
              {visibility.sleep ? <Field label="Sleep quality 1–5" name="sleepQuality" type="number" min="1" max="5" step="1" inputMode="numeric" defaultValue={draft?.sleepQuality ?? ""} /> : null}
              {visibility.stress ? <Field label="Stress 1–5" name="stress" type="number" min="1" max="5" step="1" inputMode="numeric" defaultValue={draft?.stress ?? ""} /> : null}
              {visibility.readiness ? <Field label="Readiness 1–5" name="readiness" type="number" min="1" max="5" step="1" inputMode="numeric" defaultValue={draft?.readiness ?? ""} /> : null}
              {visibility.fatigue ? <Field label="Manual fatigue 1–5" name="manualFatigue" type="number" min="1" max="5" step="1" inputMode="numeric" defaultValue={draft?.manualFatigue ?? ""} /> : null}
            </div>
          ) : null}

          {visibility.soreness ? <Field label="Soreness / joint irritation 1–5" name="sorenessJointIrritation" type="number" min="1" max="5" step="1" inputMode="numeric" defaultValue={draft?.sorenessJointIrritation ?? ""} /> : null}
        </div>
      </details>

      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</span>
        <textarea
          name="notes"
          rows={3}
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-slate-400"
          placeholder="Optional context"
          defaultValue={draft?.notes ?? ""}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <Button type="submit" name="intent" value="draft" variant="secondary">Save draft</Button>
        <Button type="submit" name="intent" value="complete">Save metrics</Button>
      </div>
    </form>
  );
}
