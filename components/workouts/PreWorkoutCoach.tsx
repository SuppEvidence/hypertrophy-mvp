"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type {
  PreWorkoutCoachDisplay,
  PreWorkoutCoachProposal,
} from "@/lib/ai/pre-workout-coach-schema";
import { startCoachedWorkout } from "@/lib/server/workouts";

type CoachResult = { proposal: PreWorkoutCoachProposal; display: PreWorkoutCoachDisplay };

function readable(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function statusClass(value: string) {
  if (["READY", "GOOD"].includes(value)) return "border-emerald-700/50 text-emerald-200";
  if (["CAUTION", "HIGH_FATIGUE"].includes(value)) return "border-rose-700/50 text-rose-200";
  if (["RECOVERING", "ELEVATED_FATIGUE", "FAT_LOSS_LIKELY"].includes(value)) return "border-amber-700/50 text-amber-200";
  return "border-slate-700 text-slate-400";
}

export function PreWorkoutCoach({ programId, templateId }: { programId: string; templateId: string }) {
  const [availableMinutes, setAvailableMinutes] = useState("60");
  const [constraints, setConstraints] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CoachResult | null>(null);

  useEffect(() => {
    setResult(null);
    setError(null);
  }, [programId, templateId]);

  async function review() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/pre-workout-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId, templateId, availableMinutes: Number(availableMinutes), constraints }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Pre-workout review failed.");
      setResult(payload as CoachResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pre-workout coach unavailable. Start the template unchanged.");
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    if (!result) return;
    setBusy(true);
    try {
      const response = await fetch("/api/pre-workout-coach/decline", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interventionId: result.proposal.interventionId }),
      });
      if (!response.ok) throw new Error("Could not save your choice. Please retry.");
      setResult(null);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your choice.");
    } finally {
      setBusy(false);
    }
  }

  const plannedMovementIds = new Set(result?.display.items.map((item) => item.movementGroupId) ?? []);
  const localWarnings = result?.proposal.localizedReadiness.filter((item) =>
    plannedMovementIds.has(item.movementGroupId) && (item.status === "CAUTION" || item.status === "RECOVERING"),
  ) ?? [];

  return (
    <div className="space-y-3 rounded-xl border border-sky-900/60 bg-sky-950/20 p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-300/80">Pre-workout coach</p>
        <p className="mt-1 text-sm text-slate-400">
          Review the planned session against localized performance/recovery evidence, metrics trends and today&apos;s constraints.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
        <label className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Time available</span>
          <div className="relative">
            <input
              type="number"
              min="20"
              max="120"
              step="5"
              value={availableMinutes}
              onChange={(event) => setAvailableMinutes(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 pr-11 text-sm text-slate-100 outline-none focus:border-sky-500"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">min</span>
          </div>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Today&apos;s constraints</span>
          <input
            value={constraints}
            maxLength={800}
            onChange={(event) => setConstraints(event.target.value)}
            placeholder="Optional: equipment unavailable, pain/irritation, exercise to avoid, schedule constraint"
            className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-500"
          />
        </label>
      </div>

      <button
        type="button"
        disabled={busy || Number(availableMinutes) < 20 || Number(availableMinutes) > 120}
        onClick={() => void review()}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-sky-700/60 bg-sky-950/50 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:border-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <><LoaderCircle size={16} className="mr-2 animate-spin" />Analyzing…</> : "Review workout with coach"}
      </button>

      {error ? <p className="rounded-lg border border-rose-800/50 bg-rose-950/30 p-2 text-sm text-rose-200">{error}</p> : null}

      {result ? (
        <div className="space-y-3 border-t border-sky-900/50 pt-3">
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-lg border px-2 py-1 text-[10px] font-semibold ${result.proposal.decision === "ADJUST" ? "border-amber-700/50 text-amber-200" : "border-emerald-700/50 text-emerald-200"}`}>
              {result.proposal.decision === "ADJUST" ? "Coach · Changes suggested" : "Coach · Keep template"}
            </span>
            <span className={`rounded-lg border px-2 py-1 text-[10px] font-semibold ${statusClass(result.proposal.bodyComposition.status)}`}>
              Metrics · {readable(result.proposal.bodyComposition.status)}
            </span>
            <span className={`rounded-lg border px-2 py-1 text-[10px] font-semibold ${statusClass(result.proposal.globalRecovery.status)}`}>
              Recovery · {readable(result.proposal.globalRecovery.status)}
            </span>
          </div>

          <p className="text-sm leading-6 text-slate-200">{result.proposal.summary}</p>
          <p className="text-xs text-slate-400">Sets: {result.display.volume.baselinePhysical} → {result.display.volume.proposedPhysical} · Estimated effective sets: {result.display.volume.baselineEffective} → {result.display.volume.proposedEffective} · Intensifiers: {result.display.volume.baselineIntensifiers} → {result.display.volume.proposedIntensifiers}</p>
          <p className="text-xs leading-5 text-slate-500">{result.proposal.bodyComposition.interpretation}</p>

          {localWarnings.length > 0 ? (
            <div className="space-y-1">
              {localWarnings.map((item) => (
                <div key={item.movementGroupId} className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-2 text-xs">
                  <span className="font-semibold text-amber-200">{item.movementGroupName} · {readable(item.status)}</span>
                  <span className="mt-0.5 block text-slate-400">{item.interpretation}</span>
                </div>
              ))}
            </div>
          ) : null}

          {result.display.changeLabels.length > 0 ? (
            <ul className="space-y-1 text-xs text-amber-200">
              {result.display.changeLabels.map((change) => <li key={change}>• {change}</li>)}
            </ul>
          ) : null}

          <details className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">
              Proposed workout · {result.display.items.length} exercises
            </summary>
            <div className="mt-2 space-y-2">
              {result.display.items.map((item, index) => (
                <div key={`${item.sourceSlotId}:${index}`} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-slate-800 p-2 text-xs">
                  <span className="text-slate-200">{index + 1}. {item.exerciseName}<span className="block text-slate-500">{item.movementGroupName}</span></span>
                  <span className="text-right text-slate-300">{item.sets} sets · {item.repRange}{item.targetRir !== null ? ` · ${item.targetRir} RIR` : ""}</span>
                  <span className="col-span-2 text-slate-500">{item.reason}</span>
                  <span className="col-span-2 text-slate-500">Set types: {item.setTypes.join(" · ")}</span>
                </div>
              ))}
            </div>
          </details>

          <form action={startCoachedWorkout}>
            <input type="hidden" name="proposal" value={JSON.stringify(result.proposal)} />
            <Button className="w-full" pendingText="Starting coached workout…">
              {result.proposal.decision === "ADJUST" ? "Start coached workout" : "Start reviewed workout"}
            </Button>
          </form>
          <button type="button" disabled={busy} onClick={() => void decline()} className="w-full text-center text-xs text-slate-400 underline disabled:opacity-50">Skip this proposal</button>
        </div>
      ) : null}
    </div>
  );
}
