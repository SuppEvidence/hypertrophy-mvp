import Link from "next/link";
import { CheckCircle2, History, Plus, Trash2 } from "lucide-react";
import { AutosaveSetRow } from "@/components/workouts/AutosaveSetRow";
import { DeleteWorkoutButton } from "@/components/workouts/DeleteWorkoutButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import {
  addSessionExercise,
  addWorkoutSet,
  finishWorkout,
  getWorkoutLoggerData,
  removeWorkoutSet,
  startWorkout,
  updateSessionExercise,
} from "@/lib/server/workouts";
import { buildWorkoutSummary, type LoggedExerciseForSummary } from "@/lib/workouts/summary";

const selectClass =
  "min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-slate-400";

const repRangeStatusOptions = [
  { value: "IN_RANGE", label: "In range" },
  { value: "TOO_LOW", label: "Too low" },
  { value: "TOO_HIGH", label: "Too high" },
  { value: "MIXED", label: "Mixed" },
  { value: "NOT_LOGGED", label: "Not logged" },
] as const;

const effortStatusOptions = [
  { value: "TOO_EASY", label: "Too easy" },
  { value: "PRODUCTIVE", label: "Productive" },
  { value: "VERY_HARD", label: "Very hard" },
  { value: "FAILURE", label: "Failure" },
  { value: "NOT_SURE", label: "Not sure" },
] as const;

type LoggerProgram = {
  id: string;
  name: string;
  programType: string;
  rotationStyle: string;
  secondaryContribution?: unknown;
};

type LoggerTemplate = {
  id: string;
  name: string;
};

type LoggerExerciseOption = {
  id: string;
  name: string;
  movementGroupId: string;
  movementGroup?: { id: string; name: string };
};

type LoggerSetTypeOption = {
  id: string;
  name: string;
  multiplier?: unknown;
  isIntensifier?: boolean;
};

type LoggerDraftSession = {
  id: string;
  name: string;
  program: { name: string };
  template: { name: string } | null;
};

type LoggerSet = {
  id: string;
  setNumber: number;
  weight: unknown;
  reps: number | null;
  rir: unknown;
  setTypeId: string;
  isCompleted: boolean;
  setType: {
    multiplier: unknown;
    isIntensifier: boolean;
  };
};

type LoggerSessionExercise = LoggedExerciseForSummary & {
  id: string;
  exerciseId: string;
  painNote: string | null;
  notes: string | null;
  substitutedFromExercise: { name: string } | null;
  templateExercise: { minReps: number | null; maxReps: number | null } | null;
  basePlannedSets: number | null;
  prescribedPlannedSets: number | null;
  prescribedMinReps: number | null;
  prescribedMaxReps: number | null;
  prescriptionNote: string | null;
  completedSets: number | null;
  stimulusSetTypeId: string | null;
  repRangeStatus: string;
  effortStatus: string;
  stimulusSetType: { id: string; name: string; multiplier: unknown; isIntensifier: boolean } | null;
  exercise: LoggedExerciseForSummary["exercise"] & {
    name: string;
    movementGroup: { id: string; name: string };
  };
  sets: LoggerSet[];
};

type LoggerActiveSession = {
  id: string;
  name: string;
  status: "DRAFT" | "COMPLETED" | string;
  program: LoggerProgram & { secondaryContribution: unknown };
  exercises: LoggerSessionExercise[];
};

type LoggerWeightSuggestion = {
  suggestedWeight: number | null;
  targetReps: number | null;
  sourceE1rm: number | null;
  sourceSet: string | null;
};

type SelectedTemplatePrescription = {
  mesocycleName: string | null;
  items: Array<{
    id: string;
    exerciseName: string;
    movementGroupName: string;
    basePlannedSets: number;
    adjustedPlannedSets: number;
    prescribedMinReps: number | null;
    prescribedMaxReps: number | null;
    adjustmentReason: string | null;
  }>;
};

type MuscleNameLink = { muscle: { name: string } };

type VolumeRow = {
  muscleId: string;
  muscleName: string;
  direct: number;
  effective: number;
};

function fmt(value: number) {
  return value.toFixed(1).replace(/\.0$/, "");
}

