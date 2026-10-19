"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOneOffAlternative } from "@/lib/server/one-off-alternative";

export function OneOffAlternative({
  sessionExerciseId,
  enabled,
  editable,
  muscles,
  secondaryMuscles,
  movement,
}: {
  sessionExerciseId: string;
  enabled: boolean;
  editable: boolean;
  muscles: string[];
  secondaryMuscles: string[];
  movement: string;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  function change(next: boolean) {
    start(async () => {
      setError(null);
      try {
        const result = await setOneOffAlternative(
          sessionExerciseId,
          next,
          confirmed,
        );
        if (!result.ok) setError(result.error);
        else router.refresh();
      } catch {
        setError("Could not change logging mode. Try again.");
      }
    });
  }
  return (
    <details
      className="rounded-xl border border-slate-700 p-3"
    >
      <summary className="cursor-pointer text-sm font-medium text-amber-200">
        {enabled
          ? "One-off alternative · volume & RIR only"
          : "Different equipment? Use a one-off alternative"}
      </summary>
      <div className="mt-3 space-y-3 text-sm text-slate-300">
        <p>
          Use an available exercise with a similar movement and muscle emphasis.
          No library entry needed.
        </p>
        <p>
          <strong>{movement}</strong> · Main muscles:{" "}
          {muscles.join(", ") || "Not classified"}
          {secondaryMuscles.length
            ? ` · Supporting: ${secondaryMuscles.join(", ")}`
            : ""}
          .
        </p>
        <p className="text-xs text-slate-400">
          Completed sets count toward these muscle targets using the existing
          allocation as an estimate. Record the actual set format and observed
          RIR. Load and reps are not recorded; this will not change future
          exercise choices.
        </p>
        {enabled ? (
          <p className="text-xs text-slate-400">
            Machine-specific guidance and live load coaching are paused for this
            exercise. Add an optional equipment/setup note below.
          </p>
        ) : null}
        {editable ? (
          <>
            {!enabled ? (
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0"
                />
                My alternative uses a similar movement and trains these muscles
                with similar emphasis.
              </label>
            ) : null}
            <button
              type="button"
              disabled={
                pending || (!enabled && (!confirmed || !muscles.length))
              }
              onClick={() => change(!enabled)}
              className="min-h-11 rounded-xl border border-slate-600 px-3 disabled:opacity-50"
            >
              {pending
                ? "Saving…"
                : enabled
                  ? "Return to normal logging"
                  : "Use for this workout only"}
            </button>
            <p className="text-xs text-slate-500">
              Choose before starting this exercise. Switching clears uncompleted
              set entries and resets the format to standard sets when enabling.
            </p>
          </>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-rose-300">
            {error}
          </p>
        ) : null}
      </div>
    </details>
  );
}
