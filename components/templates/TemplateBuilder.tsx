import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import {
  addTemplateExercise,
  moveTemplateExercise,
  removeTemplateExercise,
  renameTemplate,
  updateTemplateExercise,
  updateTemplateExerciseSetPlan,
  updateTemplateExpectedOccurrences,
  updateProgramRotationSequence,
  updateProgramWeeklyMissedWorkouts,
} from "@/lib/server/templates";
import { buildTemplateTargetNotices, buildTemplateVolumePreview, type TemplateVolumePreviewRow } from "@/lib/templates/volumePreview";
import { repBuckets, slotPriorities, slotRoles } from "@/lib/planning/mesocycleGenerator";
import { programTypeLabels, rotationStyleLabels, volumeWindowDays, volumeWindowLabels } from "@/lib/programs/options";
import type { ProgramType, RotationStyle, VolumeWindowType } from "@/lib/types/domain";

type BuilderData = Awaited<ReturnType<typeof import("@/lib/server/templates").getTemplateBuilderData>>;
type Props = BuilderData;

type TemplateProgram = NonNullable<Props["selectedProgram"]> & {
  programType: ProgramType;
  rotationStyle: RotationStyle;
  volumeWindowType: VolumeWindowType;
};

type TemplateOption = Props["templates"][number] & {
  expectedOccurrences?: unknown;
};

type TemplateExerciseItem = Props["templateExercises"][number];
type TemplateExerciseSetPlan = TemplateExerciseItem["setPlans"][number];
type AllTemplateExerciseItem = Props["allTemplateExercises"][number] & {
  template: {
    id: string;
    name: string;
    sequenceIndex: number;
    expectedOccurrences: unknown;
  };
};
type MovementGroupOption = Props["movementGroups"][number];
type SetTypeOption = Props["setTypes"][number];
type GeneratedTemplateItem = Props["generatedTemplateItems"][number] & {
  weeklyAdjustedPlannedSets: number;
  weeklyAdjustmentDelta: number;
  isMissedThisWeek: boolean;
  weeklyAdjustmentReason: string | null;
};

type WeeklyPlanSummary = {
  weekStart: string;
  missedTemplateIds: string[];
  completedTemplateIds: string[];
  missedSets: number;
  reallocatedSets: number;
  unallocatedSets: number;
};
type TargetNotice = ReturnType<typeof buildTemplateTargetNotices>[number];

const selectClass =
  "min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-400";

function formatNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function VolumePreviewBlock({ rows, emptyText }: { rows: TemplateVolumePreviewRow[]; emptyText: string }) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row: TemplateVolumePreviewRow) => {
        const targetWarning = row.target !== null && row.effective > row.target;
        return (
          <div key={row.muscleId} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div>
              <p className="text-sm font-semibold text-slate-100">{row.muscleName}</p>
              <p className="mt-1 text-xs text-slate-500">
                Direct {row.direct.toFixed(1)} · Effective {row.effective.toFixed(1)}
                {row.target !== null ? ` · Window target ${row.target.toFixed(1)}` : ""}
              </p>
              {targetWarning ? <p className="mt-1 text-xs text-amber-300">This planned volume exceeds the selected-window target for this muscle.</p> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SetTypeSelect({ setTypes, defaultValue }: { setTypes: SetTypeOption[]; defaultValue?: string | null }) {
  return (
    <select name="setTypeId" defaultValue={defaultValue ?? setTypes[0]?.id} className={selectClass} required>
      {setTypes.map((setType: SetTypeOption) => (
        <option key={setType.id} value={setType.id}>
          {setType.name} ×{Number(setType.multiplier)}
        </option>
      ))}
    </select>
  );
}

function OptionSelect({ name, defaultValue, options }: { name: string; defaultValue?: string | null; options: ReadonlyArray<{ value: string; label: string }> }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{name.replace(/([A-Z])/g, " $1")}</span>
      <select name={name} defaultValue={defaultValue ?? options[0]?.value} className={selectClass}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

export function TemplateBuilder({ programs, selectedProgram, templates, selectedTemplate, templateExercises, allTemplateExercises, movementGroups, setTypes, prescription, generatedTemplateItems, rotationSequenceText }: Props) {
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

  const typedSelectedProgram = selectedProgram as TemplateProgram;
  const typedPrograms = programs as TemplateProgram[];
  const typedTemplates = templates as TemplateOption[];
  const typedTemplateExercises = templateExercises as TemplateExerciseItem[];
  const typedAllTemplateExercises = allTemplateExercises as AllTemplateExerciseItem[];
  const typedMovementGroups = movementGroups as MovementGroupOption[];
  const typedSetTypes = setTypes as SetTypeOption[];
  const typedGeneratedTemplateItems = generatedTemplateItems as GeneratedTemplateItem[];
  const typedRotationSequenceText = String(rotationSequenceText ?? "");
  const weeklyPlan = (prescription?.generated.weeklyPlan ?? null) as WeeklyPlanSummary | null;
  const allGeneratedItems = (prescription?.generated.items ?? []) as GeneratedTemplateItem[];
  const generatedByTemplateExercise = new Map(typedGeneratedTemplateItems.map((item: GeneratedTemplateItem) => [item.id, item]));
  const weeklyTemplateRows = typedTemplates.map((template) => {
    const items = allGeneratedItems.filter((item) => item.templateId === template.id);
    return {
      templateId: template.id,
      baseSets: items.reduce((sum, item) => sum + item.adjustedPlannedSets, 0),
      plannedSets: items.reduce((sum, item) => sum + item.weeklyAdjustedPlannedSets, 0),
      changes: items.filter((item) => item.weeklyAdjustmentDelta !== 0),
    };
  });

  const selectedTemplatePreview = buildTemplateVolumePreview({
    program: typedSelectedProgram,
    templateExercises: typedTemplateExercises.map((item: TemplateExerciseItem) => ({ ...item, occurrenceMultiplier: 1 })),
  });
  const programPreview = buildTemplateVolumePreview({
    program: typedSelectedProgram,
    templateExercises: typedAllTemplateExercises.map((item: AllTemplateExerciseItem) => ({
      ...item,
      occurrenceMultiplier: item.template.expectedOccurrences,
    })),
  });
  const targetNotices = buildTemplateTargetNotices({ program: typedSelectedProgram, preview: programPreview });
  const normalSetType = typedSetTypes.find((setType: SetTypeOption) => setType.slug === "normal") ?? typedSetTypes[0];
  const windowDays = volumeWindowDays(typedSelectedProgram.volumeWindowType, typedSelectedProgram.customWindowDays ?? null);

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Program</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">{typedSelectedProgram.name}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {programTypeLabels[typedSelectedProgram.programType]} · {rotationStyleLabels[typedSelectedProgram.rotationStyle]} · {volumeWindowLabels[typedSelectedProgram.volumeWindowType]} · secondary {Number(typedSelectedProgram.secondaryContribution)}
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {typedPrograms.map((program: TemplateProgram) => (
            <Link
              key={program.id}
              href={`/templates?programId=${program.id}`}
              className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ${
                program.id === typedSelectedProgram.id
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
          <p className="mt-1 text-sm text-slate-400">Generated from the program template count. Planned volume uses expected occurrences in the selected {windowDays}-day window.</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {typedTemplates.map((template: TemplateOption) => (
            <Link
              key={template.id}
              href={`/templates?programId=${typedSelectedProgram.id}&templateId=${template.id}`}
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

      <Card className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Template rotation and expected occurrences</h2>
          <p className="mt-1 text-sm text-slate-400">
            Rotation sequence controls the repeated next-workout order. Template order controls labels/fallback order. Expected occurrences controls planned volume inside the selected {windowDays}-day volume window.
          </p>
        </div>

        <form action={updateProgramRotationSequence.bind(null, typedSelectedProgram.id)} className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
          <input type="hidden" name="selectedTemplateId" value={selectedTemplate?.id ?? typedTemplates[0]?.id ?? ""} />
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rotation sequence</span>
            <textarea
              name="rotationSequence"
              rows={2}
              defaultValue={typedRotationSequenceText}
              placeholder="A, B, C, A, B, C, D"
              className={`${selectClass} min-h-20 py-3`}
            />
          </label>
          <p className="text-xs text-slate-500">
            Use template letters or names. Duplicates are allowed, e.g. A, B, C, A, B, C, D for a 14-day rolling sequence with D occurring once.
          </p>
          <Button className="w-full sm:w-auto">Save rotation sequence</Button>
        </form>

        <div className="space-y-2">
          {typedTemplates.map((template: TemplateOption) => (
            <form key={template.id} action={updateTemplateExpectedOccurrences.bind(null, template.id)} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 sm:grid-cols-[1fr_6rem_7rem_auto] sm:items-end">
              <input type="hidden" name="selectedTemplateId" value={selectedTemplate?.id ?? template.id} />
              <div>
                <p className="text-sm font-semibold text-slate-100">{template.name}</p>
                <p className="mt-1 text-xs text-slate-500">Order/label and planned exposure in {windowDays}d.</p>
              </div>
              <Field
                label="Order"
                name="sequencePosition"
                type="number"
                min={1}
                max={typedTemplates.length}
                step="1"
                defaultValue={Number(template.sequenceIndex ?? 0) + 1}
              />
              <Field
                label="Times"
                name="expectedOccurrences"
                type="number"
                min={0}
                max={30}
                step="0.25"
                defaultValue={formatNumber(template.expectedOccurrences, 1)}
              />
              <Button className="min-h-11 px-3">Save</Button>
            </form>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100">This week availability</h2>
          <p className="mt-1 text-sm text-slate-400">
            Mark a workout that will be missed. Its movement-pattern sets are spread across remaining, not-yet-completed workouts where matching slots have capacity.
          </p>
          {weeklyPlan ? <p className="mt-1 text-xs text-slate-500">Week starting {weeklyPlan.weekStart}</p> : null}
        </div>

        <form action={updateProgramWeeklyMissedWorkouts.bind(null, typedSelectedProgram.id)} className="space-y-2">
          <input type="hidden" name="selectedTemplateId" value={selectedTemplate?.id ?? typedTemplates[0]?.id ?? ""} />
          {typedTemplates.map((template) => {
            const completed = weeklyPlan?.completedTemplateIds.includes(template.id) ?? false;
            const missed = weeklyPlan?.missedTemplateIds.includes(template.id) ?? false;
            const preview = weeklyTemplateRows.find((row) => row.templateId === template.id);
            return (
              <label key={template.id} className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${completed ? "border-emerald-500/20 bg-emerald-500/5" : "border-slate-800 bg-slate-950"}`}>
                <div>
                  <p className="text-sm font-semibold text-slate-100">{template.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {completed ? "Completed this week" : missed ? "Marked missed" : "Planned"}
                    {preview ? ` · ${preview.baseSets} → ${preview.plannedSets} sets` : ""}
                  </p>
                  {preview?.changes.length ? (
                    <p className="mt-1 text-xs text-amber-300">
                      {preview.changes.slice(0, 3).map((item) => `${item.movementGroupName} ${item.weeklyAdjustmentDelta > 0 ? "+" : ""}${item.weeklyAdjustmentDelta}`).join(" · ")}
                    </p>
                  ) : null}
                </div>
                <span className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  {completed ? "Done" : "Miss"}
                  <input
                    type="checkbox"
                    name="missedTemplateId"
                    value={template.id}
                    defaultChecked={missed && !completed}
                    disabled={completed}
                    className="h-5 w-5"
                  />
                </span>
              </label>
            );
          })}

          {weeklyPlan && weeklyPlan.missedSets > 0 ? (
            <div className={`rounded-xl border p-3 text-sm ${weeklyPlan.unallocatedSets > 0 ? "border-amber-400/30 bg-amber-400/10 text-amber-100" : "border-slate-800 bg-slate-950 text-slate-300"}`}>
              Missed {weeklyPlan.missedSets} sets · reallocated {weeklyPlan.reallocatedSets}
              {weeklyPlan.unallocatedSets > 0 ? ` · ${weeklyPlan.unallocatedSets} could not be placed within matching movement-pattern capacity` : " · all sets placed"}
            </div>
          ) : null}

          <p className="text-xs text-slate-500">
            Redistribution is week-specific and does not alter the base template. If no explicit max is set, a remaining slot can receive at most one recovery set.
          </p>
          <Button className="w-full sm:w-auto">Save weekly availability</Button>
        </form>
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
              <h2 className="text-base font-semibold text-slate-100">Add movement-pattern slot</h2>
              <p className="mt-1 text-sm text-slate-400">Add a workout slot by movement pattern. The logger will offer exercises from that movement-pattern pool.</p>
            </div>
            <form action={addTemplateExercise.bind(null, selectedTemplate.id)} className="space-y-3">
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Movement pattern</span>
                <select name="movementGroupId" className={selectClass} required>
                  {typedMovementGroups.map((movementGroup: MovementGroupOption) => (
                    <option key={movementGroup.id} value={movementGroup.id}>{movementGroup.name}</option>
                  ))}
                </select>
                <span className="block text-xs text-slate-500">The template stores the movement pattern. Exercise is chosen during logging from this pool.</span>
              </label>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <Field label="Base sets" name="plannedSets" type="number" min={1} max={20} defaultValue={2} required />
                <Field label="Min sets" name="minSets" type="number" min={0} max={20} />
                <Field label="Max sets" name="maxSets" type="number" min={0} max={30} />
                <Field label="Min reps" name="minReps" type="number" min={1} max={100} />
                <Field label="Max reps" name="maxReps" type="number" min={1} max={100} />
                <OptionSelect name="slotPriority" defaultValue="STANDARD" options={slotPriorities} />
                <OptionSelect name="slotRole" defaultValue="ISOLATION" options={slotRoles} />
                <OptionSelect name="repBucket" defaultValue="ISOLATION" options={repBuckets} />
                <input type="hidden" name="rirTarget" value="" />
                <label className="block space-y-2 col-span-2 md:col-span-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Initial set type</span>
                  <select name="defaultSetTypeId" className={selectClass} defaultValue={normalSetType?.id} required>
                    {typedSetTypes.map((setType: SetTypeOption) => (
                      <option key={setType.id} value={setType.id}>
                        {setType.name} ×{Number(setType.multiplier)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200">
                <span>Allow mesocycle auto-adjustment</span>
                <input name="autoAdjustable" type="checkbox" className="h-5 w-5" />
              </label>
              <Field label="Notes" name="notes" placeholder="Optional" />
              <Button className="w-full">Add to template</Button>
            </form>
          </Card>

          <Card className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-100">Planned movement-pattern slots</h2>
              <p className="mt-1 text-sm text-slate-400">Slots are collapsed by default. Expand each slot to edit row-level planning and set-specific set types.</p>
            </div>
            {typedTemplateExercises.length === 0 ? (
              <p className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">No movement-pattern slots in this template yet.</p>
            ) : (
              <div className="space-y-3">
                {typedTemplateExercises.map((item: TemplateExerciseItem, index: number) => {
                  const setPlans = item.setPlans as TemplateExerciseSetPlan[];
                  const generated = generatedByTemplateExercise.get(item.id);
                  return (
                    <details key={item.id} className="group rounded-2xl border border-slate-800 bg-slate-950 p-3" open={index === 0}>
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-100">{index + 1}. {item.movementGroup?.name ?? item.exercise.movementGroup.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Base {item.plannedSets} sets
                            {generated ? ` · Meso ${generated.adjustedPlannedSets} sets` : ""}
                            {" · "}{generated?.prescribedMinReps ?? item.minReps ?? "?"}–{generated?.prescribedMaxReps ?? item.maxReps ?? "?"} reps
                          </p>
                          {generated?.adjustmentReason ? <p className="mt-1 text-xs text-amber-300">{generated.adjustmentReason}</p> : null}
                          <p className="mt-1 text-xs text-slate-500">
                            Set types: {setPlans.map((plan: TemplateExerciseSetPlan) => plan.setType.name).join(" / ") || item.defaultSetType.name}
                          </p>
                        </div>
                        <ChevronDown size={18} className="mt-1 shrink-0 text-slate-500 transition group-open:rotate-180" />
                      </summary>

                      <div className="mt-4 space-y-4 border-t border-slate-800 pt-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs text-slate-500">
                              Slot movement: {item.movementGroup?.name ?? item.exercise.movementGroup.name} · Primary basis: {item.exercise.primaryMuscles.map((link: TemplateExerciseItem["exercise"]["primaryMuscles"][number]) => link.muscle.name).join(", ") || "—"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Secondary: {item.exercise.secondaryMuscles.map((link: TemplateExerciseItem["exercise"]["secondaryMuscles"][number]) => link.muscle.name).join(", ") || "—"}
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
                              <Button variant="ghost" className="min-h-9 px-2" disabled={index === typedTemplateExercises.length - 1} aria-label="Move down"><ArrowDown size={16} /></Button>
                            </form>
                          </div>
                        </div>

                        <form action={updateTemplateExercise.bind(null, item.id)} className="space-y-3">
                          <label className="block space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Movement pattern</span>
                            <select name="movementGroupId" defaultValue={item.movementGroupId ?? item.exercise.movementGroupId} className={selectClass} required>
                              {typedMovementGroups.map((movementGroup: MovementGroupOption) => (
                                <option key={movementGroup.id} value={movementGroup.id}>{movementGroup.name}</option>
                              ))}
                            </select>
                            <span className="block text-xs text-slate-500">Changing this changes the slot pool. The actual exercise is still selected in the logger.</span>
                          </label>

                          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                            <Field label="Base sets" name="plannedSets" type="number" min={1} max={20} defaultValue={item.plannedSets} required />
                            <Field label="Min sets" name="minSets" type="number" min={0} max={20} defaultValue={item.minSets ?? ""} />
                            <Field label="Max sets" name="maxSets" type="number" min={0} max={30} defaultValue={item.maxSets ?? ""} />
                            <Field label="Min reps" name="minReps" type="number" min={1} max={100} defaultValue={item.minReps ?? ""} />
                            <Field label="Max reps" name="maxReps" type="number" min={1} max={100} defaultValue={item.maxReps ?? ""} />
                            <OptionSelect name="slotPriority" defaultValue={item.slotPriority} options={slotPriorities} />
                            <OptionSelect name="slotRole" defaultValue={item.slotRole} options={slotRoles} />
                            <OptionSelect name="repBucket" defaultValue={item.repBucket} options={repBuckets} />
                            <input type="hidden" name="rirTarget" value={item.rirTarget === null ? "" : Number(item.rirTarget)} />
                            <label className="block space-y-2 col-span-2 md:col-span-1">
                              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">New-set default</span>
                              <select name="defaultSetTypeId" defaultValue={item.defaultSetTypeId} className={selectClass} required>
                                {typedSetTypes.map((setType: SetTypeOption) => (
                                  <option key={setType.id} value={setType.id}>{setType.name} ×{Number(setType.multiplier)}</option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200">
                            <span>Allow mesocycle auto-adjustment</span>
                            <input name="autoAdjustable" type="checkbox" defaultChecked={item.autoAdjustable} className="h-5 w-5" />
                          </label>
                          <Field label="Notes" name="notes" defaultValue={item.notes ?? ""} />
                          <Button className="w-full">Save slot plan</Button>
                        </form>

                        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-100">Per-set plan</p>
                            <p className="mt-1 text-xs text-slate-500">Set type can differ per planned set. This drives planned effective volume and prefilled workout logging.</p>
                          </div>
                          {setPlans.length === 0 ? (
                            <p className="text-sm text-slate-500">Save this slot plan to initialize set rows.</p>
                          ) : (
                            <div className="space-y-2">
                              {setPlans.map((plan: TemplateExerciseSetPlan) => (
                                <form key={plan.id} action={updateTemplateExerciseSetPlan.bind(null, plan.id)} className="grid grid-cols-[4rem_1fr_auto] items-end gap-2">
                                  <p className="pb-3 text-sm font-semibold text-slate-300">Set {plan.setNumber}</p>
                                  <label className="block space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Set type</span>
                                    <SetTypeSelect setTypes={typedSetTypes} defaultValue={plan.setTypeId} />
                                  </label>
                                  <Button className="min-h-11 px-3">Save</Button>
                                </form>
                              ))}
                            </div>
                          )}
                        </div>

                        <form action={removeTemplateExercise}>
                          <input type="hidden" name="templateExerciseId" value={item.id} />
                          <Button variant="danger" className="w-full gap-2"><Trash2 size={16} /> Remove slot</Button>
                        </form>
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-slate-100">Program planned volume preview</h2>
              <p className="mt-1 text-sm text-slate-400">
                Aggregates all templates in this program and multiplies each template by its expected occurrences in the selected {windowDays}-day window. Per-set set types are used for effective-volume calculation.
              </p>
            </div>
            {targetNotices.length > 0 ? (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
                <p className="font-semibold text-amber-100">Target coverage notice</p>
                <p className="mt-1 text-xs text-amber-100/80">Program planned volume is not aligned with one or more selected-window targets. Adjust expected template occurrences or template contents if this is not intentional.</p>
                <div className="mt-2 space-y-1 text-xs text-amber-100/90">
                  {targetNotices.slice(0, 5).map((notice: TargetNotice) => (
                    <p key={notice.muscleId}>
                      {notice.muscleName}: effective {notice.effective.toFixed(1)} / target {notice.target.toFixed(1)} · {notice.status === "below" ? "below target" : notice.status === "above" ? "above target" : "excessive"}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
            <VolumePreviewBlock rows={programPreview} emptyText="Add exercises to any template to see program-level planned volume." />
          </Card>

          <Card className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-slate-100">Selected template contribution</h2>
              <p className="mt-1 text-sm text-slate-400">Shows only the currently open template without occurrence multiplication. Use this while editing the row-level plan.</p>
            </div>
            <VolumePreviewBlock rows={selectedTemplatePreview} emptyText="Add exercises to this template to see its contribution." />
          </Card>
        </>
      ) : null}
    </div>
  );
}
