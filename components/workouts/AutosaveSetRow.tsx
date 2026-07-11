"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { autosaveWorkoutSet } from "@/lib/server/workouts";

const inputClass =
  "min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-slate-400";

const smallSelectClass =
  "min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100 outline-none focus:border-slate-400";

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
};

function decimalToInput(value: unknown) {
  if (value === null || value === undefined) return "";
  const num = Number(value);
  return Number.isFinite(num) ? String(num) : "";
}

export function AutosaveSetRow({ set, setTypes, repRangeStatusOptions, effortStatusOptions, mode = "stimulus" }: AutosaveSetRowProps) {
  const [weight, setWeight] = useState(decimalToInput(set.weight));
  const [reps, setReps] = useState(set.reps === null || set.reps === undefined ? "" : String(set.reps));
  const [rir, setRir] = useState(decimalToInput(set.rir));
  const [setTypeId, setSetTypeId] = useState(set.setTypeId);
  const [isCompleted, setIsCompleted] = useState(set.isCompleted);
  const [repRangeStatus, setRepRangeStatus] = useState(set.repRangeStatus ?? "IN_RANGE");
  const [effortStatus, setEffortStatus] = useState(set.effortStatus ?? "PRODUCTIVE");
  const [painFlag, setPainFlag] = useState(Boolean(set.painFlag));
  const [painNote, setPainNote] = useState(set.painNote ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isPending, startTransition] = useTransition();
  const didMount = useRef(false);
  const saveVersion = useRef(0);

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
      });
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [payload, set.id]);

  const statusText = isPending || status === "saving" ? "Saving" : status === "saved" ? "Saved" : status === "error" ? "Save failed" : "Autosave";

  if (mode === "advanced") {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
        <div className="grid grid-cols-[0.6fr_1fr_1fr_1fr] gap-2">
          <div className="flex min-h-11 items-center text-sm font-semibold text-slate-300">{set.setNumber}</div>
          <input value={weight} onChange={(event) => setWeight(event.target.value)} type="number" inputMode="decimal" step="0.5" min="0" className={inputClass} aria-label="Weight" />
          <input value={reps} onChange={(event) => setReps(event.target.value)} type="number" inputMode="numeric" min="0" className={inputClass} aria-label="Reps" />
          <input value={rir} onChange={(event) => setRir(event.target.value)} type="number" inputMode="decimal" step="0.5" min="0" max="10" className={inputClass} aria-label="RIR" />
        </div>
        <div className={`mt-2 inline-flex min-h-9 items-center rounded-xl border px-3 text-xs font-semibold ${status === "error" ? "border-red-400/40 text-red-200" : "border-slate-800 text-slate-500"}`}>
          {statusText}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
      <div className="grid gap-2 lg:grid-cols-[0.4fr_0.8fr_1.2fr_1.2fr_1.2fr_0.8fr]">
        <div className="flex min-h-11 items-center text-sm font-semibold text-slate-300">Set {set.setNumber}</div>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-300">
          <input checked={isCompleted} onChange={(event) => setIsCompleted(event.target.checked)} type="checkbox" className="h-5 w-5" /> Done
        </label>
        <select value={setTypeId} onChange={(event) => setSetTypeId(event.target.value)} className={smallSelectClass} aria-label="Set type">
          {setTypes.map((setType: SetTypeOption) => (
            <option key={setType.id} value={setType.id}>{setType.name}</option>
          ))}
        </select>
        <select value={repRangeStatus} onChange={(event) => setRepRangeStatus(event.target.value)} className={smallSelectClass} aria-label="Rep range status">
          {repRangeStatusOptions.map((option: StatusOption) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select value={effortStatus} onChange={(event) => setEffortStatus(event.target.value)} className={smallSelectClass} aria-label="Effort status">
          {effortStatusOptions.map((option: StatusOption) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-300">
          <input checked={painFlag} onChange={(event) => setPainFlag(event.target.checked)} type="checkbox" className="h-5 w-5" /> Pain
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

      <details className="mt-2 rounded-xl border border-slate-800 bg-slate-950 p-2">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">Optional load / reps / RIR</summary>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <input value={weight} onChange={(event) => setWeight(event.target.value)} type="number" inputMode="decimal" step="0.5" min="0" className={inputClass} aria-label="Weight" placeholder="kg" />
          <input value={reps} onChange={(event) => setReps(event.target.value)} type="number" inputMode="numeric" min="0" className={inputClass} aria-label="Reps" placeholder="reps" />
          <input value={rir} onChange={(event) => setRir(event.target.value)} type="number" inputMode="decimal" step="0.5" min="0" max="10" className={inputClass} aria-label="RIR" placeholder="RIR" />
        </div>
      </details>

      <div className={`mt-2 inline-flex min-h-9 items-center rounded-xl border px-3 text-xs font-semibold ${status === "error" ? "border-red-400/40 text-red-200" : "border-slate-800 text-slate-500"}`}>
        {statusText}
      </div>
    </div>
  );
}
