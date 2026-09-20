"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

import {
  getExercisePainContext,
  saveExercisePainContext,
  type ExercisePainContext,
} from "@/lib/server/exercise-pain";

const locationOptions = [
  ["SHOULDER", "Shoulder"],
  ["ELBOW", "Elbow"],
  ["WRIST_HAND", "Wrist / hand"],
  ["NECK_UPPER_BACK", "Neck / upper back"],
  ["LOW_BACK", "Low back"],
  ["HIP_GROIN", "Hip / groin"],
  ["KNEE", "Knee"],
  ["ANKLE_FOOT", "Ankle / foot"],
  ["OTHER", "Other"],
] as const;

const sideOptions = [
  ["LEFT", "Left"],
  ["RIGHT", "Right"],
  ["BOTH", "Both"],
  ["NA", "N/A"],
] as const;

const impactOptions = [
  ["NOTICED_ONLY", "Noticed only"],
  ["AFFECTED_EXECUTION", "Affected execution"],
  ["CHANGED_OR_STOPPED", "Changed / stopped exercise"],
] as const;

const emptyContext: ExercisePainContext = {
  painFlag: false,
  painLocation: null,
  painSide: null,
  painImpact: null,
  painNote: null,
};

function readyToPersist(context: ExercisePainContext) {
  return (
    !context.painFlag ||
    Boolean(context.painLocation && context.painImpact)
  );
}

export function ExercisePainLogger({
  sessionExerciseId,
}: {
  sessionExerciseId: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [context, setContext] = useState<ExercisePainContext>(emptyContext);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (loaded || loading) return;
    setLoading(true);
    setError(null);
    const result = await getExercisePainContext(sessionExerciseId);
    if (result.ok) {
      setContext(result.context);
      setLoaded(true);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }

  async function persist(next: ExercisePainContext) {
    setContext(next);
    setError(null);
    if (!readyToPersist(next)) return;

    setSaving(true);
    const result = await saveExercisePainContext(sessionExerciseId, next);
    if (result.ok) {
      setContext(result.context);
    } else {
      setError(result.error);
    }
    setSaving(false);
  }

  function update(next: ExercisePainContext) {
    setContext(next);
    if (readyToPersist(next)) void persist(next);
  }

  const active = context.painFlag;
  const incomplete = active && !readyToPersist(context);

  return (
    <details
      className={`mb-3 rounded-xl border p-2.5 transition ${
        active
          ? "border-amber-400/30 bg-amber-400/[0.06]"
          : "border-slate-800 bg-slate-900/40"
      }`}
      onToggle={(event) => {
        if (event.currentTarget.open) void load();
      }}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-slate-300 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <AlertTriangle
            size={15}
            className={active ? "text-amber-300" : "text-slate-600"}
          />
          Pain / ache / odd feeling
        </span>
        <span className="text-[11px] font-medium text-slate-500">
          {loading ? "Loading…" : active ? "Flagged" : "Optional"}
        </span>
      </summary>

      {loaded ? (
        <div className="mt-3 space-y-3 border-t border-white/[0.06] pt-3">
          <label className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => {
                const painFlag = event.target.checked;
                if (painFlag) {
                  setContext({ ...context, painFlag: true });
                  setError(null);
                } else {
                  void persist({ ...emptyContext });
                }
              }}
              className="h-4 w-4"
            />
            Log an issue for this exercise today
          </label>

          {active ? (
            <>
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Location
                </p>
                <div className="flex flex-wrap gap-2">
                  {locationOptions.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        update({ ...context, painLocation: value })
                      }
                      className={`min-h-9 rounded-lg border px-3 text-xs font-semibold transition ${
                        context.painLocation === value
                          ? "border-amber-400/40 bg-amber-400/10 text-amber-100"
                          : "border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Side
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {sideOptions.map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => update({ ...context, painSide: value })}
                        className={`min-h-9 rounded-lg border px-3 text-xs font-semibold transition ${
                          context.painSide === value
                            ? "border-sky-400/30 bg-sky-400/10 text-sky-100"
                            : "border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Effect on training
                  </p>
                  <select
                    value={context.painImpact ?? ""}
                    onChange={(event) =>
                      update({
                        ...context,
                        painImpact: event.target.value || null,
                      })
                    }
                    className="min-h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200 outline-none focus:border-amber-400/60"
                  >
                    <option value="">Choose impact</option>
                    {impactOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <textarea
                value={context.painNote ?? ""}
                onChange={(event) =>
                  setContext({ ...context, painNote: event.target.value })
                }
                onBlur={() => {
                  if (readyToPersist(context)) void persist(context);
                }}
                rows={2}
                placeholder="Optional note: when it appeared, setup change, unusual feeling…"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-400/60"
              />

              {incomplete ? (
                <p className="text-[11px] font-medium text-amber-200/80">
                  Choose a location and training impact to save this flag.
                </p>
              ) : null}

              <p className="text-[11px] leading-4 text-slate-500">
                Training context only, not an injury diagnosis. Repeated or
                function-limiting issues become a precaution signal for the AI
                Advisor.
              </p>
            </>
          ) : null}

          {saving ? (
            <p className="text-[11px] text-slate-500">Saving…</p>
          ) : null}
          {error ? <p className="text-xs text-rose-300">{error}</p> : null}
        </div>
      ) : error ? (
        <p className="mt-2 text-xs text-rose-300">{error}</p>
      ) : null}
    </details>
  );
}