function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatRepRange(item: LoggerSessionExercise) {
  const minReps = item.prescribedMinReps ?? item.templateExercise?.minReps ?? null;
  const maxReps = item.prescribedMaxReps ?? item.templateExercise?.maxReps ?? null;
  if (!minReps || !maxReps) return "No target range";
  return `${minReps}–${maxReps} reps`;
}

function isProductiveEffort(status: string | null | undefined) {
  return status === "PRODUCTIVE" || status === "VERY_HARD" || status === "FAILURE";
}

function formatEffortStatus(status: string | null | undefined) {
  return effortStatusOptions.find((option) => option.value === status)?.label ?? "Not sure";
}

function formatRepRangeStatus(status: string | null | undefined) {
  return repRangeStatusOptions.find((option) => option.value === status)?.label ?? "Not logged";
}


function stimulusContributionPreview(item: LoggerSessionExercise, setTypes: LoggerSetTypeOption[], completedSets: number) {
  if (!isProductiveEffort(item.effortStatus)) return 0;
  const byId = new Map(setTypes.map((setType) => [setType.id, setType]));
  const fallbackType = item.stimulusSetTypeId ? byId.get(item.stimulusSetTypeId) : null;
  const sortedSets = [...item.sets].sort((a, b) => a.setNumber - b.setNumber).slice(0, Math.max(0, completedSets));
  let total = sortedSets.reduce((sum, set) => sum + (decimalToNumber(byId.get(set.setTypeId)?.multiplier) ?? 1), 0);
  const missing = Math.max(completedSets - sortedSets.length, 0);
  if (missing > 0) total += missing * (decimalToNumber(fallbackType?.multiplier) ?? 1);
  return total;
}

function setTypeSplitLabel(item: LoggerSessionExercise, setTypes: LoggerSetTypeOption[], completedSets: number) {
  const byId = new Map(setTypes.map((setType) => [setType.id, setType.name]));
  const selectedNames = [...item.sets]
    .sort((a, b) => a.setNumber - b.setNumber)
    .slice(0, Math.max(0, completedSets))
    .map((set) => byId.get(set.setTypeId) ?? "Unknown");
  const uniqueNames = Array.from(new Set(selectedNames));
  if (uniqueNames.length === 0) return "No set rows";
  if (uniqueNames.length === 1) return uniqueNames[0] ?? "—";
  return `Mixed: ${uniqueNames.join(" + ")}`;
}

function formatSuggestedWeight(suggestion: LoggerWeightSuggestion | undefined) {
  if (!suggestion) return "No suggestion yet";
  if (suggestion.suggestedWeight === null) {
    return suggestion.targetReps ? `No completed history for ${suggestion.targetReps} rep estimate yet` : "No target rep range available";
  }

  const source = suggestion.sourceSet ? ` · from ${suggestion.sourceSet}` : "";
  const target = suggestion.targetReps ? ` for ~${suggestion.targetReps} reps` : "";
  return `${fmt(suggestion.suggestedWeight)} kg${target}${source}`;
}

function toAutosaveSet(set: {
  id: string;
  setNumber: number;
  weight: unknown;
  reps: number | null;
  rir: unknown;
  setTypeId: string;
  isCompleted: boolean;
}) {
  return {
    id: set.id,
    setNumber: set.setNumber,
    weight: decimalToNumber(set.weight),
    reps: set.reps,
    rir: decimalToNumber(set.rir),
    setTypeId: set.setTypeId,
    isCompleted: set.isCompleted,
  };
}

function toAutosaveSetTypes(setTypes: LoggerSetTypeOption[]) {
  return setTypes.map((setType: LoggerSetTypeOption) => ({ id: setType.id, name: setType.name }));
}

