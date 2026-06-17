import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import {
  defaultProgramValues,
  phaseOptions,
  programTypeOptions,
  rotationStyleOptions,
  volumeWindowOptions,
} from "@/lib/programs/options";
import type { ProgramFormProgram, ReferenceMuscle } from "@/lib/types/domain";

type Props = {
  muscles: ReferenceMuscle[];
  program?: ProgramFormProgram | null;
  action: (formData: FormData) => Promise<void>;
  defaultSecondaryContribution?: number;
};

const inputClass = "min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-slate-400";
const selectClass = inputClass;

function toInputNumber(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function ProgramForm({ muscles, program, action, defaultSecondaryContribution = 0.5 }: Props) {
  const fallback = { ...defaultProgramValues("CUSTOM"), secondaryContribution: defaultSecondaryContribution };
  const priorityIds = new Set(program?.priorityMuscles.map((link: any) => link.muscleId) ?? []);
  const targetMap = new Map(program?.volumeTargets.map((target: any) => [target.muscleId, toInputNumber(target.weeklyTargetSets)]) ?? []);

  return (
    <form action={action} className="space-y-4">
      <Card className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Program name" name="name" defaultValue={program?.name ?? fallback.name} required />

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Program type</span>
            <select name="programType" defaultValue={program?.programType ?? "CUSTOM"} className={selectClass}>
              {programTypeOptions.map((option: any) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <Field
            label="Template count"
            name="templateCount"
            type="number"
            min={1}
            max={12}
            defaultValue={program?.templateCount ?? fallback.templateCount}
            required
          />

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rotation style</span>
            <select name="rotationStyle" defaultValue={program?.rotationStyle ?? fallback.rotationStyle} className={selectClass}>
              {rotationStyleOptions.map((option: any) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Volume window</span>
            <select name="volumeWindowType" defaultValue={program?.volumeWindowType ?? fallback.volumeWindowType} className={selectClass}>
              {volumeWindowOptions.map((option: any) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <Field
            label="Custom window days"
            name="customWindowDays"
            type="number"
            min={1}
            max={60}
            defaultValue={program?.customWindowDays ?? ""}
            hint="Used only when volume window is Custom."
          />

          <Field
            label="Secondary contribution"
            name="secondaryContribution"
            type="number"
            min={0}
            max={1}
            step="0.05"
            defaultValue={program ? toInputNumber(program.secondaryContribution, "0.5") : fallback.secondaryContribution}
            required
          />

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Phase</span>
            <select name="activePhase" defaultValue={program?.activePhase ?? "PUSH"} className={selectClass}>
              {phaseOptions.map((option: any) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
          <span>
            <span className="block text-sm font-semibold text-slate-200">Advanced muscle mode</span>
            <span className="block text-xs text-slate-500">Prepares future slices for granular muscle targets.</span>
          </span>
          <input name="advancedMuscleMode" type="checkbox" defaultChecked={program?.advancedMuscleMode ?? false} className="h-5 w-5" />
        </label>
      </Card>

      <Card>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-100">Priority muscles and weekly targets</h2>
          <p className="mt-1 text-sm text-slate-400">Targets are stored and used by dashboard calculations.</p>
        </div>
        <div className="space-y-2">
          {muscles.map((muscle: any) => (
            <div key={muscle.id} className="grid grid-cols-[1fr_96px] items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
              <label className="flex items-center gap-3 text-sm text-slate-200">
                <input type="checkbox" name="priorityMuscleIds" value={muscle.id} defaultChecked={priorityIds.has(muscle.id)} className="h-5 w-5" />
                <span>{muscle.name}</span>
              </label>
              <input
                aria-label={`${muscle.name} weekly target sets`}
                name={`target:${muscle.id}`}
                type="number"
                min={0}
                max={40}
                step="0.5"
                defaultValue={targetMap.get(muscle.id) ?? ""}
                placeholder="sets"
                className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-right text-base text-slate-100 outline-none focus:border-slate-400"
              />
            </div>
          ))}
        </div>
      </Card>

      <div className="sticky bottom-20 z-10 md:static">
        <Button className="w-full">Save program</Button>
      </div>
    </form>
  );
}
