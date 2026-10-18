import type { WorkoutExerciseGuidance } from "@/lib/workouts/exercise-guidance";

export function ExerciseGuidance({
  guidance,
  setupNotes,
  primaryMuscles = [],
}: {
  guidance?: WorkoutExerciseGuidance;
  setupNotes: string | null;
  primaryMuscles?: string[];
}) {
  const setup = guidance?.setup ?? (setupNotes ? [setupNotes] : []);
  return (
    <details className="rounded-xl border border-sky-400/15 bg-sky-950/10 p-3">
      <summary className="cursor-pointer text-xs font-semibold text-sky-200">
        Exercise guidance · setup & execution
      </summary>
      <div className="mt-3 space-y-3 text-sm leading-6 text-slate-300">
        {primaryMuscles.length ? (
          <p className="text-xs text-slate-400">
            Primary muscles: {primaryMuscles.join(", ")}
          </p>
        ) : null}
        {guidance?.summary ? <p>{guidance.summary}</p> : null}
        {setup.length ? (
          <div>
            <h4 className="text-xs font-semibold text-slate-400">Setup</h4>
            {setup.map((note, index) => (
              <p key={index} className="mt-1 whitespace-pre-wrap">
                {note}
              </p>
            ))}
          </div>
        ) : null}
        {guidance?.cues.length ? (
          <div>
            <h4 className="text-xs font-semibold text-slate-400">
              Execution cues
            </h4>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {guidance.cues.map((cue) => (
                <li key={cue}>{cue}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {guidance?.status === "STALE" ? (
          <p className="text-xs text-amber-200">
            The exercise setup has changed since the saved assessment. Update
            its coach profile in the exercise library for current advice.
          </p>
        ) : guidance?.status !== "ACCEPTED" ? (
          <p className="text-xs text-slate-500">
            No accepted Exercise Coach guidance is saved for this setup.
          </p>
        ) : null}
        {guidance?.status === "ACCEPTED" ? (
          <details className="border-t border-slate-800 pt-2">
            <summary className="cursor-pointer text-xs font-medium text-slate-400">
              Movement, muscle emphasis & assessment notes
            </summary>
            <div className="mt-2 space-y-3 text-xs leading-5">
              {guidance.targets.length ? (
                <p>
                  {guidance.targets
                    .map(
                      (target) =>
                        `${target.name}${target.region ? ` (${target.region})` : ""} · ${target.role.toLowerCase()}${target.confidence === "LOW" ? " · tentative" : ""}`,
                    )
                    .join("; ")}
                </p>
              ) : null}
              {[
                ["Movement", guidance.movement],
                ["Resistance", guidance.resistance],
                ["Muscle length", guidance.muscleLength],
                ["Support & fatigue", guidance.fatigue],
                ["Set formats", guidance.setFormats],
              ].map(([label, value]) =>
                value ? (
                  <p key={label}>
                    <span className="font-semibold text-slate-400">
                      {label}:{" "}
                    </span>
                    {value}
                  </p>
                ) : null,
              )}
              {guidance.observedExecution.length ? (
                <div>
                  <p className="font-semibold text-slate-400">
                    Observed execution
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {guidance.observedExecution.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {guidance.limitations.length ? (
                <div>
                  <p className="font-semibold text-slate-400">
                    Assessment limits
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {guidance.limitations.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
    </details>
  );
}
