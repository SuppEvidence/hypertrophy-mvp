import Link from "next/link";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import {
  addTemplateExercise,
  moveTemplateExercise,
  removeTemplateExercise,
  renameTemplate,
  updateTemplateExercise,
} from "@/lib/server/templates";
import { buildTemplateTargetNotices, buildTemplateVolumePreview } from "@/lib/templates/volumePreview";
import { programTypeLabels, rotationStyleLabels, volumeWindowLabels } from "@/lib/programs/options";
import type { ProgramType, RotationStyle, VolumeWindowType } from "@/lib/types/domain";

type MuscleReference = {
  id: string;
  name: string;
  sortOrder: number;
};

type MuscleLink = {
  muscleId: string;
  muscle: MuscleReference;
};

type ProgramForTemplateBuilder = {
  id: string;
  name: string;
  programType: ProgramType;
  rotationStyle: RotationStyle;
  volumeWindowType: VolumeWindowType;
  customWindowDays: number | null;
  secondaryContribution: unknown;
  priorityMuscles?: Array<{ muscleId: string }>;
  volumeTargets?: Array<{
    muscleId: string;
    weeklyTargetSets: unknown;
    muscle: MuscleReference;
  }>;
};

type WorkoutTemplateForBuilder = {
  id: string;
  name: string;
  sequenceIndex?: number;
  weekday?: number | null;
};

type MovementGroupReference = {
  id?: string;
  name: string;
};

type ExerciseForTemplateBuilder = {
  id: string;
  name: string;
  movementGroup: MovementGroupReference;
  primaryMuscles: MuscleLink[];
  secondaryMuscles: MuscleLink[];
};

type SetTypeForTemplateBuilder = {
  id: string;
  name: string;
  slug: string;
  multiplier: unknown;
};

type TemplateExerciseForBuilder = {
  id: string;
  exerciseId: string;
  plannedSets: number;
  minReps: number | null;
  maxReps: number | null;
  rirTarget: unknown | null;
  defaultSetTypeId: string;
  notes: string | null;
  defaultSetType: { multiplier: unknown };
  exercise: ExerciseForTemplateBuilder;
};

type TemplateTargetNotice = {
  muscleId: string;
  muscleName: string;
  effective: number;
  target: number;
  status: "below" | "above" | "excessive" | "on";
};

type TemplateVolumePreviewRow = {
  muscleId: string;
  muscleName: string;
  direct: number;
  effective: number;
  target: number | null;
};

type Props = {
  programs: ProgramForTemplateBuilder[];
  selectedProgram: ProgramForTemplateBuilder | null;
  templates: WorkoutTemplateForBuilder[];
  selectedTemplate: WorkoutTemplateForBuilder | null;
  templateExercises: TemplateExerciseForBuilder[];
  exercises: ExerciseForTemplateBuilder[];
  setTypes: SetTypeForTemplateBuilder[];
};

const selectClass =
  "min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-400";

