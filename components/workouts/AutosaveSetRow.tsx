"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { WORKOUT_SET_COMPLETION_EVENT } from "@/components/workouts/ExerciseCollapseCard";
import {
  endWorkoutSetTimer,
  getWorkoutSetTracking,
  saveWorkoutSetFilmed,
  saveWorkoutSetIntensifierDetails,
  startWorkoutSetTimer,
} from "@/lib/server/set-tracking-server";
import { autosaveWorkoutSetCore } from "@/lib/server/workout-set-autosave";

const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-orange-400/80";
const smallSelectClass =
  "min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100 outline-none focus:border-orange-400/80";

type SetTypeOption = {
  id: string;
  name: string;
};

type StatusOption = {
  value: string;
  label: string;
};

type DropSetDraft = {
  weight: string;
  reps: string;
};

type AutosaveSetRowProps = {
  set: {
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
  };
  setTypes: SetTypeOption[];
  repRangeStatusOptions: readonly StatusOption[];
  effortStatusOptions: readonly StatusOption[];
  mode?: "stimulus" | "advanced";
  prefillWeight?: number | null;
  prefillReps?: number | null;
  prefillRir?: number | null;
};

function decimalToInput(value: unknown) {
  if (value === null || value === undefined) return "";
  const num = Number(value);
  return Number.isFinite(num) ? String(num) : "";
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function intensifierKind(name: string | undefined) {
  const normalized = (name ?? "").trim().toLowerCase();

  if (
    normalized.includes("myo") ||
    normalized.includes("rest-pause") ||
    normalized.includes("rest pause") ||
    normalized.includes("edt") ||
    normalized.includes("cluster")
  ) {
    return "clusters" as const;
  }

  if (normalized.includes("drop")) {
    return "drops" as const;
  }

  return "none" as const;
}

export function AutosaveSetRow({
  set,
  setTypes,
  prefillWeight,
  prefillReps,
  prefillRir,
}: AutosaveSetRowProps) {
  const [weight, setWeight] = useState(
    decimalToInput(set.weight) || decimalToInput(prefillWeight),
  );
  const [reps, setReps] = useState(
    set.reps === null || set.reps === undefined
      ? prefillReps === null || prefillReps === undefined
        ? ""
        : String(prefillReps)
      : String(set.reps),
  );
  const [rir, setRir] = useState(
    decimalToInput(set.rir) || decimalToInput(prefillRir),
  );
  const [setTypeId, setSetTypeId] = useState(set.setTypeId);
  const [isCompleted, setIsCompleted] = useState(set.isCompleted);
  const [painFlag, setPainFlag] = useState(Boolean(set.painFlag));
  const [painNote, setPainNote] = useState(set.painNote ?? "");
  const [status, setStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [endedAt, setEndedAt] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerBusy, setTimerBusy] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  const [clusterCount, setClusterCount] = useState("");
  const [dropSets, setDropSets] = useState<DropSetDraft[]>([]);
  const [filmed, setFilmed] = useState(false);
  const [detailsStatus, setDetailsStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const [isPending, startTransition] = useTransition();
  const didMount = useRef(false);
  const saveVersion = useRef(0);
  const lastSavedCompletion = useRef(set.isCompleted);

  const selectedSetType = setTypes.find((option) => option.id === setTypeId);
  const currentIntensifierKind = intensifierKind(selectedSetType?.name);

  const payload = useMemo(
    () => ({
      weight,
      reps,
      rir,
      setTypeId,
      isCompleted,
      painFlag,
      painNote,
    }),
    [
      weight,
      reps,
      rir,
      setTypeId,
      isCompleted,
      painFlag,
      painNote,
    ],
  );

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }

    setStatus("saving");
    const currentVersion = saveVersion.current + 1;
    saveVersion.current = currentVersion;

    const timeout = window.setTimeout(() => {
      startTransition(async () => {
        const result = await autosaveWorkoutSetCore(set.id, payload);
        if (saveVersion.current !== currentVersion) return;

        setStatus(result.ok ? "saved" : "error");

        if (
          result.ok &&
          lastSavedCompletion.current !== payload.isCompleted
        ) {
          lastSavedCompletion.current = payload.isCompleted;
          window.dispatchEvent(
            new CustomEvent(WORKOUT_SET_COMPLETION_EVENT, {
              detail: {
                setId: set.id,
                isCompleted: payload.isCompleted,
              },
            }),
          );
        }
      });
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [payload, set.id]);

  useEffect(() => {
    if (!startedAt || endedAt) return;

    const update = () => {
      setElapsedSeconds(
        Math.max(
          0,
          Math.round(
            (Date.now() - new Date(startedAt).getTime()) / 1000,
          ),
        ),
      );
    };

    update();
    const interval = window.setInterval(update, 1000);

    return () => window.clearInterval(interval);
  }, [startedAt, endedAt]);

  const statusText =
    isPending || status === "saving"
      ? "Saving"
      : status === "saved"
        ? "Saved"
        : status === "error"
          ? "Save failed"
          : "Autosave";

  const statusClass =
    status === "error"
      ? "border-red-400/40 text-red-200"
      : status === "saved"
        ? "border-emerald-500/30 text-emerald-200"
        : "border-slate-800 text-slate-500";

  const timerRunning = Boolean(startedAt && !endedAt);

  async function loadTrackingDetails() {
    if (detailsLoaded) return;

    const result = await getWorkoutSetTracking(set.id);
    if (!result.ok) {
      setTrackingError("Set tracking unavailable");
      return;
    }

    setStartedAt(result.startedAt);
    setEndedAt(result.endedAt);
    setClusterCount(
      result.intensifierDetails.clusterCount === null
        ? ""
        : String(result.intensifierDetails.clusterCount),
    );
    setDropSets(
      result.intensifierDetails.dropSets.map((drop) => ({
        weight: drop.weight === null ? "" : String(drop.weight),
        reps: drop.reps === null ? "" : String(drop.reps),
      })),
    );
    setFilmed(result.intensifierDetails.filmed);

    if (result.startedAt && result.endedAt) {
      setElapsedSeconds(
        Math.max(
          0,
          Math.round(
            (new Date(result.endedAt).getTime() -
              new Date(result.startedAt).getTime()) /
              1000,
          ),
        ),
      );
    } else if (result.startedAt) {
      setElapsedSeconds(
        Math.max(
          0,
          Math.round(
            (Date.now() - new Date(result.startedAt).getTime()) / 1000,
          ),
        ),
      );
    }

    setDetailsLoaded(true);
  }

  async function handleTimer() {
    setTimerBusy(true);
    setTrackingError(null);

    try {
      if (!timerRunning) {
        const result = await startWorkoutSetTimer(set.id);

        if (!result.ok) {
          setTrackingError(result.error);
          return;
        }

        setStartedAt(result.startedAt);
        setEndedAt(null);
        setElapsedSeconds(
          result.resumed
            ? Math.max(0, Math.round((Date.now() - new Date(result.startedAt).getTime()) / 1000))
            : 0,
        );
        return;
      }

      const result = await endWorkoutSetTimer(set.id);

      if (!result.ok) {
        setTrackingError(result.error);
        return;
      }

      setStartedAt(result.startedAt);
      setEndedAt(result.endedAt);
      setElapsedSeconds(result.durationSeconds ?? 0);
    } finally {
      setTimerBusy(false);
    }
  }

  async function persistIntensifierDetails(
    nextClusterCount = clusterCount,
    nextDropSets = dropSets,
    nextFilmed = filmed,
  ) {
    setDetailsStatus("saving");

    const result = await saveWorkoutSetIntensifierDetails(set.id, {
      clusterCount:
        nextClusterCount.trim() === "" ? null : nextClusterCount,
      dropSets: nextDropSets.map((drop) => ({
        weight: drop.weight.trim() === "" ? null : drop.weight,
        reps: drop.reps.trim() === "" ? null : drop.reps,
      })),
      filmed: nextFilmed,
    });

    setDetailsStatus(result.ok ? "saved" : "error");
  }

  async function handleSetTypeChange(nextSetTypeId: string) {
    setSetTypeId(nextSetTypeId);

    const nextType = setTypes.find(
      (option) => option.id === nextSetTypeId,
    );
    const nextKind = intensifierKind(nextType?.name);

    if (nextKind === "none") {
      setClusterCount("");
      setDropSets([]);
      await persistIntensifierDetails("", [], filmed);
    } else if (nextKind === "clusters") {
      setDropSets([]);
      await persistIntensifierDetails(clusterCount, [], filmed);
    } else {
      setClusterCount("");
      await persistIntensifierDetails("", dropSets, filmed);
    }
  }

  function updateDropSet(
    index: number,
    field: keyof DropSetDraft,
    value: string,
  ) {
    setDropSets((current) =>
      current.map((drop, dropIndex) =>
        dropIndex === index ? { ...drop, [field]: value } : drop,
      ),
    );
  }

  async function addDropSet() {
    setDropSets((current) => [
      ...current,
      { weight: "", reps: "" },
    ]);
  }

  async function removeDropSet(index: number) {
    const next = dropSets.filter((_, dropIndex) => dropIndex !== index);
    setDropSets(next);
    await persistIntensifierDetails(clusterCount, next, filmed);
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-[0.72fr_1fr_0.82fr_0.72fr_0.72fr]">
        <div className="col-span-2 flex min-h-10 items-center gap-2 px-1 text-sm font-semibold text-slate-300 sm:col-span-1 sm:min-h-11">
          <span>Set {set.setNumber}</span>
          <span
            className={`rounded-lg border px-2 py-1 text-[10px] font-semibold ${statusClass}`}
          >
            {statusText}
          </span>
        </div>

        <label className="relative col-start-1 row-start-2 sm:col-start-2 sm:row-start-1">
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase text-slate-600">
            kg
          </span>
          <input
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            className={`${inputClass} px-2 pr-7 sm:px-3 sm:pr-8`}
            aria-label={`Set ${set.setNumber} weight`}
            placeholder="kg"
          />
        </label>

        <label className="relative col-start-2 row-start-2 sm:col-start-3 sm:row-start-1">
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-600">
            reps
          </span>
          <input
            value={reps}
            onChange={(event) => setReps(event.target.value)}
            type="number"
            inputMode="numeric"
            min="0"
            className={`${inputClass} px-2 pr-10 sm:px-3`}
            aria-label={`Set ${set.setNumber} reps`}
            placeholder="reps"
          />
        </label>

        <label className="relative col-start-3 row-start-2 sm:col-start-4 sm:row-start-1">
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase text-slate-600">
            RIR
          </span>
          <input
            value={rir}
            onChange={(event) => setRir(event.target.value)}
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            max="10"
            className={`${inputClass} px-2 pr-8 sm:px-3`}
            aria-label={`Set ${set.setNumber} RIR`}
            placeholder="RIR"
          />
        </label>

        <label className="col-start-3 row-start-1 flex min-h-10 items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-950 px-2 text-xs font-semibold text-slate-300 sm:col-start-5 sm:min-h-11">
          <input
            checked={isCompleted}
            onChange={(event) => setIsCompleted(event.target.checked)}
            type="checkbox"
            className="h-5 w-5"
          />
          Done
        </label>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 p-2">
        <button
          type="button"
          onClick={() => void handleTimer()}
          disabled={timerBusy}
          className={`min-h-10 rounded-lg border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
            timerRunning
              ? "border-rose-400/30 bg-rose-400/10 text-rose-200 hover:bg-rose-400/15"
              : "border-orange-400/30 bg-orange-500/10 text-orange-200 hover:bg-orange-500/15"
          }`}
        >
          {timerBusy
            ? "Saving..."
            : timerRunning
              ? "End Set"
              : startedAt && endedAt
                ? "Restart Set"
                : "Start Set"}
        </button>

        <div className="min-w-16 text-center font-mono text-lg font-semibold tabular-nums text-slate-100">
          {formatDuration(elapsedSeconds)}
        </div>

        <label
          className={`flex min-h-9 items-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition ${
            filmed
              ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
              : "border-slate-700 text-slate-400"
          }`}
        >
          <input
            checked={filmed}
            onChange={(event) => {
              const nextFilmed = event.target.checked;
              setFilmed(nextFilmed);
              void saveWorkoutSetFilmed(set.id, nextFilmed).then((result) => {
                if (!result.ok) {
                  setFilmed(!nextFilmed);
                  setTrackingError(result.error);
                }
              });
            }}
            type="checkbox"
            className="h-4 w-4"
          />
          Filmed
        </label>

        <p className="basis-full text-[11px] leading-4 text-slate-500 sm:min-w-0 sm:flex-1 sm:basis-auto">
          {filmed
            ? "Filmed set: timing is stored but excluded from AI duration/rest interpretation."
            : timerRunning
              ? currentIntensifierKind === "none"
              ? "Timer running for this set."
              : "Keep running through the full intensifier. End only after all clusters/drops."
            : currentIntensifierKind === "none"
              ? "Times the complete working set."
              : "For intensifiers, Start → activation + all clusters/drops → End."}
        </p>
      </div>

      {trackingError ? (
        <p className="mt-1 text-xs text-rose-300">{trackingError}</p>
      ) : null}

      <details
        className="mt-2 rounded-xl border border-slate-800 bg-slate-950 p-2"
        onToggle={(event) => {
          if (event.currentTarget.open) void loadTrackingDetails();
        }}
      >
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">
          Set details
        </summary>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <select
            value={setTypeId}
            onChange={(event) =>
              void handleSetTypeChange(event.target.value)
            }
            className={smallSelectClass}
            aria-label="Set type"
          >
            {setTypes.map((setType: SetTypeOption) => (
              <option key={setType.id} value={setType.id}>
                {setType.name}
              </option>
            ))}
          </select>

          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-300">
            <input
              checked={painFlag}
              onChange={(event) => setPainFlag(event.target.checked)}
              type="checkbox"
              className="h-5 w-5"
            />
            Pain / discomfort
          </label>

        </div>

        {currentIntensifierKind === "clusters" ? (
          <div className="mt-2 rounded-xl border border-slate-800 bg-slate-900/50 p-2">
            <label className="block text-xs font-semibold text-slate-300">
              Post-activation clusters completed
              <input
                value={clusterCount}
                onChange={(event) => setClusterCount(event.target.value)}
                onBlur={() => void persistIntensifierDetails()}
                type="number"
                inputMode="numeric"
                min="0"
                className={`${inputClass} mt-1`}
                placeholder="e.g. 4"
              />
            </label>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">
              Count only the clusters after the activation set. The timer covers the entire intensifier.
            </p>
          </div>
        ) : null}

        {currentIntensifierKind === "drops" ? (
          <div className="mt-2 rounded-xl border border-slate-800 bg-slate-900/50 p-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-300">
                  Drop-set portions
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Main row above = initial/top portion. Add only the drops here.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void addDropSet()}
                className="min-h-9 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                + Drop
              </button>
            </div>

            <div className="mt-2 space-y-2">
              {dropSets.map((drop, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_1fr_auto] gap-2"
                >
                  <label className="relative">
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase text-slate-600">
                      kg
                    </span>
                    <input
                      value={drop.weight}
                      onChange={(event) =>
                        updateDropSet(index, "weight", event.target.value)
                      }
                      onBlur={() => void persistIntensifierDetails()}
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      min="0"
                      className={`${inputClass} px-2 pr-7`}
                      aria-label={`Drop ${index + 1} weight`}
                      placeholder="kg"
                    />
                  </label>

                  <label className="relative">
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-600">
                      reps
                    </span>
                    <input
                      value={drop.reps}
                      onChange={(event) =>
                        updateDropSet(index, "reps", event.target.value)
                      }
                      onBlur={() => void persistIntensifierDetails()}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      className={`${inputClass} px-2 pr-10`}
                      aria-label={`Drop ${index + 1} reps`}
                      placeholder="reps"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => void removeDropSet(index)}
                    className="min-h-11 rounded-xl border border-slate-700 px-3 text-xs font-semibold text-slate-400 hover:border-rose-400/30 hover:text-rose-200"
                    aria-label={`Remove drop ${index + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {detailsStatus !== "idle" ? (
              <p
                className={`mt-2 text-[11px] ${
                  detailsStatus === "error"
                    ? "text-rose-300"
                    : detailsStatus === "saved"
                      ? "text-emerald-300"
                      : "text-slate-500"
                }`}
              >
                {detailsStatus === "saving"
                  ? "Saving intensifier details..."
                  : detailsStatus === "saved"
                    ? "Intensifier details saved"
                    : "Could not save intensifier details"}
              </p>
            ) : null}
          </div>
        ) : null}

        {painFlag ? (
          <input
            value={painNote}
            onChange={(event) => setPainNote(event.target.value)}
            className={`${inputClass} mt-2`}
            placeholder="Pain/discomfort note, optional"
            aria-label="Pain note"
          />
        ) : null}
      </details>
    </div>
  );
}
