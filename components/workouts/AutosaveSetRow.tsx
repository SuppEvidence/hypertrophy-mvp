"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { autosaveWorkoutSet } from "@/lib/server/workouts";

const inputClass =
  "min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-slate-400";

type SetTypeOption = {
  id: string;
  name: string;
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
  };
  setTypes: SetTypeOption[];
};

function decimalToInput(value: unknown) {
  if (value === null || value === undefined) return "";
  const num = Number(value);
  return Number.isFinite(num) ? String(num) : "";
}

export function AutosaveSetRow({ set, setTypes }: AutosaveSetRowProps) {
  const [weight, setWeight] = useState(decimalToInput(set.weight));
  const [reps, setReps] = useState(set.reps === null || set.reps === undefined ? "" : String(set.reps));
  const [rir, setRir] = useState(decimalToInput(set.rir));
  const [setTypeId, setSetTypeId] = useState(set.setTypeId);
  const [isCompleted, setIsCompleted] = useState(set.isCompleted);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isPending, startTransition] = useTransition();
  const didMount = useRef(false);
  const saveVersion = useRef(0);

  const payload = useMemo(
    () => ({ weight, reps, rir, setTypeId, isCompleted }),
    [weight, reps, rir, setTypeId, isCompleted],
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

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
      <div className="grid grid-cols-[0.6fr_1fr_1fr_1fr_1.4fr] gap-2">
        <div className="flex min-h-11 items-center text-sm font-semibold text-slate-300">{set.setNumber}</div>
        <input value={weight} onChange={(event) => setWeight(event.target.value)} type="number" inputMode="decimal" step="0.5" min="0" className={inputClass} aria-label="Weight" />
        <input value={reps} onChange={(event) => setReps(event.target.value)} type="number" inputMode="numeric" min="0" className={inputClass} aria-label="Reps" />
        <input value={rir} onChange={(event) => setRir(event.target.value)} type="number" inputMode="decimal" step="0.5" min="0" max="10" className={inputClass} aria-label="RIR" />
        <select value={setTypeId} onChange={(event) => setSetTypeId(event.target.value)} className={inputClass} aria-label="Set type">
          {setTypes.map((setType: any) => (
            <option key={setType.id} value={setType.id}>{setType.name}</option>
          ))}
        </select>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-300">
          <input checked={isCompleted} onChange={(event) => setIsCompleted(event.target.checked)} type="checkbox" className="h-5 w-5" /> Completed
        </label>
        <div className={`flex min-h-11 items-center rounded-xl border px-3 text-xs font-semibold ${status === "error" ? "border-red-400/40 text-red-200" : "border-slate-800 text-slate-500"}`}>
          {statusText}
        </div>
      </div>
    </div>
  );
}
