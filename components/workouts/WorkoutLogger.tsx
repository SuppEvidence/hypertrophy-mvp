import { ExerciseGuidance } from "@/components/workouts/ExerciseGuidance";
import { ExercisePainLogger } from "@/components/workouts/ExercisePainLogger";
import type { WorkoutExerciseGuidance } from "@/lib/workouts/exercise-guidance";
import { ExerciseChoiceScope } from "@/components/workouts/ExerciseChoiceScope";
import Link from "next/link";
import { CheckCircle2, History, Plus, Trash2 } from "lucide-react";
import { AutosaveSetRow } from "@/components/workouts/AutosaveSetRow";
import { LiveWorkoutCoach } from "@/components/workouts/LiveWorkoutCoach";
import { PreWorkoutCoach } from "@/components/workouts/PreWorkoutCoach";
import { DeleteWorkoutButton } from "@/components/workouts/DeleteWorkoutButton";
import { ExerciseCollapseCard } from "@/components/workouts/ExerciseCollapseCard";
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
import {
  buildWorkoutSummary,
  type LoggedExerciseForSummary,
} from "@/lib/workouts/summary";

const selectClass =
  "min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-orange-400/80";

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
  setupNotes: string | null;
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
  prescription?: unknown;
  id: string;
  setNumber: number;
  weight: unknown;
  reps: number | null;
  rir: unknown;
  setTypeId: string;
  isCompleted: boolean;
  repRangeStatus: string;
  effortStatus: string;
  painFlag: boolean;
  painNote: string | null;
  setType: {
    multiplier: unknown;
    isIntensifier: boolean;
  };
};

type LoggerSessionExercise = Omit<
  LoggedExerciseForSummary,
  "sets" | "exercise"
> & {
  id: string;
  exerciseId: string;
  exerciseChoiceIntent: string | null;
  painNote: string | null;
  notes: string | null;
  substitutedFromExercise: { name: string } | null;
  templateExercise: {
    minReps: number | null;
    maxReps: number | null;
    movementGroupId?: string | null;
    movementGroup?: { id: string; name: string } | null;
    exercise?: {
      movementGroupId: string;
      movementGroup?: { id: string; name: string };
    } | null;
  } | null;
  basePlannedSets: number | null;
  prescribedPlannedSets: number | null;
  prescribedMinReps: number | null;
  prescribedMaxReps: number | null;
  prescriptionNote: string | null;
  completedSets: number | null;
  stimulusSetTypeId: string | null;
  repRangeStatus: string;
  effortStatus: string;
  stimulusSetType: {
    id: string;
    name: string;
    multiplier: unknown;
    isIntensifier: boolean;
  } | null;
  exercise: LoggedExerciseForSummary["exercise"] & {
    name: string;
    setupNotes: string | null;
    minimumWeightIncrement: unknown;
    movementGroup: { id: string; name: string };
  };
  sets: LoggerSet[];
};

