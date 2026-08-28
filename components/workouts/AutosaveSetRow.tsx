"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { autosaveWorkoutSet } from "@/lib/server/workouts";
import { WORKOUT_SET_COMPLETION_EVENT } from "@/components/workouts/ExerciseCollapseCard";

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
export function AutosaveSetRow({ set, setTypes, prefillWeight, prefillReps, prefillRir }: AutosaveSetRowProps) {
  const [weight, setWeight] = useState(decimalToInput(set.weight) || decimalToInput(prefillWeight));
  const [reps, setReps] = useState(
    set.reps === null || set.reps === undefined
      ? prefillReps === null || prefillReps === undefined
        ? ""
        : String(prefillReps)
      : String(set.reps),
  );
  const [rir, setRir] = useState(decimalToInput(set.rir) || decimalToInput(prefillRir));
  const [setTypeId, setSetTypeId] = useState(set.setTypeId);
  const [isCompleted, setIsCompleted] = useState(set.isCompleted);
  const repRangeStatus = !set.repRangeStatus || set.repRangeStatus === "NOT_LOGGED" ? "IN_RANGE" : set.repRangeStatus;
  const effortStatus = set.effortStatus ?? "PRODUCTIVE";
  const [painFlag, setPainFlag] = useState(Boolean(set.painFlag));
  const [painNote, setPainNote] = useState(set.painNote ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isPending, startTransition] = useTransition();
  const didMount = useRef(false);
  const saveVersion = useRef(0);
  const lastSavedCompletion = useRef(set.isCompleted);
  const payload = useMemo(
    () => ({ weight, reps, rir, setTypeId, isCompleted, repRangeStatus, effortStatus, painFlag, painNote }),
    [weight, reps, rir, setTypeId, isCompleted, repRangeStatus, effortStatus, painFlag, painNote],
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
        const result = await autosaveWorkoutSet(set.id, payload);
        if (saveVersion.current !== currentVersion) return;
        setStatus(result.ok ? "saved" : "error");
        if (result.ok && lastSavedCompletion.current !== payload.isCompleted) {
          lastSavedCompletion.current = payload.isCompleted;
          window.dispatchEvent(
            new CustomEvent(WORKOUT_SET_COMPLETION_EVENT, {
              detail: { setId: set.id, isCompleted: payload.isCompleted },
            }),
          );
        }
      });
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [payload, set.id]);

  const statusText = isPending || status === "saving" ? "Saving" : status === "saved" ? "Saved" : status === "error" ? "Save failed" : "Autosave";
  const statusClass = status === "error" ? "border-red-400/40 text-red-200" : status === "saved" ? "border-emerald-500/30 text-emerald-200" : "border-slate-800 text-slate-500";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
      <div className="grid grid-cols-[0.72fr_1fr_0.82fr_0.72fr_0.72fr] gap-2">
        <div className="flex min-h-11 items-center px-1 text-sm font-semibold text-slate-300">Set {set.setNumber}</div>
        <label className="relative">
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase text-slate-600">kg</span>
          <input value={weight} onChange={(event) => setWeight(event.target.value)} type="number" inputMode="decimal" step="0.5" min="0" className={`${inputClass} pr-8`} aria-label={`Set ${set.setNumber} weight`} placeholder="kg" />
        </label>
        <input value={reps} onChange={(event) => setReps(event.target.value)} type="number" inputMode="numeric" min="0" className={inputClass} aria-label={`Set ${set.setNumber} reps`} placeholder="reps" />
        <input value={rir} onChange={(event) => setRir(event.target.value)} type="number" inputMode="decimal" step="0.5" min="0" max="10" className={inputClass} aria-label={`Set ${set.setNumber} RIR`} placeholder="RIR" />
        <label className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-950 px-2 text-xs font-semibold text-slate-300">
          <input checked={isCompleted} onChange={(event) => setIsCompleted(event.target.checked)} type="checkbox" className="h-5 w-5" />
          Done
        </label>
      </div>
      <details className="mt-2 rounded-xl border border-slate-800 bg-slate-950 p-2">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">Set type / pain</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <select value={setTypeId} onChange={(event) => setSetTypeId(event.target.value)} className={smallSelectClass} aria-label="Set type">
            {setTypes.map((setType: SetTypeOption) => (
              <option key={setType.id} value={setType.id}>{setType.name}</option>
            ))}
          </select>
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-300">
            <input checked={painFlag} onChange={(event) => setPainFlag(event.target.checked)} type="checkbox" className="h-5 w-5" /> Pain / discomfort
          </label>
        </div>
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
      <div className={`mt-2 inline-flex min-h-8 items-center rounded-xl border px-3 text-xs font-semibold ${statusClass}`}>
        {statusText}
      </div>
    </div>
  );
}