export function TemplateBuilder({ programs, selectedProgram, templates, selectedTemplate, templateExercises, exercises, setTypes }: Props) {
  if (!selectedProgram) {
    return (
      <Card>
        <h2 className="text-lg font-semibold text-slate-100">No program yet</h2>
        <p className="mt-2 text-sm text-slate-400">Create a program before building templates.</p>
        <Link href="/programs" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-950">
          Go to programs
        </Link>
      </Card>
    );
  }

  const preview = buildTemplateVolumePreview({ program: selectedProgram, templateExercises }) as TemplateVolumePreviewRow[];
  const targetNotices = buildTemplateTargetNotices({ program: selectedProgram, preview }) as TemplateTargetNotice[];
  const normalSetType = setTypes.find((setType: SetTypeForTemplateBuilder) => setType.slug === "normal") ?? setTypes[0];

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Program</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">{selectedProgram.name}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {programTypeLabels[selectedProgram.programType]} · {rotationStyleLabels[selectedProgram.rotationStyle]} · {volumeWindowLabels[selectedProgram.volumeWindowType]} · secondary {Number(selectedProgram.secondaryContribution)}
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {programs.map((program: ProgramForTemplateBuilder) => (
            <Link
              key={program.id}
              href={`/templates?programId=${program.id}`}
              className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ${
                program.id === selectedProgram.id
                  ? "border-slate-100 bg-slate-100 text-slate-950"
                  : "border-slate-700 bg-slate-950 text-slate-300"
              }`}
            >
              {program.name}
            </Link>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Templates</p>
          <p className="mt-1 text-sm text-slate-400">Generated from the program template count. Template content is now persisted.</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {templates.map((template: WorkoutTemplateForBuilder) => (
            <Link
              key={template.id}
              href={`/templates?programId=${selectedProgram.id}&templateId=${template.id}`}
              className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ${
                template.id === selectedTemplate?.id
                  ? "border-slate-100 bg-slate-100 text-slate-950"
                  : "border-slate-700 bg-slate-950 text-slate-300"
              }`}
            >
              {template.name}
            </Link>
          ))}
        </div>
      </Card>

      {selectedTemplate ? (
        <>
          <Card>
            <form action={renameTemplate.bind(null, selectedTemplate.id)} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <Field label="Template name" name="name" defaultValue={selectedTemplate.name} required />
              <Button>Save name</Button>
            </form>
          </Card>

          <Card className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-100">Add exercise</h2>
              <p className="mt-1 text-sm text-slate-400">Add planned exercise exposure. Logging comes in a later slice.</p>
            </div>
            <form action={addTemplateExercise.bind(null, selectedTemplate.id)} className="space-y-3">
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Exercise</span>
                <select name="exerciseId" className={selectClass} required>
                  {exercises.map((exercise: ExerciseForTemplateBuilder) => (
                    <option key={exercise.id} value={exercise.id}>
                      {exercise.name} · {exercise.movementGroup.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <Field label="Sets" name="plannedSets" type="number" min={1} max={20} defaultValue={2} required />
                <Field label="Min reps" name="minReps" type="number" min={1} max={100} />
                <Field label="Max reps" name="maxReps" type="number" min={1} max={100} />
                <Field label="RIR" name="rirTarget" type="number" min={0} max={10} step="0.5" defaultValue={2} />
                <label className="block space-y-2 col-span-2 md:col-span-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Set type</span>
                  <select name="defaultSetTypeId" className={selectClass} defaultValue={normalSetType?.id} required>
                    {setTypes.map((setType: SetTypeForTemplateBuilder) => (
                      <option key={setType.id} value={setType.id}>
                        {setType.name} ×{Number(setType.multiplier)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <Field label="Notes" name="notes" placeholder="Optional" />
              <Button className="w-full">Add to template</Button>
            </form>
          </Card>

          <Card className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-100">Planned exercises</h2>
              <p className="mt-1 text-sm text-slate-400">Each row is editable and persisted separately.</p>
            </div>
            {templateExercises.length === 0 ? (
              <p className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">No exercises in this template yet.</p>
            ) : (
              <div className="space-y-3">
                {templateExercises.map((item: TemplateExerciseForBuilder, index: number) => (
                  <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{index + 1}. {item.exercise.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.exercise.movementGroup.name} · Primary: {item.exercise.primaryMuscles.map((link: MuscleLink) => link.muscle.name).join(", ") || "—"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Secondary: {item.exercise.secondaryMuscles.map((link: MuscleLink) => link.muscle.name).join(", ") || "—"}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <form action={moveTemplateExercise}>
                          <input type="hidden" name="templateExerciseId" value={item.id} />
                          <input type="hidden" name="direction" value="up" />
                          <Button variant="ghost" className="min-h-9 px-2" disabled={index === 0} aria-label="Move up"><ArrowUp size={16} /></Button>
                        </form>
                        <form action={moveTemplateExercise}>
                          <input type="hidden" name="templateExerciseId" value={item.id} />
                          <input type="hidden" name="direction" value="down" />
                          <Button variant="ghost" className="min-h-9 px-2" disabled={index === templateExercises.length - 1} aria-label="Move down"><ArrowDown size={16} /></Button>
                        </form>
                      </div>
                    </div>

                    <form action={updateTemplateExercise.bind(null, item.id)} className="space-y-3">
                      <label className="block space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Exercise</span>
                        <select name="exerciseId" defaultValue={item.exerciseId} className={selectClass} required>
                          {exercises.map((exercise: ExerciseForTemplateBuilder) => (
                            <option key={exercise.id} value={exercise.id}>{exercise.name}</option>
                          ))}
                        </select>
                      </label>

                      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                        <Field label="Sets" name="plannedSets" type="number" min={1} max={20} defaultValue={item.plannedSets} required />
                        <Field label="Min reps" name="minReps" type="number" min={1} max={100} defaultValue={item.minReps ?? ""} />
                        <Field label="Max reps" name="maxReps" type="number" min={1} max={100} defaultValue={item.maxReps ?? ""} />
                        <Field label="RIR" name="rirTarget" type="number" min={0} max={10} step="0.5" defaultValue={item.rirTarget === null ? "" : Number(item.rirTarget)} />
                        <label className="block space-y-2 col-span-2 md:col-span-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Set type</span>
                          <select name="defaultSetTypeId" defaultValue={item.defaultSetTypeId} className={selectClass} required>
                            {setTypes.map((setType: SetTypeForTemplateBuilder) => (
                              <option key={setType.id} value={setType.id}>{setType.name} ×{Number(setType.multiplier)}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <Field label="Notes" name="notes" defaultValue={item.notes ?? ""} />
                      <Button className="w-full">Save row</Button>
                    </form>

                    <form action={removeTemplateExercise} className="mt-2">
                      <input type="hidden" name="templateExerciseId" value={item.id} />
                      <Button variant="danger" className="w-full gap-2"><Trash2 size={16} /> Remove exercise</Button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-slate-100">Planned volume preview</h2>
              <p className="mt-1 text-sm text-slate-400">Direct sets count primary exposure. Effective sets apply set-type multiplier and secondary contribution.</p>
            </div>
            {targetNotices.length > 0 ? (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
                <p className="font-semibold text-amber-100">Target coverage notice</p>
                <p className="mt-1 text-xs text-amber-100/80">Planned template volume is not aligned with one or more selected-window targets. This may be expected if target exposure is distributed across several templates.</p>
                <div className="mt-2 space-y-1 text-xs text-amber-100/90">
                  {targetNotices.slice(0, 5).map((notice: TemplateTargetNotice) => (
                    <p key={notice.muscleId}>
                      {notice.muscleName}: effective {notice.effective.toFixed(1)} / target {notice.target.toFixed(1)} · {notice.status === "below" ? "below target" : notice.status === "above" ? "above target" : "excessive"}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            {preview.length === 0 ? (
              <p className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">Add exercises to see planned volume.</p>
            ) : (
              <div className="space-y-2">
                {preview.map((row: TemplateVolumePreviewRow) => {
                  const targetWarning = row.target !== null && row.effective > row.target;
                  return (
                    <div key={row.muscleId} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{row.muscleName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Direct {row.direct.toFixed(1)} · Effective {row.effective.toFixed(1)}{row.target !== null ? ` · Window target ${row.target.toFixed(1)}` : ""}
                        </p>
                        {targetWarning ? <p className="mt-1 text-xs text-amber-300">This template alone exceeds the selected-window target for this muscle.</p> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