export function WorkoutLogger({ data }: { data: Awaited<ReturnType<typeof getWorkoutLoggerData>> }) {
  const programs = data.programs as LoggerProgram[];
  const selectedProgram = data.selectedProgram as LoggerProgram | null;
  const templates = data.templates as LoggerTemplate[];
  const suggestedTemplate = data.suggestedTemplate as LoggerTemplate | null;
  const selectedTemplate = data.selectedTemplate as LoggerTemplate | null;
  const exercises = data.exercises as LoggerExerciseOption[];
  const setTypes = data.setTypes as LoggerSetTypeOption[];
  const draftSessions = data.draftSessions as LoggerDraftSession[];
  const activeSession = data.activeSession as LoggerActiveSession | null;
  const weightSuggestions = data.weightSuggestions as Record<string, LoggerWeightSuggestion>;
  const selectedTemplatePrescription = data.selectedTemplatePrescription as SelectedTemplatePrescription | null;
  const autosaveSetTypes = toAutosaveSetTypes(setTypes);

  if (programs.length === 0 || !selectedProgram) {
    return (
      <Card>
        <p className="text-sm text-slate-400">Create a program before logging workouts.</p>
        <Link href="/programs/new" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950">
          Create program
        </Link>
      </Card>
    );
  }

  const summary = activeSession
    ? buildWorkoutSummary({ secondaryContribution: Number(activeSession.program.secondaryContribution), sessionExercises: activeSession.exercises })
    : null;
  const isCompletedSession = activeSession?.status === "COMPLETED";
  const isDraftSession = activeSession?.status === "DRAFT";

  return (
    <div className="space-y-5">
      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested next workout</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">{suggestedTemplate?.name ?? selectedTemplate?.name ?? "No template"}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {selectedProgram.name} · {selectedProgram.programType.replaceAll("_", " ")} · {selectedProgram.rotationStyle.replaceAll("_", " ").toLowerCase()}
            </p>
          </div>
          {isCompletedSession ? <CheckCircle2 className="text-emerald-300" size={22} /> : null}
        </div>
        <Link href="/log/history" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200">
          <History size={16} /> Training log history
        </Link>
      </Card>

      <Card className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Program / template override</p>
          <p className="mt-1 text-sm text-slate-400">Start from the suggested template or manually select another template.</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {programs.map((program: LoggerProgram) => (
            <Link
              key={program.id}
              href={`/log?programId=${program.id}`}
              className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ${
                program.id === selectedProgram.id ? "border-slate-100 bg-slate-100 text-slate-950" : "border-slate-700 bg-slate-950 text-slate-300"
              }`}
            >
              {program.name}
            </Link>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {templates.map((template: LoggerTemplate) => (
            <Link
              key={template.id}
              href={`/log?programId=${selectedProgram.id}&templateId=${template.id}`}
              className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ${
                template.id === selectedTemplate?.id ? "border-slate-100 bg-slate-100 text-slate-950" : "border-slate-700 bg-slate-950 text-slate-300"
              }`}
            >
              {template.name}
            </Link>
          ))}
        </div>
        {data.hasUnfinishedSession && !activeSession ? (
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
            An unfinished workout exists. Resume it below, or explicitly start a new workout from the selected template.
          </div>
        ) : null}
        {isDraftSession ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">
            A draft workout is open. Finish it or use a draft link before starting another session.
          </div>
        ) : selectedTemplate ? (
          <div className="space-y-3">
            {selectedTemplatePrescription ? <PrescriptionPreview prescription={selectedTemplatePrescription} /> : null}
            <form action={startWorkout}>
              <input type="hidden" name="programId" value={selectedProgram.id} />
              <input type="hidden" name="templateId" value={selectedTemplate.id} />
              <Button className="w-full">{data.hasUnfinishedSession ? "Start new workout anyway" : "Start selected template"}</Button>
            </form>
          </div>
        ) : (
          <p className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">No template available yet. Build templates before logging.</p>
        )}
      </Card>

      {draftSessions.length > 0 ? (
        <Card className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resume active workout</p>
          <div className="space-y-2">
            {draftSessions.map((session: LoggerDraftSession) => (
              <Link key={session.id} href={`/log?sessionId=${session.id}`} className="block rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300 hover:border-slate-600">
                <span className="font-semibold text-slate-100">{session.name}</span>
                <span className="block text-xs text-slate-500">{session.program.name} · {session.template?.name ?? "Manual"}</span>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      {activeSession ? (
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isCompletedSession ? "Saved session" : "Active session"}</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-100">{activeSession.name}</h2>
              <p className="mt-1 text-sm text-slate-400">
                {activeSession.program.name} · {activeSession.status.toLowerCase()}
              </p>
            </div>
          </div>

          {isCompletedSession && summary ? <CompletedSummary summary={summary} /> : null}

          {isCompletedSession ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">
              This completed workout is editable. Set changes autosave and will update dashboard and performance calculations.
            </div>
          ) : null}

          <EditableSessionBody
            activeSession={activeSession}
            exercises={exercises}
            autosaveSetTypes={autosaveSetTypes}
            setTypes={setTypes}
            weightSuggestions={weightSuggestions}
            summary={summary}
          />

          {isDraftSession ? (
            <form action={finishWorkout.bind(null, activeSession.id)} className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900 p-3">
              <Field label="Session notes" name="notes" placeholder="Optional" />
              <Button className="w-full">Finish workout</Button>
            </form>
          ) : (
            <DeleteWorkoutButton sessionId={activeSession.id} />
          )}
        </Card>
      ) : null}
    </div>
  );
}

function PrescriptionPreview({ prescription }: { prescription: SelectedTemplatePrescription }) {
  const changed = prescription.items.filter((item) => item.adjustedPlannedSets !== item.basePlannedSets || item.adjustmentReason);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Planned prescription</p>
      <p className="mt-1 text-sm text-slate-300">
        {prescription.mesocycleName ? `Mesocycle overlay: ${prescription.mesocycleName}` : "No active mesocycle overlay"}
      </p>
      <div className="mt-3 space-y-2">
        {(changed.length > 0 ? changed : prescription.items.slice(0, 4)).map((item) => (
          <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-slate-800 p-2 text-sm">
            <span className="text-slate-200">{item.movementGroupName} · {item.exerciseName}</span>
            <span className={item.adjustedPlannedSets !== item.basePlannedSets ? "text-amber-300" : "text-slate-400"}>
              {item.basePlannedSets} → {item.adjustedPlannedSets} sets
              {item.prescribedMinReps && item.prescribedMaxReps ? ` · ${item.prescribedMinReps}-${item.prescribedMaxReps}` : ""}
            </span>
            {item.adjustmentReason ? <span className="col-span-2 text-xs text-slate-500">{item.adjustmentReason}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function EditableSessionBody({
  activeSession,
  exercises,
  autosaveSetTypes,
  setTypes,
  weightSuggestions,
  summary,
}: {
  activeSession: LoggerActiveSession;
  exercises: LoggerExerciseOption[];
  autosaveSetTypes: LoggerSetTypeOption[];
  setTypes: LoggerSetTypeOption[];
  weightSuggestions: Record<string, LoggerWeightSuggestion>;
  summary: ReturnType<typeof buildWorkoutSummary> | null;
}) {
  return (
    <>
      <div className="space-y-4">
        {activeSession.exercises.length === 0 ? (
          <p className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">No exercises in this session yet.</p>
        ) : null}

        {activeSession.exercises.map((item: LoggerSessionExercise, index: number) => (
          <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
            <div className="mb-3">
              <p className="text-sm font-semibold text-slate-100">{index + 1}. {item.exercise.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {item.exercise.movementGroup.name} · Primary: {item.exercise.primaryMuscles.map((link: MuscleNameLink) => link.muscle.name).join(", ") || "—"}
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Target rep range</p>
                  <p className="mt-1 text-sm font-semibold text-slate-200">{formatRepRange(item)}</p>
                  {item.prescribedPlannedSets !== null && item.basePlannedSets !== null ? (
                    <p className="mt-1 text-xs text-slate-500">Base {item.basePlannedSets} sets · Prescribed {item.prescribedPlannedSets} sets</p>
                  ) : null}
                  {item.prescriptionNote ? <p className="mt-1 text-xs text-amber-300">{item.prescriptionNote}</p> : null}
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Suggested weight</p>
                  <p className="mt-1 text-sm font-semibold text-slate-200">{formatSuggestedWeight(weightSuggestions[item.id])}</p>
                </div>
              </div>
              {item.isSubstitution ? (
                <p className="mt-1 text-xs text-amber-200">Substituted from {item.substitutedFromExercise?.name ?? "planned exercise"}</p>
              ) : null}
            </div>

            {(() => {
              const movementExerciseOptions = exercises.filter((exercise) => exercise.movementGroupId === item.exercise.movementGroup.id);
              const exerciseOptions = movementExerciseOptions.length > 0 ? movementExerciseOptions : exercises;
              const plannedSets = item.prescribedPlannedSets ?? item.basePlannedSets ?? item.sets.length;
              const completedSets = item.completedSets ?? plannedSets;
              const stimulusSetTypeId = item.stimulusSetTypeId ?? item.sets[0]?.setTypeId ?? autosaveSetTypes[0]?.id ?? "";
              const productiveEquivalent = stimulusContributionPreview(item, setTypes, completedSets);
              const setTypeSplit = setTypeSplitLabel(item, setTypes, completedSets);

              return (
                <form action={updateSessionExercise.bind(null, item.id)} className="mb-3 space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block space-y-2 md:col-span-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Selected exercise</span>
                      <select name="exerciseId" defaultValue={item.exerciseId} className={selectClass} required>
                        {exerciseOptions.map((exercise: LoggerExerciseOption) => (
                          <option key={exercise.id} value={exercise.id}>{exercise.name}</option>
                        ))}
                      </select>
                      <span className="block text-xs text-slate-500">Pool filtered by movement pattern when possible.</span>
                    </label>
                    <Field label="Completed sets" name="completedSets" type="number" min="0" max="100" step="1" defaultValue={completedSets} />
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Default set type</span>
                      <select name="stimulusSetTypeId" defaultValue={stimulusSetTypeId} className={selectClass} required>
                        {autosaveSetTypes.map((setType: LoggerSetTypeOption) => (
                          <option key={setType.id} value={setType.id}>{setType.name}</option>
                        ))}
                      </select>
                      <span className="block text-xs text-slate-500">Used for missing/new set rows. Individual sets can differ below.</span>
                    </label>
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rep range status</span>
                      <select name="repRangeStatus" defaultValue={item.repRangeStatus ?? "IN_RANGE"} className={selectClass}>
                        {repRangeStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Effort status</span>
                      <select name="effortStatus" defaultValue={item.effortStatus ?? "PRODUCTIVE"} className={selectClass}>
                        {effortStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                    <div className="grid gap-2 text-sm text-slate-300 md:grid-cols-4">
                      <span>Planned: <strong className="text-slate-100">{plannedSets}</strong></span>
                      <span>Set split: <strong className="text-slate-100">{setTypeSplit}</strong></span>
                      <span>Rep quality: <strong className="text-slate-100">{formatRepRangeStatus(item.repRangeStatus)}</strong></span>
                      <span>Productive equiv.: <strong className="text-slate-100">{fmt(productiveEquivalent)}</strong></span>
                    </div>
                    {item.sets.length > 0 ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {[...item.sets].sort((a, b) => a.setNumber - b.setNumber).map((set: LoggerSet) => (
                          <label key={set.id} className="block space-y-1 rounded-xl border border-slate-800 bg-slate-900/60 p-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Set {set.setNumber} type</span>
                            <select name={`setTypeId_${set.id}`} defaultValue={set.setTypeId} className={selectClass}>
                              {autosaveSetTypes.map((setType: LoggerSetTypeOption) => (
                                <option key={setType.id} value={setType.id}>{setType.name}</option>
                              ))}
                            </select>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">No individual set rows yet. The default set type will be used for volume-equivalent calculation.</p>
                    )}
                  </div>

                  <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
                    <span>
                      <span className="block text-sm font-semibold text-slate-200">Pain/discomfort flag</span>
                      <span className="block text-xs text-slate-500">Optional flag for this slot/exercise.</span>
                    </span>
                    <input name="painFlag" type="checkbox" defaultChecked={item.painFlag} className="h-5 w-5" />
                  </label>
                  <Field label="Pain note" name="painNote" defaultValue={item.painNote ?? ""} placeholder="Optional" />
                  <Field label="Slot note" name="notes" defaultValue={item.notes ?? ""} placeholder="Optional" />
                  <Button variant="secondary" className="w-full">Save stimulus row</Button>
                </form>
              );
            })()}

            <details className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-slate-300">Advanced set details: load / reps / RIR</summary>
              <div className="mt-3">
                <div className="mb-2 grid grid-cols-[0.6fr_1fr_1fr_1fr_1.4fr] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <span>Set</span>
                  <span>Weight</span>
                  <span>Reps</span>
                  <span>RIR</span>
                  <span>Set type</span>
                </div>

                <div className="space-y-2">
                  {item.sets.map((set: LoggerSet) => (
                    <AutosaveSetRow key={set.id} set={toAutosaveSet(set)} setTypes={autosaveSetTypes} />
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <form action={addWorkoutSet}>
                    <input type="hidden" name="sessionExerciseId" value={item.id} />
                    <Button variant="ghost" className="w-full gap-2"><Plus size={16} /> Add set</Button>
                  </form>
                  {item.sets.length > 0 ? (
                    <form action={removeWorkoutSet}>
                      <input type="hidden" name="setId" value={item.sets[item.sets.length - 1].id} />
                      <Button variant="danger" className="w-full gap-2"><Trash2 size={16} /> Last set</Button>
                    </form>
                  ) : null}
                </div>
              </div>
            </details>
          </div>
        ))}
      </div>

      <Card className="space-y-3 bg-slate-950">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add unplanned exercise</p>
        <form action={addSessionExercise} className="space-y-3">
          <input type="hidden" name="sessionId" value={activeSession.id} />
          <select name="exerciseId" defaultValue={exercises[0]?.id} className={selectClass} required>
            {exercises.map((exercise: LoggerExerciseOption) => (
              <option key={exercise.id} value={exercise.id}>{exercise.name}</option>
            ))}
          </select>
          <Button variant="secondary" className="w-full">Add exercise</Button>
        </form>
      </Card>

      {activeSession.status === "DRAFT" && summary ? <DraftSummary summary={summary} /> : null}
    </>
  );
}

function DraftSummary({ summary }: { summary: NonNullable<ReturnType<typeof buildWorkoutSummary>> }) {
  return (
    <Card className="space-y-3 bg-slate-950">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current session summary</p>
      <SummaryGrid summary={summary} />
      <VolumeRows rows={summary.volumeRows} />
    </Card>
  );
}

function CompletedSummary({ summary }: { summary: NonNullable<ReturnType<typeof buildWorkoutSummary>> }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-100">
        Workout completed. Summary is based on completed sets only.
      </div>
      <SummaryGrid summary={summary} />
      <VolumeRows rows={summary.volumeRows} />
    </div>
  );
}

function SummaryGrid({ summary }: { summary: NonNullable<ReturnType<typeof buildWorkoutSummary>> }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <Stat label="Completed sets" value={String(summary.completedSets)} />
      <Stat label="Productive sets" value={String(summary.productiveSets)} />
      <Stat label="Intensifiers" value={String(summary.intensifierCount)} />
      <Stat label="Pain flags" value={String(summary.painFlagCount)} />
      <Stat label="Substitutions" value={String(summary.substitutionCount)} />
      <div className="col-span-2 rounded-xl border border-slate-800 bg-slate-950 p-3 md:col-span-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Best e1RM in session</p>
        <p className="mt-1 text-sm font-semibold text-slate-100">
          {summary.bestSet ? `${summary.bestSet.exerciseName}: ${fmt(summary.bestSet.e1rm)} kg (${summary.bestSet.weight} × ${summary.bestSet.reps})` : "No completed weighted set yet"}
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function VolumeRows({ rows }: { rows: VolumeRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">No completed-set volume yet.</p>;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <span>Muscle</span>
        <span>Completed</span>
        <span>Productive equiv.</span>
      </div>
      {rows.map((row: VolumeRow) => (
        <div key={row.muscleId} className="grid grid-cols-[1fr_auto_auto] gap-2 rounded-xl border border-slate-800 bg-slate-950 p-2 text-sm">
          <span className="text-slate-200">{row.muscleName}</span>
          <span className="text-slate-400">{fmt(row.direct)}</span>
          <span className="text-slate-400">{fmt(row.effective)}</span>
        </div>
      ))}
    </div>
  );
}
