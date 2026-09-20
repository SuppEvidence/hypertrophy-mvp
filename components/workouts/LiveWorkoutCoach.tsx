"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { applyWorkoutCoachAction, declineWorkoutCoachAction } from "@/lib/server/workout-coach-actions";
import type { CoachView } from "@/lib/server/workout-coach-engine";

export const COACH_SET_SAVED_EVENT = "rfd-coach-set-saved";
export const COACH_SET_STARTED_EVENT = "rfd-coach-set-started";

export function LiveWorkoutCoach({ sessionId, sessionExerciseId, sets }: {
  sessionId: string; sessionExerciseId: string;
  sets: Array<{ id: string; setNumber: number; isCompleted: boolean }>;
}) {
  const router = useRouter();
  const [action, setAction] = useState<CoachView | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setsRef = useRef(sets);
  useEffect(() => { setsRef.current = sets; }, [sets]);
  const requestVersion = useRef(0);

  useEffect(() => {
    let mounted = true;
    const controllers = new Set<AbortController>();
    async function check(triggerSetId?: string) {
      const version = ++requestVersion.current;
      const controller = new AbortController();
      controllers.add(controller);
      try {
        const response = await fetch("/api/workout-coach", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, sessionExerciseId, triggerSetId }), signal: controller.signal,
        });
        const result = await response.json();
        if (!mounted || requestVersion.current !== version) return;
        setAction(result.action ?? null);
        setMessage(result.unavailable ? "Coach unavailable. Continue with your current targets." : null);
        if (result.action?.status === "APPLIED" && triggerSetId) router.refresh();
      } catch {
        if (mounted && !controller.signal.aborted && requestVersion.current === version) {
          setMessage("Coach unavailable. Continue with your current targets.");
        }
      } finally { controllers.delete(controller); }
    }
    // Restores pending approvals after refresh; does not call the model.
    if (setsRef.current.length > 1) void check();
    const saved = (event: Event) => {
      const detail = (event as CustomEvent<{ setId: string; isCompleted: boolean }>).detail;
      const trigger = setsRef.current.find(s => s.id === detail?.setId);
      if (!trigger) return;
      if (!detail.isCompleted) { ++requestVersion.current; setAction(null); return; }
      if (setsRef.current.length <= 1 || !setsRef.current.some(s => s.setNumber > trigger.setNumber && !s.isCompleted)) return;
      void check(trigger.id);
    };
    const started = (event: Event) => {
      const detail = (event as CustomEvent<{ setId: string }>).detail;
      if (setsRef.current.some(s => s.id === detail?.setId)) {
        ++requestVersion.current;
        setAction(null);
        setMessage(null);
      }
    };
    window.addEventListener(COACH_SET_SAVED_EVENT, saved);
    window.addEventListener(COACH_SET_STARTED_EVENT, started);
    return () => {
      mounted = false;
      controllers.forEach(c => c.abort());
      window.removeEventListener(COACH_SET_SAVED_EVENT, saved);
      window.removeEventListener(COACH_SET_STARTED_EVENT, started);
    };
  }, [sessionId, sessionExerciseId, router]);

  async function choose(approve: boolean) {
    if (!action) return;
    setBusy(true);
    try {
      const result = approve ? await applyWorkoutCoachAction(action.id) : await declineWorkoutCoachAction(action.id);
      setAction(null);
      setMessage(result.ok ? approve ? "Remaining plan updated." : null : result.error);
      if (result.ok && approve) router.refresh();
    } catch { setMessage("Could not save your choice. Your sets have not been confirmed as removed."); }
    finally { setBusy(false); }
  }

  if (!action && !message) return null;
  const approval = action?.status === "PROPOSED" && ["REMOVE_SET", "STOP_EXERCISE"].includes(action.actionType);
  return <div className="rounded-xl border border-sky-800/60 bg-sky-950/20 p-3 text-sm" aria-live="polite">
    {action ? <>
      <p className="font-semibold text-sky-100">{approval
        ? action.actionType === "STOP_EXERCISE" ? "Stop this exercise?" : `Remove set ${action.targetSetNumbers.join(", ")}?`
        : `Set ${action.targetSetNumbers.join(", ")} targets updated automatically`}</p>
      {action.prescription ? <p className="mt-1 text-slate-200">
        {action.prescription.suggestedLoad !== null ? `${action.prescription.suggestedLoad} kg · ` : ""}
        {action.prescription.minReps !== null ? `${action.prescription.minReps}–${action.prescription.maxReps} reps · ` : ""}
        {action.prescription.targetRir !== null ? `${action.prescription.targetRir} RIR` : ""}
      </p> : null}
      <p className="mt-1 text-slate-300">{action.reason}</p>
      {approval ? <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void choose(true)} className="min-h-11 rounded-lg bg-orange-500 px-3 font-semibold text-slate-950 disabled:opacity-50">{busy ? "Saving…" : "Approve removal"}</button>
        <button type="button" disabled={busy} onClick={() => void choose(false)} className="min-h-11 rounded-lg border border-slate-600 px-3 text-slate-200 disabled:opacity-50">Keep all sets</button>
      </div> : <p className="mt-1 text-xs text-slate-400">Log what you actually perform below. Adjust the load to your equipment if needed.</p>}
    </> : null}
    {message ? <p className="text-slate-400">{message}</p> : null}
  </div>;
}
