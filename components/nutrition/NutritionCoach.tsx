"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import {
  baselineSchema,
  proposalSchema,
  type Baseline,
  type Proposal,
} from "@/lib/nutrition/schema";
import type { getNutritionView } from "@/lib/server/nutrition-coach";
type View = Awaited<ReturnType<typeof getNutritionView>>;
const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100";
function Text({
  label,
  value,
  onChange,
  max = 1200,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
}) {
  return (
    <label className="block space-y-2 text-sm text-slate-300">
      <span>{label}</span>
      <textarea
        className={inputClass}
        rows={3}
        maxLength={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function Macros({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Baseline["dailyMacros"];
  onChange: (v: Baseline["dailyMacros"]) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm text-slate-400">
        {label} (optional, grams)
      </legend>
      <div className="grid grid-cols-3 gap-2">
        {(["protein", "carbs", "fat"] as const).map((k) => (
          <Field
            key={k}
            label={k}
            type="number"
            min={0}
            max={k === "carbs" ? 1500 : 500}
            step="any"
            placeholder="Unknown"
            value={value[k] ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                [k]: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        ))}
      </div>
    </fieldset>
  );
}
function deltas(c: Proposal["changes"][number]) {
  return (["protein", "carbs", "fat"] as const)
    .flatMap((k) => {
      const v = c[`${k}Delta`];
      return v === null
        ? [`${k}: unquantified`]
        : v === 0
          ? []
          : [`${v > 0 ? "+" : ""}${v}g ${k}`];
    })
    .join(" · ");
}
export function NutritionCoach({ initial }: { initial: View }) {
  const [view, setView] = useState(initial);
  const [baseline, setBaseline] = useState(initial.baseline);
  const [pending, setPending] = useState("");
  const inflight = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [message, setMessage] = useState("");
  const [applyPhase, setApplyPhase] = useState(false);
  const [report, setReport] = useState({
    adherence: "UNKNOWN",
    hunger: "",
    energy: "",
    digestion: "",
    notes: "",
  });
  const dirty = JSON.stringify(baseline) !== JSON.stringify(view.baseline);
  const locked = Boolean(pending) || view.busy;
  const draft = view.draft;
  const latestPlanEvent = view.events.find(
    (e) => e.kind === "ACCEPTED" || e.kind === "BASELINE",
  );
  const latestDecision =
    latestPlanEvent?.kind === "ACCEPTED"
      ? (latestPlanEvent.details as Record<string, unknown>)
      : null;
  async function run(operation: string, extra: Record<string, unknown> = {}) {
    if (inflight.current) return;
    if (
      operation === "SAVE_BASELINE" &&
      !baselineSchema.safeParse(baseline).success
    ) {
      setError(
        "Add your goal and check meal names, macro ranges and text lengths.",
      );
      return;
    }
    inflight.current = true;
    setPending(operation);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation, revision: view.revision, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed.");
      setView(data);
      setBaseline(data.baseline);
      setApplyPhase(false);
      if (operation === "DISCUSS") setMessage("");
      if (operation === "CHECK_IN")
        setReport({
          adherence: "UNKNOWN",
          hunger: "",
          energy: "",
          digestion: "",
          notes: "",
        });
      setNotice(
        operation === "ACCEPT"
          ? "Accepted. Your baseline and history are updated. Training plans remain available for their next review."
          : operation === "CHECK_IN"
            ? "Check-in saved. No AI review was requested."
            : "Saved.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Request failed. Reload to check the saved state before retrying.",
      );
    } finally {
      setPending("");
      inflight.current = false;
    }
  }
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            Current phase:{" "}
            <strong>{view.phase?.phase.toLowerCase() ?? "not set"}</strong>
            {view.phase ? ` · since ${view.phase.startDate}` : ""}
          </p>
          <Link className="text-sm text-orange-300 underline" href="/metrics">
            Phase & measurement history
          </Link>
        </div>
        {typeof latestDecision?.reviewDueOn === "string" && (
          <p className="mt-2 text-sm text-slate-300">
            Next outcome review: {latestDecision.reviewDueOn}. Open a review
            when ready; nothing runs automatically.
          </p>
        )}
        {view.scheduledPhases.length > 0 && (
          <p className="mt-2 text-sm text-amber-200">
            Scheduled:{" "}
            {view.scheduledPhases
              .map((p) => `${p.phase.toLowerCase()} on ${p.startDate}`)
              .join(", ")}
            . Accepting a phase today keeps these future entries.
          </p>
        )}
      </Card>
      <div aria-live="polite">
        {pending && (
          <p className="text-sm text-orange-200">
            {pending === "REVIEW"
              ? "Reviewing summarized outcomes…"
              : pending === "DISCUSS"
                ? "Discussing the saved review…"
                : "Saving…"}
          </p>
        )}
        {notice && <p className="text-sm text-emerald-300">{notice}</p>}
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}{" "}
            <button className="underline" onClick={() => location.reload()}>
              Reload saved state
            </button>
          </p>
        )}
        {view.busy && (
          <p className="text-sm text-amber-200">
            A coach request is running.{" "}
            <button className="underline" onClick={() => location.reload()}>
              Reload to check progress
            </button>
            . An abandoned request unlocks after five minutes.
          </p>
        )}
      </div>
      <Card>
        <fieldset disabled={locked} className="space-y-4">
          <legend className="mb-3 text-lg font-semibold">
            Your diet baseline
          </legend>
          <p className="text-sm text-slate-400">
            Describe your usual meals and portions. Macro estimates are
            optional; daily estimates can differ from meal totals. Blank means
            unknown. This is a reusable baseline, not a daily food log.
          </p>
          <Text
            label="Goal and desired phase direction"
            value={baseline.goal}
            onChange={(goal) => setBaseline({ ...baseline, goal })}
          />
          <Text
            label="Preferences, restrictions and practical constraints"
            max={1500}
            value={baseline.constraints}
            onChange={(constraints) =>
              setBaseline({ ...baseline, constraints })
            }
          />
          <Text
            label="Usual activity and training-day differences"
            max={800}
            value={baseline.activity}
            onChange={(activity) => setBaseline({ ...baseline, activity })}
          />
          <Macros
            label="Approximate daily macros"
            value={baseline.dailyMacros}
            onChange={(dailyMacros) =>
              setBaseline({ ...baseline, dailyMacros })
            }
          />
          {baseline.meals.map((meal, i) => (
            <div
              key={meal.id}
              className="space-y-3 rounded-xl border border-slate-700 p-3"
            >
              <Field
                label={`Meal ${i + 1}`}
                maxLength={80}
                value={meal.name}
                onChange={(e) =>
                  setBaseline({
                    ...baseline,
                    meals: baseline.meals.map((m) =>
                      m.id === meal.id ? { ...m, name: e.target.value } : m,
                    ),
                  })
                }
              />
              <Text
                label="Foods, portions and usual timing"
                max={1500}
                value={meal.foods}
                onChange={(foods) =>
                  setBaseline({
                    ...baseline,
                    meals: baseline.meals.map((m) =>
                      m.id === meal.id ? { ...m, foods } : m,
                    ),
                  })
                }
              />
              <Macros
                label="Approximate meal macros"
                value={meal.macros}
                onChange={(macros) =>
                  setBaseline({
                    ...baseline,
                    meals: baseline.meals.map((m) =>
                      m.id === meal.id ? { ...m, macros } : m,
                    ),
                  })
                }
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setBaseline({
                    ...baseline,
                    meals: baseline.meals.filter((m) => m.id !== meal.id),
                  })
                }
              >
                Remove meal
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={baseline.meals.length >= 10}
            onClick={() =>
              setBaseline({
                ...baseline,
                meals: [
                  ...baseline.meals,
                  {
                    id: crypto.randomUUID(),
                    name: `Meal ${baseline.meals.length + 1}`,
                    foods: "",
                    macros: { protein: null, carbs: null, fat: null },
                  },
                ],
              })
            }
          >
            Add meal
          </Button>
          {baseline.instructions.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-slate-400">
                Changes already incorporated in the macro estimates. Apply these
                to the original meal descriptions; do not add them again. You
                can consolidate them into the foods/portions above and remove
                the old instruction.
              </p>
              {baseline.instructions.map((v, i) => (
                <div className="flex items-start gap-2" key={i}>
                  <textarea
                    aria-label={`Applied instruction ${i + 1}`}
                    maxLength={800}
                    rows={2}
                    className={inputClass}
                    value={v}
                    onChange={(e) =>
                      setBaseline({
                        ...baseline,
                        instructions: baseline.instructions.map((s, j) =>
                          j === i ? e.target.value : s,
                        ),
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setBaseline({
                        ...baseline,
                        instructions: baseline.instructions.filter(
                          (_, j) => j !== i,
                        ),
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={view.saved && !dirty}
              onClick={() => run("SAVE_BASELINE", { baseline })}
            >
              Save baseline
            </Button>
            {dirty && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setBaseline(view.baseline)}
              >
                Discard edits
              </Button>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Saving uses no AI. Editing the baseline clears the pending proposal
            and preserves dated history.
          </p>
        </fieldset>
      </Card>
      {view.saved && (
        <>
          <Card>
            <fieldset disabled={locked || dirty} className="space-y-3">
              <legend className="mb-3 text-lg font-semibold">
                Quick outcome check-in
              </legend>
              <p className="text-sm text-slate-400">
                Report how the current plan is going. Weight, circumferences,
                recovery logs and accepted photo assessments come from your
                existing check-ins.
              </p>
              <label className="block text-sm">
                Implementation
                <select
                  className={`${inputClass} mt-2`}
                  value={report.adherence}
                  onChange={(e) =>
                    setReport({ ...report, adherence: e.target.value })
                  }
                >
                  <option value="UNKNOWN">Not reported</option>
                  <option value="MOSTLY">Mostly followed</option>
                  <option value="PARTLY">Partly followed</option>
                  <option value="NOT_YET">Not started yet</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(["hunger", "energy"] as const).map((k) => (
                  <Field
                    key={k}
                    label={`${k} (1 low–5 high)`}
                    type="number"
                    min={1}
                    max={5}
                    value={report[k]}
                    onChange={(e) =>
                      setReport({ ...report, [k]: e.target.value })
                    }
                  />
                ))}
              </div>
              <Text
                label="Digestion / meal tolerance"
                max={500}
                value={report.digestion}
                onChange={(digestion) => setReport({ ...report, digestion })}
              />
              <Text
                label="Implementation dates, changes, performance or other context"
                value={report.notes}
                onChange={(notes) => setReport({ ...report, notes })}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  run("CHECK_IN", {
                    report: {
                      ...report,
                      hunger: report.hunger ? Number(report.hunger) : null,
                      energy: report.energy ? Number(report.energy) : null,
                    },
                  })
                }
              >
                Save check-in · no AI
              </Button>
            </fieldset>
          </Card>
          <Card>
            <fieldset disabled={locked || dirty} className="space-y-4">
              <legend className="mb-3 text-lg font-semibold">
                Coach review
              </legend>
              <p className="text-sm text-slate-400">
                Outcome review reads summarized evidence from the last eight
                weeks, existing visual assessments and training-coach
                conclusions. Discussion reuses the saved review; it does not
                reload that history.
              </p>
              <Button
                type="button"
                onClick={() => run("REVIEW", message.trim() ? { message } : {})}
              >
                {draft ? "Refresh outcome review · AI" : "Review outcomes · AI"}
              </Button>
              {draft && (
                <>
                  <p className="text-xs text-slate-500">
                    Evidence reviewed{" "}
                    {new Date(draft.reviewedAt).toLocaleString()}
                  </p>
                  {view.evidenceChanged && (
                    <p className="rounded-xl bg-amber-950/40 p-3 text-sm text-amber-200">
                      Evidence changed or this review is more than 14 days old.
                      Discussion still uses this saved review. Refresh the
                      outcome review before accepting.
                    </p>
                  )}
                  <p className="whitespace-pre-wrap">
                    {draft.proposal.assessment}
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
                    {draft.proposal.evidence.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                  {draft.proposal.uncertainties.length > 0 && (
                    <p className="text-sm text-slate-400">
                      Uncertainty: {draft.proposal.uncertainties.join(" ")}
                    </p>
                  )}
                  <h3 className="font-semibold">Proposed adjustments</h3>
                  {draft.proposal.changes.length === 0 && (
                    <p className="text-sm">Keep the current diet structure.</p>
                  )}
                  {draft.proposal.changes.map((c, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-700 p-3"
                    >
                      <p className="text-sm text-orange-200">
                        {baseline.meals.find((m) => m.id === c.mealId)?.name ??
                          "Across the day"}{" "}
                        · {deltas(c)}
                      </p>
                      <p className="mt-1">{c.instruction}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {c.rationale}
                      </p>
                    </div>
                  ))}
                  {draft.proposal.phase && (
                    <div className="rounded-xl border border-slate-700 p-3">
                      <p>
                        Consider {draft.proposal.phase.toLowerCase()}
                        {draft.proposal.suggestedPhaseWeeks
                          ? ` · initially ${draft.proposal.suggestedPhaseWeeks} weeks, reassess rather than automatically ending`
                          : ""}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {draft.proposal.phaseReason}
                      </p>
                      <label className="mt-3 flex items-start gap-3 text-sm">
                        <input
                          className="mt-1"
                          type="checkbox"
                          checked={applyPhase}
                          onChange={(e) => setApplyPhase(e.target.checked)}
                        />
                        Also apply this phase today (UTC). Existing future phase
                        entries remain scheduled.
                      </label>
                    </div>
                  )}
                  <p className="text-sm">
                    <strong>
                      Review after {draft.proposal.reviewAfterDays} days:
                    </strong>{" "}
                    {draft.proposal.reviewCriteria}
                  </p>
                  {draft.proposal.trainingHandoff && (
                    <p className="text-sm text-slate-300">
                      Training context: {draft.proposal.trainingHandoff}
                    </p>
                  )}
                  {draft.proposal.questions.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-orange-200">
                      {draft.proposal.questions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={view.evidenceChanged}
                      onClick={() => run("ACCEPT", { applyPhase })}
                    >
                      Accept{" "}
                      {applyPhase
                        ? "adjustments & phase"
                        : "diet adjustments only"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => run("DISMISS")}
                    >
                      Dismiss proposal
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Acceptance saves the proposal and review date without an AI
                    call. Without the checkbox, your current phase stays in
                    place.
                  </p>
                  <details>
                    <summary className="cursor-pointer text-sm text-slate-400">
                      Recent discussion
                    </summary>
                    <div className="mt-3 space-y-3">
                      {draft.messages.map((m, i) => (
                        <p className="whitespace-pre-wrap text-sm" key={i}>
                          <strong>
                            {m.role === "user" ? "You" : "Coach"}:
                          </strong>{" "}
                          {m.content}
                        </p>
                      ))}
                    </div>
                  </details>
                  <Text
                    label="Discuss or ask for a targeted adjustment"
                    max={2000}
                    value={message}
                    onChange={setMessage}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!message.trim()}
                    onClick={() => run("DISCUSS", { message })}
                  >
                    Send targeted follow-up · AI
                  </Button>
                </>
              )}
            </fieldset>
            {dirty && (
              <p className="mt-3 text-sm text-amber-200">
                Save or discard baseline edits before continuing.
              </p>
            )}
          </Card>
        </>
      )}
      {view.events.length > 0 && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Recent history</h2>
          <div className="space-y-3">
            {view.events.map((e) => {
              const d = e.details as Record<string, unknown>;
              const accepted = proposalSchema.safeParse(d.proposal);
              return (
                <details
                  key={e.id}
                  className="rounded-xl border border-slate-800 p-3"
                >
                  <summary className="cursor-pointer text-sm">
                    {new Date(e.createdAt).toLocaleString()} ·{" "}
                    {e.kind === "ACCEPTED"
                      ? "Review accepted"
                      : e.kind === "CHECK_IN"
                        ? "Outcome check-in"
                        : "Baseline saved"}
                    {typeof d.reviewDueOn === "string"
                      ? ` · review due ${d.reviewDueOn}`
                      : ""}
                  </summary>
                  <div className="mt-2 space-y-2 text-sm text-slate-400">
                    {[
                      "summary",
                      "reviewCriteria",
                      "adherence",
                      "digestion",
                      "notes",
                    ].map((k) =>
                      typeof d[k] === "string" && d[k] ? (
                        <p key={k}>
                          {k}: {String(d[k])}
                        </p>
                      ) : null,
                    )}
                    {accepted.success && (
                      <>
                        <p>{accepted.data.assessment}</p>
                        {accepted.data.changes.map((c, i) => (
                          <p key={i}>
                            {c.instruction} — {c.rationale}
                          </p>
                        ))}
                        {accepted.data.phase && (
                          <p>
                            Phase proposal: {accepted.data.phase.toLowerCase()}.{" "}
                            {accepted.data.phaseReason}
                          </p>
                        )}
                      </>
                    )}
                    {e.kind === "ACCEPTED" && (
                      <p>Phase applied: {d.phaseApplied ? "yes" : "no"}</p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
