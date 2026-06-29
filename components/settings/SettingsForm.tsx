import { createCustomSetType, toggleCustomSetType, updateSetTypeMultiplier, updateUserSettings } from "@/lib/server/settings";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";

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

type SettingsFormProps = {
  settings: {
    preferredUnit: "KG" | "LB";
    defaultSecondaryContribution: number;
    advancedMuscleMode: boolean;
    metricVisibility: MetricVisibility;
  };
  setTypes: Array<{
    id: string;
    name: string;
    multiplier: number;
    isIntensifier: boolean;
    isEditable: boolean;
    isActive: boolean;
    isCustom: boolean;
    description: string;
  }>;
};

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-3 text-sm">
      <span className="font-medium text-slate-200">{label}</span>
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="h-5 w-5 accent-slate-100" />
    </label>
  );
}

export function SettingsForm({ settings, setTypes }: SettingsFormProps) {
  const metrics = settings.metricVisibility;

  return (
    <div className="space-y-5">
      <form action={updateUserSettings}>
        <Card className="space-y-4">
          <div>
            <h2 className="font-semibold text-slate-100">General settings</h2>
            <p className="mt-1 text-sm text-slate-400">Persistent defaults used by future program and logging flows.</p>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Preferred unit</span>
            <select name="preferredUnit" defaultValue={settings.preferredUnit} className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-slate-400">
              <option value="KG">kg</option>
              <option value="LB">lb</option>
            </select>
          </label>

          <Field
            label="Default secondary contribution"
            name="defaultSecondaryContribution"
            type="number"
            step="0.05"
            min="0"
            max="1"
            inputMode="decimal"
            defaultValue={settings.defaultSecondaryContribution}
            hint="Used as the default when creating future programs. Existing programs keep their own value."
          />

          <Toggle name="advancedMuscleMode" label="Advanced muscle mode" defaultChecked={settings.advancedMuscleMode} />
        </Card>

        <Card className="mt-5 space-y-4">
          <div>
            <h2 className="font-semibold text-slate-100">Metric visibility</h2>
            <p className="mt-1 text-sm text-slate-400">Controls which optional fields appear in the Metrics Logger. Hidden fields remain optional and do not affect existing logs.</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Toggle name="metric_bodyweight" label="Bodyweight" defaultChecked={metrics.bodyweight} />
            <Toggle name="metric_waist" label="Waist" defaultChecked={metrics.waist} />
            <Toggle name="metric_sleep" label="Sleep" defaultChecked={metrics.sleep} />
            <Toggle name="metric_stress" label="Stress" defaultChecked={metrics.stress} />
            <Toggle name="metric_readiness" label="Readiness" defaultChecked={metrics.readiness} />
            <Toggle name="metric_fatigue" label="Manual fatigue" defaultChecked={metrics.fatigue} />
            <Toggle name="metric_soreness" label="Soreness / joint irritation" defaultChecked={metrics.soreness} />
            <Toggle name="metric_steps" label="Steps" defaultChecked={metrics.steps} />
          </div>

          <Button type="submit" className="w-full">Save settings</Button>
        </Card>
      </form>

      <Card className="space-y-4">
        <div>
          <h2 className="font-semibold text-slate-100">Set types and intensifiers</h2>
          <p className="mt-1 text-sm text-slate-400">Editable intensifier multipliers feed template previews, workout summaries, and dashboard effective-volume calculations.</p>
        </div>

        <form action={createCustomSetType} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
          <div className="grid gap-3 md:grid-cols-[1fr_120px]">
            <Field label="Custom set type" name="name" placeholder="Mechanical drop set" required />
            <Field
              label="Multiplier"
              name="multiplier"
              type="number"
              min="1"
              max="3"
              step="0.05"
              inputMode="decimal"
              defaultValue="1.25"
              required
            />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <Field label="Description" name="description" placeholder="Optional note for how you count this set type." />
            <label className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200">
              <input name="isIntensifier" type="checkbox" defaultChecked className="h-5 w-5" />
              Intensifier
            </label>
          </div>
          <Button type="submit" variant="secondary" className="mt-3 w-full">Add custom set type</Button>
        </form>

        <div className="space-y-3">
          {setTypes.map((setType: any) => (
            <form key={setType.id} action={updateSetTypeMultiplier} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
              <input type="hidden" name="setTypeId" value={setType.id} />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-100">{setType.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                    {setType.isCustom ? "Custom" : "Built-in"} · {setType.isIntensifier ? "Intensifier" : "Base set"} · {setType.isActive ? "Active" : "Hidden"}
                  </p>
                  {setType.description ? <p className="mt-1 text-sm text-slate-500">{setType.description}</p> : null}
                </div>
                <span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-300">×{setType.multiplier}</span>
              </div>
              <div className="mt-3 flex items-end gap-3">
                <Field
                  label="Multiplier"
                  name="multiplier"
                  type="number"
                  min="1"
                  max="3"
                  step="0.05"
                  inputMode="decimal"
                  defaultValue={setType.multiplier}
                  disabled={!setType.isEditable}
                  className="text-sm"
                />
                <Button type="submit" variant="secondary" disabled={!setType.isEditable} className="mb-0 min-w-24">
                  Save
                </Button>
              </div>
              {!setType.isEditable ? <p className="mt-2 text-xs text-slate-500">Normal set multiplier is locked.</p> : null}
              {setType.isCustom ? (
                <div className="mt-3 border-t border-slate-800 pt-3">
                  <button
                    formAction={toggleCustomSetType}
                    className="text-sm font-semibold text-slate-300 hover:text-slate-100"
                  >
                    {setType.isActive ? "Hide from planning/logging" : "Restore to planning/logging"}
                  </button>
                </div>
              ) : null}
            </form>
          ))}
        </div>
      </Card>
    </div>
  );
}