type LoggerActiveSession = {
  id: string;
  name: string;
  status: "DRAFT" | "COMPLETED" | string;
  prescriptionSummary?: unknown;
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
  weekStart: string;
  items: Array<{
    id: string;
    exerciseName: string;
    exerciseSelectionSource: "PREVIOUS_TEMPLATE" | "DEFAULT";
    movementGroupName: string;
    basePlannedSets: number;
    adjustedPlannedSets: number;
    weeklyAdjustedPlannedSets: number;
    weeklyEffectiveBase: number;
    weeklyEffectivePlanned: number;
    isMissedThisWeek: boolean;
    isWeeklyVirtualSlot: boolean;
    isMesocycleVirtualSlot: boolean;
    prescribedMinReps: number | null;
    prescribedMaxReps: number | null;
    adjustmentReason: string | null;
    weeklyAdjustmentReason: string | null;
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
  const minReps =
    item.prescribedMinReps ?? item.templateExercise?.minReps ?? null;
  const maxReps =
    item.prescribedMaxReps ?? item.templateExercise?.maxReps ?? null;
  if (!minReps || !maxReps) return "No target range";
  return `${minReps}–${maxReps} reps`;
}

function isProductiveEffort(status: string | null | undefined) {
  return (
    status === "PRODUCTIVE" || status === "VERY_HARD" || status === "FAILURE"
  );
}

function formatEffortStatus(status: string | null | undefined) {
  return (
    effortStatusOptions.find((option) => option.value === status)?.label ??
    "Not sure"
  );
}

function formatRepRangeStatus(status: string | null | undefined) {
  return (
    repRangeStatusOptions.find((option) => option.value === status)?.label ??
    "Not logged"
  );
}

function completedSetRows(item: LoggerSessionExercise) {
  return [...item.sets]
    .sort((a, b) => a.setNumber - b.setNumber)
    .filter((set) => set.isCompleted);
}

function stimulusContributionPreview(
  item: LoggerSessionExercise,
  setTypes: LoggerSetTypeOption[],
) {
  const byId = new Map(setTypes.map((setType) => [setType.id, setType]));
  const completedRows = completedSetRows(item);

  if (completedRows.length > 0 || item.sets.length > 0) {
    return completedRows.reduce((sum, set) => {
      if (!isProductiveEffort(set.effortStatus)) return sum;
      return sum + (decimalToNumber(byId.get(set.setTypeId)?.multiplier) ?? 1);
    }, 0);
  }

  if (!isProductiveEffort(item.effortStatus)) return 0;
  const completed = Math.max(0, Math.floor(Number(item.completedSets ?? 0)));
  const fallbackType = item.stimulusSetTypeId
    ? byId.get(item.stimulusSetTypeId)
    : null;
  return completed * (decimalToNumber(fallbackType?.multiplier) ?? 1);
}

function setTypeSplitLabel(
  item: LoggerSessionExercise,
  setTypes: LoggerSetTypeOption[],
) {
  const byId = new Map(setTypes.map((setType) => [setType.id, setType.name]));
  const selectedNames = completedSetRows(item).map(
    (set) => byId.get(set.setTypeId) ?? "Unknown",
  );
  const uniqueNames = Array.from(new Set(selectedNames));
  if (uniqueNames.length === 0) return "No completed sets";
  if (uniqueNames.length === 1) return uniqueNames[0] ?? "—";
  return `Mixed: ${uniqueNames.join(" + ")}`;
}

function statusCountLabel(
  sets: LoggerSet[],
  field: "repRangeStatus" | "effortStatus",
  formatter: (value: string | null | undefined) => string,
) {
  const completed = [...sets]
    .sort((a, b) => a.setNumber - b.setNumber)
    .filter((set) => set.isCompleted);
  if (completed.length === 0) return "No completed sets";
  const counts = new Map<string, number>();
  for (const set of completed) {
    const key = set[field] ?? "NOT_LOGGED";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([status, count]) => `${formatter(status)} ${count}`)
    .join(" · ");
}

function formatSuggestedWeight(suggestion: LoggerWeightSuggestion | undefined) {
  if (!suggestion) return "No suggestion yet";
  if (suggestion.suggestedWeight === null) {
    return suggestion.targetReps
      ? `No completed history for ${suggestion.targetReps} rep estimate yet`
      : "No target rep range available";
  }

  const source = suggestion.sourceSet ? ` · from ${suggestion.sourceSet}` : "";
  const target = suggestion.targetReps
    ? ` for ~${suggestion.targetReps} reps`
    : "";
  return `${fmt(suggestion.suggestedWeight)} kg${target}${source}`;
}

function toAutosaveSet(set: {
  prescription?: unknown;
  id: string;
  setNumber: number;
  weight: unknown;
  reps: number | null;
  rir: unknown;
  setTypeId: string;
  isCompleted: boolean;
  repRangeStatus: string;
  effortStatus: string;
  painFlag: boolean;
  painNote: string | null;
}) {
  return {
    prescription: set.prescription,
    id: set.id,
    setNumber: set.setNumber,
    weight: decimalToNumber(set.weight),
    reps: set.reps,
    rir: decimalToNumber(set.rir),
    setTypeId: set.setTypeId,
    isCompleted: set.isCompleted,
    repRangeStatus:
      !set.repRangeStatus || set.repRangeStatus === "NOT_LOGGED"
        ? "IN_RANGE"
        : set.repRangeStatus,
    effortStatus: set.effortStatus ?? "PRODUCTIVE",
    painFlag: Boolean(set.painFlag),
    painNote: set.painNote ?? null,
  };
}

function toAutosaveSetTypes(setTypes: LoggerSetTypeOption[]) {
  return setTypes.map((setType: LoggerSetTypeOption) => ({
    id: setType.id,
    name: setType.name,
  }));
}

function slotMovementGroup(item: LoggerSessionExercise) {
  return (
    item.templateExercise?.movementGroup ??
    item.templateExercise?.exercise?.movementGroup ??
    item.exercise.movementGroup
  );
}

export function WorkoutLogger({
  data,
}: {
  data: Awaited<ReturnType<typeof getWorkoutLoggerData>>;
}) {
  const programs = data.programs as LoggerProgram[];
  const selectedProgram = data.selectedProgram as LoggerProgram | null;
  const templates = data.templates as LoggerTemplate[];
  const suggestedTemplate = data.suggestedTemplate as LoggerTemplate | null;
  const selectedTemplate = data.selectedTemplate as LoggerTemplate | null;
  const exercises = data.exercises as LoggerExerciseOption[];
  const setTypes = data.setTypes as LoggerSetTypeOption[];
  const draftSessions = data.draftSessions as LoggerDraftSession[];
  const activeSession = data.activeSession as LoggerActiveSession | null;
  const exerciseGuidance = data.exerciseGuidance;
  const weightSuggestions = data.weightSuggestions as Record<
    string,
    LoggerWeightSuggestion
  >;
  const selectedTemplatePrescription =
    data.selectedTemplatePrescription as SelectedTemplatePrescription | null;
  const selectedOccurrence = data.selectedOccurrence as {
    id: string;
    date: string;
    durationMinutes: number;
  } | null;
  const weeklySchedule = data.weeklySchedule as Array<{
    id: string;
    date: string;
    templateId: string;
    missed: boolean;
    started: boolean;
  }>;
  const autosaveSetTypes = toAutosaveSetTypes(setTypes);

  if (programs.length === 0 || !selectedProgram) {
    return (
      <Card>
        <p className="text-sm text-slate-400">
          Create a program before logging workouts.
        </p>
        <Link
          href="/programs/new"
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950"
        >
          Create program
        </Link>
      </Card>
    );
  }

  const summary = activeSession
    ? buildWorkoutSummary({ sessionExercises: activeSession.exercises })
    : null;
  const isCompletedSession = activeSession?.status === "COMPLETED";
  const isDraftSession = activeSession?.status === "DRAFT";
  const storedSource =
    activeSession?.prescriptionSummary &&
    typeof activeSession.prescriptionSummary === "object"
      ? (activeSession.prescriptionSummary as Record<string, unknown>)
      : null;
  const sourceLabel = storedSource
    ? `${storedSource.weeklyOccurrenceId ? "Approved weekly plan" : "Program prescription"}${storedSource.preWorkoutCoach ? " → Daily coach review accepted" : ""}`
    : selectedOccurrence
      ? "Approved weekly plan"
      : "Program prescription";

  return (
    <div className="space-y-5">
      {!activeSession ? (
        <>
          <Card className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Suggested next workout
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-100">
                  {selectedTemplate?.name ??
                    suggestedTemplate?.name ??
                    "No template"}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {selectedProgram.name} ·{" "}
                  {selectedProgram.programType.replaceAll("_", " ")} ·{" "}
                  {selectedProgram.rotationStyle
                    .replaceAll("_", " ")
                    .toLowerCase()}
                </p>
              </div>
              {isCompletedSession ? (
                <CheckCircle2 className="text-emerald-300" size={22} />
              ) : null}
            </div>
            <p className="text-xs text-sky-200">
              {activeSession ? "Workout source" : "Starting plan"}:{" "}
              {sourceLabel}
            </p>
            <Link
              href="/log/history"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200"
            >
              <History size={16} /> Training log history
            </Link>
          </Card>

          <Card className="space-y-3">
            <details className="rounded-xl border border-slate-800 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-slate-300">
                Choose a different workout
              </summary>
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Workout selection
                  </p>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {programs.map((program: LoggerProgram) => (
                    <Link
                      key={program.id}
                      href={`/log?programId=${program.id}`}
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
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {templates.map((template: LoggerTemplate) => (
                    <Link
                      key={template.id}
                      href={`/log?programId=${selectedProgram.id}&templateId=${template.id}`}
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
                {weeklySchedule.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {weeklySchedule.map((day) => {
                      const label = `${day.date} · ${templates.find((row) => row.id === day.templateId)?.name ?? "Workout"}`;
                      return day.missed || day.started ? (
                        <span
                          key={day.id}
                          className="shrink-0 rounded-full border border-slate-800 px-3 py-2 text-xs text-slate-500"
                        >
                          {label} · {day.missed ? "missed" : "started"}
                        </span>
                      ) : (
                        <Link
                          key={day.id}
                          href={`/log?programId=${selectedProgram.id}&templateId=${day.templateId}&occurrenceId=${day.id}`}
                          className={`shrink-0 rounded-full border px-3 py-2 text-xs ${day.id === selectedOccurrence?.id ? "border-orange-500 text-orange-200" : "border-slate-700 text-slate-400"}`}
                        >
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </details>
            {data.hasUnfinishedSession && !activeSession ? (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
                An unfinished workout exists. Resume it below, or explicitly
                start a new workout from the selected template.
              </div>
            ) : null}
            {isDraftSession ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">
                A draft workout is open. Finish it or use a draft link before
                starting another session.
              </div>
            ) : data.weeklyWorkoutUnavailable ? (
              <div
                role="alert"
                className="space-y-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100"
              >
                <p className="font-semibold">Weekly workout needs review</p>
                <p>
                  The saved weekly workout cannot be applied to the current
                  mesocycle, exercise library or set formats, or has already
                  been started or removed. Review the weekly plan, select
                  another available workout, or explicitly use the current
                  program prescription.
                </p>
                <div className="flex flex-wrap gap-3 font-semibold">
                  <Link href="/plan/week" className="underline">
                    Review weekly plan
                  </Link>
                  {selectedTemplate ? (
                    <Link
                      href={`/log?programId=${selectedProgram.id}&templateId=${selectedTemplate.id}&planSource=program`}
                      className="underline"
                    >
                      Use current program instead
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : selectedTemplate ? (
              <div className="space-y-3">
                {data.useProgramPrescription ? (
                  <p className="text-sm text-amber-200">
                    Using the current program prescription by your choice,
                    instead of the saved weekly workout.
                  </p>
                ) : null}
                {selectedTemplatePrescription ? (
                  <details className="rounded-xl border border-slate-800 p-3">
                    <summary className="cursor-pointer text-sm font-medium text-slate-400">
                      Workout overview
                    </summary>
                    <div className="mt-3">
                      <PrescriptionPreview
                        prescription={selectedTemplatePrescription}
                      />
                    </div>
                  </details>
                ) : null}
                <PreWorkoutCoach
                  programId={selectedProgram.id}
                  templateId={selectedTemplate.id}
                  occurrenceId={selectedOccurrence?.id}
                  plannedMinutes={selectedOccurrence?.durationMinutes}
                />
                <form action={startWorkout}>
                  <input
                    type="hidden"
                    name="programId"
                    value={selectedProgram.id}
                  />
                  <input
                    type="hidden"
                    name="templateId"
                    value={selectedTemplate.id}
                  />
                  {selectedOccurrence ? (
                    <input
                      type="hidden"
                      name="occurrenceId"
                      value={selectedOccurrence.id}
                    />
                  ) : null}
                  <Button variant="secondary" className="w-full">
                    {data.hasUnfinishedSession
                      ? "Start current plan anyway"
                      : "Start current plan"}
                  </Button>
                </form>
              </div>
            ) : (
              <p className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">
                No template available yet. Build templates before logging.
              </p>
            )}
          </Card>

          {draftSessions.length > 0 ? (
            <Card className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Resume active workout
              </p>
              <div className="space-y-2">
                {draftSessions.map((session: LoggerDraftSession) => (
                  <Link
                    key={session.id}
                    href={`/log?sessionId=${session.id}`}
                    className="block rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300 hover:border-slate-600"
                  >
                    <span className="font-semibold text-slate-100">
                      {session.name}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {session.program.name} ·{" "}
                      {session.template?.name ?? "Manual"}
                    </span>
                  </Link>
                ))}
              </div>
            </Card>
          ) : null}
        </>
      ) : null}

      {activeSession ? (
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {isCompletedSession ? "Saved session" : "Active session"}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-100">
                {activeSession.name}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {activeSession.program.name} · {sourceLabel}
              </p>
            </div>
          </div>

          {isCompletedSession && summary ? (
            <CompletedSummary summary={summary} />
          ) : null}

          {isCompletedSession ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">
              This completed workout is editable. Set changes autosave and will
              update dashboard and performance calculations.
            </div>
          ) : null}

          <EditableSessionBody
            activeSession={activeSession}
            exercises={exercises}
            autosaveSetTypes={autosaveSetTypes}
            setTypes={setTypes}
            weightSuggestions={weightSuggestions}
            exerciseGuidance={exerciseGuidance}
            summary={summary}
          />

          {isDraftSession ? (
            <form
              action={finishWorkout.bind(null, activeSession.id)}
              className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900 p-3"
            >
              <Field
                label="Session notes"
                name="notes"
                placeholder="Optional"
              />
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

function PrescriptionPreview({
  prescription,
}: {
  prescription: SelectedTemplatePrescription;
}) {
  const finalSets = (item: SelectedTemplatePrescription["items"][number]) =>
    item.isMissedThisWeek
      ? item.adjustedPlannedSets
      : item.weeklyAdjustedPlannedSets;
  const changed = prescription.items.filter(
    (item) =>
      finalSets(item) !== item.basePlannedSets ||
      item.adjustmentReason ||
      item.weeklyAdjustmentReason ||
      item.isMissedThisWeek,
  );

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Planned prescription
      </p>
      <p className="mt-1 text-sm text-slate-300">
        {prescription.mesocycleName
          ? `Mesocycle overlay: ${prescription.mesocycleName}`
          : "No active mesocycle overlay"}{" "}
        · week starting {prescription.weekStart}
      </p>
      <div className="mt-3 space-y-2">
        {(changed.length > 0 ? changed : prescription.items.slice(0, 4)).map(
          (item) => {
            const planned = finalSets(item);
            return (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-slate-800 p-2 text-sm"
              >
                <span className="text-slate-200">
                  {item.isMesocycleVirtualSlot
                    ? "Meso added · "
                    : item.isWeeklyVirtualSlot
                      ? "Weekly added · "
                      : ""}
                  {item.movementGroupName}
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {item.exerciseName}
                    {item.exerciseSelectionSource === "PREVIOUS_TEMPLATE"
                      ? " · last used in this slot"
                      : ""}
                  </span>
                </span>
                <span
                  className={
                    planned !== item.basePlannedSets ||
                    item.weeklyEffectivePlanned !== item.weeklyEffectiveBase
                      ? "text-amber-300"
                      : "text-slate-400"
                  }
                >
                  {item.basePlannedSets} → {planned} physical
                  <span className="block text-right text-xs">
                    {item.weeklyEffectiveBase.toFixed(1)} →{" "}
                    {item.weeklyEffectivePlanned.toFixed(1)} effective
                  </span>
                  {item.prescribedMinReps && item.prescribedMaxReps ? (
                    <span className="block text-right text-xs">
                      {item.prescribedMinReps}-{item.prescribedMaxReps} reps
                    </span>
                  ) : null}
                </span>
                {item.adjustmentReason ? (
                  <span className="col-span-2 text-xs text-slate-500">
                    {item.adjustmentReason}
                  </span>
                ) : null}
                {item.weeklyAdjustmentReason ? (
                  <span className="col-span-2 text-xs text-amber-300">
                    {item.weeklyAdjustmentReason}
                  </span>
                ) : null}
                {item.isMissedThisWeek ? (
                  <span className="col-span-2 text-xs text-amber-300">
                    This template is marked missed. Starting it manually uses
                    its normal mesocycle prescription.
                  </span>
                ) : null}
              </div>
            );
          },
        )}
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
  exerciseGuidance,
  summary,
}: {
  activeSession: LoggerActiveSession;
  exercises: LoggerExerciseOption[];
  autosaveSetTypes: LoggerSetTypeOption[];
  setTypes: LoggerSetTypeOption[];
  weightSuggestions: Record<string, LoggerWeightSuggestion>;
  exerciseGuidance: Record<string, WorkoutExerciseGuidance>;
  summary: ReturnType<typeof buildWorkoutSummary> | null;
}) {
  return (
    <>
      <div className="space-y-4">
        {activeSession.exercises.length === 0 ? (
          <p className="text-sm text-slate-400">
            No exercises in this session yet.
          </p>
        ) : null}
        {activeSession.exercises.map((item, index) => {
          const movementGroup = slotMovementGroup(item);
          const compatible = exercises.filter(
            (exercise) => exercise.movementGroupId === movementGroup.id,
          );
          const exerciseOptions = compatible.length ? compatible : exercises;
          const plannedSets =
            item.prescribedPlannedSets ??
            item.basePlannedSets ??
            item.sets.length;
          return (
            <ExerciseCollapseCard
              key={item.id}
              exerciseId={item.id}
              title={`${index + 1}. ${item.exercise.name}`}
              exerciseName={movementGroup.name}
              plannedSets={plannedSets}
              initialSets={item.sets.map((set) => ({
                id: set.id,
                isCompleted: set.isCompleted,
              }))}
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                  <span className="rounded-full border border-slate-700 px-2.5 py-1 text-slate-200">
                    {formatRepRange(item)}
                  </span>
                  {weightSuggestions[item.id]?.suggestedWeight != null ? (
                    <span>
                      Suggested load{" "}
                      <strong className="font-medium text-slate-200">
                        {fmt(weightSuggestions[item.id].suggestedWeight!)} kg
                      </strong>
                    </span>
                  ) : null}
                  {item.isSubstitution ? (
                    <span className="text-amber-200">
                      Changed from{" "}
                      {item.substitutedFromExercise?.name ?? "planned exercise"}
                    </span>
                  ) : null}
                </div>
                <ExerciseGuidance
                  guidance={exerciseGuidance?.[item.exerciseId]}
                  setupNotes={item.exercise.setupNotes}
                  primaryMuscles={item.exercise.primaryMuscles.map(
                    (link: MuscleNameLink) => link.muscle.name,
                  )}
                />
                {activeSession.status === "DRAFT" ? (
                  <LiveWorkoutCoach
                    sessionId={activeSession.id}
                    sessionExerciseId={item.id}
                    sets={item.sets.map((set) => ({
                      id: set.id,
                      setNumber: set.setNumber,
                      isCompleted: set.isCompleted,
                    }))}
                  />
                ) : null}
                <div className="space-y-2">
                  {[...item.sets]
                    .sort((a, b) => a.setNumber - b.setNumber)
                    .map((set) => (
                      <div
                        key={set.id}
                        className="grid gap-1 lg:grid-cols-[minmax(0,1fr)_auto]"
                      >
                        <AutosaveSetRow
                          set={toAutosaveSet(set)}
                          setTypes={autosaveSetTypes}
                          repRangeStatusOptions={repRangeStatusOptions}
                          effortStatusOptions={effortStatusOptions}
                          prefillWeight={
                            weightSuggestions[item.id]?.suggestedWeight ?? null
                          }
                          prefillReps={
                            weightSuggestions[item.id]?.targetReps ?? null
                          }
                          prefillRir={decimalToNumber(item.sets[0]?.rir)}
                        />
                        <form
                          action={removeWorkoutSet}
                          className="flex justify-end lg:items-start"
                        >
                          <input type="hidden" name="setId" value={set.id} />
                          <Button
                            variant="ghost"
                            className="gap-1.5 px-3 text-xs text-slate-500"
                            aria-label={`Remove set ${set.setNumber} from ${item.exercise.name}`}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            Remove set
                          </Button>
                        </form>
                      </div>
                    ))}
                  {!item.sets.length ? (
                    <p className="text-xs text-slate-500">
                      Add a set to start logging this exercise.
                    </p>
                  ) : null}
                  <form action={addWorkoutSet}>
                    <input
                      type="hidden"
                      name="sessionExerciseId"
                      value={item.id}
                    />
                    <Button variant="ghost" className="w-full gap-2">
                      <Plus size={16} aria-hidden="true" />
                      Add set
                    </Button>
                  </form>
                </div>
                <ExercisePainLogger sessionExerciseId={item.id} />
                <details className="rounded-xl border border-slate-800 p-3">
                  <summary className="cursor-pointer text-xs font-medium text-slate-400">
                    Change exercise or add a note
                  </summary>
                  <form
                    action={updateSessionExercise.bind(null, item.id)}
                    className="mt-3 space-y-3"
                  >
                    <label className="block space-y-2">
                      <span className="text-xs text-slate-400">Exercise</span>
                      <select
                        name="exerciseId"
                        defaultValue={item.exerciseId}
                        className={selectClass}
                        required
                      >
                        {!exerciseOptions.some(
                          (exercise) => exercise.id === item.exerciseId,
                        ) ? (
                          <option value={item.exerciseId}>
                            {item.exercise.name} · current
                          </option>
                        ) : null}
                        {exerciseOptions.map((exercise) => (
                          <option key={exercise.id} value={exercise.id}>
                            {exercise.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <ExerciseChoiceScope
                      temporary={item.exerciseChoiceIntent === "TEMPORARY"}
                    />
                    <Field
                      label="Exercise note"
                      name="notes"
                      defaultValue={item.notes ?? ""}
                      placeholder="Setup change, execution or anything relevant today"
                    />
                    <Button variant="secondary" className="w-full">
                      Save exercise / note
                    </Button>
                  </form>
                </details>
                <details className="rounded-xl border border-slate-800 p-3">
                  <summary className="cursor-pointer text-xs font-medium text-slate-500">
                    Targets, load reference & exercise totals
                  </summary>
                  <div className="mt-3 space-y-2 text-xs leading-5 text-slate-400">
                    <p>
                      {formatRepRange(item)} · {plannedSets} planned sets ·{" "}
                      {completedSetRows(item).length} completed
                    </p>
                    {item.prescriptionNote ? (
                      <p className="text-amber-200">{item.prescriptionNote}</p>
                    ) : null}
                    <p>
                      Load reference:{" "}
                      {formatSuggestedWeight(weightSuggestions[item.id])}
                    </p>
                    {item.exercise.minimumWeightIncrement != null ? (
                      <p>
                        Minimum load increment:{" "}
                        {decimalToNumber(item.exercise.minimumWeightIncrement)}{" "}
                        kg
                      </p>
                    ) : null}
                    <p>
                      Set split: {setTypeSplitLabel(item, setTypes)} ·
                      Productive equivalent:{" "}
                      {fmt(stimulusContributionPreview(item, setTypes))}
                    </p>
                    <p>
                      Rep quality:{" "}
                      {statusCountLabel(
                        item.sets,
                        "repRangeStatus",
                        formatRepRangeStatus,
                      )}
                    </p>
                    <p>
                      Effort:{" "}
                      {statusCountLabel(
                        item.sets,
                        "effortStatus",
                        formatEffortStatus,
                      )}
                    </p>
                    <p>
                      Pain-flagged sets:{" "}
                      {
                        item.sets.filter(
                          (set) => set.isCompleted && set.painFlag,
                        ).length
                      }
                    </p>
                  </div>
                </details>
              </div>
            </ExerciseCollapseCard>
          );
        })}
      </div>
      <details className="rounded-xl border border-slate-800 p-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-400">
          Add an exercise
        </summary>
        <form action={addSessionExercise} className="mt-3 space-y-3">
          <input type="hidden" name="sessionId" value={activeSession.id} />
          <label className="block space-y-2">
            <span className="text-xs text-slate-400">Exercise to add</span>
            <select
              name="exerciseId"
              defaultValue={exercises[0]?.id}
              className={selectClass}
              required
            >
              {exercises.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
            </select>
          </label>
          <Button variant="secondary" className="w-full">
            Add exercise
          </Button>
        </form>
      </details>
      {activeSession.status === "DRAFT" && summary ? (
        <details className="rounded-xl border border-slate-800 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-400">
            Session summary
          </summary>
          <div className="mt-3">
            <DraftSummary summary={summary} />
          </div>
        </details>
      ) : null}
    </>
  );
}

function DraftSummary({
  summary,
}: {
  summary: NonNullable<ReturnType<typeof buildWorkoutSummary>>;
}) {
  return (
    <Card className="space-y-3 bg-slate-950">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Current session summary
      </p>
      <SummaryGrid summary={summary} />
      <VolumeRows rows={summary.volumeRows} />
    </Card>
  );
}

function CompletedSummary({
  summary,
}: {
  summary: NonNullable<ReturnType<typeof buildWorkoutSummary>>;
}) {
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

function SummaryGrid({
  summary,
}: {
  summary: NonNullable<ReturnType<typeof buildWorkoutSummary>>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <Stat label="Completed sets" value={String(summary.completedSets)} />
      <Stat label="Productive sets" value={String(summary.productiveSets)} />
      <Stat label="Intensifiers" value={String(summary.intensifierCount)} />
      <Stat label="Pain flags" value={String(summary.painFlagCount)} />
      <Stat label="Substitutions" value={String(summary.substitutionCount)} />
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
  if (rows.length === 0)
    return (
      <p className="text-sm text-slate-500">No completed-set volume yet.</p>
    );
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <span>Muscle</span>
        <span>Completed</span>
        <span>Productive equiv.</span>
      </div>
      {rows.map((row: VolumeRow) => (
        <div
          key={row.muscleId}
          className="grid grid-cols-[1fr_auto_auto] gap-2 rounded-xl border border-slate-800 bg-slate-950 p-2 text-sm"
        >
          <span className="text-slate-200">{row.muscleName}</span>
          <span className="text-slate-400">{fmt(row.direct)}</span>
          <span className="text-slate-400">{fmt(row.effective)}</span>
        </div>
      ))}
    </div>
  );
}
