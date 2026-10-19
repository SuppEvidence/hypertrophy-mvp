"use client";

import { useEffect, useRef, useState } from "react";
import { autosaveWorkoutSetCore } from "@/lib/server/workout-set-autosave";
import {
  getWorkoutSetTracking,
  saveWorkoutSetExecution,
} from "@/lib/server/set-tracking-server";
import { WORKOUT_SET_COMPLETION_EVENT } from "@/components/workouts/ExerciseCollapseCard";

const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-2 text-base text-slate-100";
export function OneOffSetRow({
  set,
  setTypes,
}: {
  set: {
    id: string;
    setNumber: number;
    rir: unknown;
    setTypeId: string;
    isCompleted: boolean;
  };
  setTypes: Array<{ id: string; name: string }>;
}) {
  const [rir, setRir] = useState(set.rir == null ? "" : String(set.rir));
  const [type, setType] = useState(set.setTypeId);
  const [done, setDone] = useState(set.isCompleted);
  const [status, setStatus] = useState("");
  const [compromised, setCompromised] = useState(false);
  const [executionReady, setExecutionReady] = useState(false);
  const [executionBusy, setExecutionBusy] = useState(false);
  const dirty = useRef(false);
  const version = useRef(0);
  const lastDone = useRef(set.isCompleted);
  const saveQueue = useRef(Promise.resolve());
  useEffect(() => {
    if (!dirty.current) return;
    const revision = ++version.current;
    setStatus("Saving…");
    const timer = window.setTimeout(() => {
      // Serialize rapid changes so older network completions cannot overwrite newer input.
      saveQueue.current = saveQueue.current.then(async () => {
        try {
          const result = await autosaveWorkoutSetCore(set.id, {
            oneOffAlternative: true,
            rir,
            setTypeId: type,
            isCompleted: done,
          });
          if (result.ok && lastDone.current !== done) {
            window.dispatchEvent(
              new CustomEvent(WORKOUT_SET_COMPLETION_EVENT, {
                detail: { setId: set.id, isCompleted: done },
              }),
            );
            lastDone.current = done;
          }
          if (revision === version.current)
            setStatus(result.ok ? "Saved" : (result.error ?? "Could not save"));
        } catch {
          if (revision === version.current)
            setStatus("Could not save. Change the entry to retry.");
        }
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [rir, type, done, set.id]);
  return (
    <div className="rounded-xl border border-slate-800 p-3">
      <div
        className="grid items-end gap-2"
        style={{ gridTemplateColumns: "auto minmax(0, 1fr) 5rem auto" }}
      >
        <span className="pb-3 text-sm text-slate-400">{set.setNumber}</span>
        <label className="min-w-0 text-xs text-slate-400">
          Set format
          <select
            aria-label={`Set ${set.setNumber} format`}
            className={inputClass}
            value={type}
            onChange={(e) => {
              dirty.current = true;
              setType(e.target.value);
            }}
          >
            {setTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          RIR
          <input
            aria-label={`Set ${set.setNumber} RIR`}
            className={inputClass}
            type="number"
            inputMode="decimal"
            min="0"
            max="10"
            step="0.5"
            value={rir}
            onChange={(e) => {
              dirty.current = true;
              setRir(e.target.value);
            }}
            placeholder="RIR"
          />
        </label>
        <label className="flex min-h-11 items-center gap-1 text-xs text-slate-300">
          <input
            aria-label={`Set ${set.setNumber} done`}
            className="h-5 w-5"
            type="checkbox"
            checked={done}
            disabled={
              !done &&
              (rir === "" ||
                !Number.isFinite(Number(rir)) ||
                Number(rir) < 0 ||
                Number(rir) > 10)
            }
            onChange={(e) => {
              dirty.current = true;
              setDone(e.target.checked);
            }}
          />
          Done
        </label>
      </div>
      <p className="mt-1 text-xs text-slate-500" role="status">
        {status || "Enter observed RIR, then mark done."}
      </p>
      <details
        className="mt-2 text-xs text-slate-400"
        onToggle={async (e) => {
          if (!e.currentTarget.open || executionReady) return;
          try {
            const result = await getWorkoutSetTracking(set.id);
            if (result.ok) {
              setCompromised(result.intensifierDetails.executionCompromised);
              setExecutionReady(true);
            }
          } catch {
            setStatus("Could not load execution details. Reopen to retry.");
          }
        }}
      >
        <summary className="cursor-pointer">Execution</summary>
        <label className="mt-2 flex min-h-10 items-center gap-2">
          <input
            type="checkbox"
            checked={compromised}
            disabled={!executionReady || executionBusy}
            onChange={async (e) => {
              const next = e.target.checked;
              setExecutionBusy(true);
              try {
                const result = await saveWorkoutSetExecution(set.id, next, []);
                if (result.ok) setCompromised(next);
                else setStatus(result.error);
              } catch {
                setStatus("Could not save execution details. Try again.");
              } finally {
                setExecutionBusy(false);
              }
            }}
          />
          Execution was meaningfully compromised
        </label>
      </details>
    </div>
  );
}
