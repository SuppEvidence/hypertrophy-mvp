"use client";
import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import {
  type DesignBrief,
  type DesignReferences,
  type MesocycleDesign,
} from "@/lib/mesocycle-design/schema";
import { validateDesign } from "@/lib/mesocycle-design/validation";
import type { getDesignView } from "@/lib/server/mesocycle-design";
type View = Awaited<ReturnType<typeof getDesignView>>;
const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const priorities = ["SPECIALIZE", "GROW", "MAINTAIN", "INDIRECT_ONLY"] as const;
const labels = {
  SPECIALIZE: "High focus",
  GROW: "Grow",
  MAINTAIN: "Maintain",
  INDIRECT_ONLY: "No direct focus",
};
const field =
  "w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-slate-100";
const button =
  "rounded-lg border border-orange-500/40 px-3 py-2 text-sm text-orange-200 disabled:opacity-40";
export function MesocycleDesigner({
  initial,
  refs,
  suggestions,
  today,
  defaultGoal,
}: {
  initial: View | null;
  refs: DesignReferences;
  suggestions: Array<{
    muscleId: string;
    rationale: string;
    confidence: string;
    date: string;
  }>;
  today: string;
  defaultGoal: string;
}) {
  const [view, setView] = useState(initial);
  const [brief, setBrief] = useState<DesignBrief>(
    initial?.brief ?? {
      startDate: today,
      energyPhase: "USE_CURRENT",
      daysPerWeek: 4,
      minutesPerSession: 60,
      availableWeekdays: [],
      goals: defaultGoal,
      restrictions: "",
      excludedExerciseIds: [],
      priorities: [],
    },
  );
  const [plan, setPlan] = useState<MesocycleDesign | null>(
    initial?.proposal ?? null,
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ack, setAck] = useState(false);
  const [activate, setActivate] = useState(false);
  const closed = view?.status === "APPROVED" || view?.status === "ARCHIVED";
  const disabled = busy || closed || view?.busy;
  const groups = refs.muscles.filter(
    (m) => !m.accountingSlug && m.slug !== "chest",
  );
  const muscleName = (id: string) =>
    refs.muscles.find((m) => m.id === id)?.name ?? "Unknown muscle";
  const checks = plan ? validateDesign(plan, brief, refs) : null;
  function edit(next: MesocycleDesign) {
    setPlan(next);
    setAck(false);
    setNotice("Unsaved changes");
  }
  function editBrief(next: DesignBrief) {
    setBrief(next);
    setAck(false);
    setNotice("Unsaved changes");
  }
  async function request(body: Record<string, unknown>): Promise<View> {
    const response = await fetch("/api/mesocycle-design", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Request failed.");
    return result;
  }
  async function act(operation: "SAVE" | "GENERATE" | "APPROVE" | "ARCHIVE") {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice(
      operation === "GENERATE"
        ? "Coach is reviewing your brief and history…"
        : "Saving…",
    );
    try {
      let saved = view;
      if (!saved) {
        saved = await request({ operation: "CREATE", brief });
        setView(saved);
        window.history.replaceState(null, "", `/plan/blocks?tab=next&id=${saved.id}`);
      }
      if (operation !== "ARCHIVE")
        saved = await request({
          operation: "SAVE",
          id: saved.id,
          revision: saved.revision,
          brief,
          proposal: plan,
        });
      setView(saved);
      window.history.replaceState(null, "", `/plan/blocks?tab=next&id=${saved.id}`);
      if (operation !== "SAVE")
        saved = await request({
          operation,
          id: saved.id,
          revision: saved.revision,
          message,
          acknowledgeWarnings: ack,
          activate,
        });
      setView(saved);
      setBrief(saved.brief);
      setPlan(saved.proposal);
      if (operation === "GENERATE") setMessage("");
      setAck(false);
      setNotice(
        operation === "APPROVE"
          ? "Program and mesocycle saved. Approval used no AI request."
          : operation === "GENERATE"
            ? "Proposal ready for review."
            : "Draft saved. No AI request used.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
      setNotice("");
    } finally {
      setBusy(false);
    }
  }
  function itemEdit(
    dayIndex: number,
    itemIndex: number,
    patch: Partial<MesocycleDesign["sessions"][number]["items"][number]>,
  ) {
    if (!plan) return;
    edit({
      ...plan,
      sessions: plan.sessions.map((d, i) =>
        i === dayIndex
          ? {
              ...d,
              items: d.items.map((item, j) =>
                j === itemIndex ? { ...item, ...patch } : item,
              ),
            }
          : d,
      ),
    });
  }
  function acceptFocus(id: string) {
    const m = refs.muscles.find((m) => m.id === id);
    const group = m?.accountingSlug
      ? groups.find((g) => g.slug === m.accountingSlug)
      : m;
    if (!group) return;
    editBrief({
      ...brief,
      priorities: [
        ...brief.priorities.filter((p) => p.muscleId !== group.id),
        { muscleId: group.id, priority: "GROW" },
      ],
    });
  }
  const basic = refs.setTypes.find(
    (t) =>
      !t.isIntensifier && t.multiplier === 1 && !/edt|density/i.test(t.name),
  );
  return (
    <div className="space-y-5">
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-500 p-3 text-rose-200"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-orange-200">
          {notice}
        </p>
      )}
      {view?.busy && (
        <p className="text-sm text-amber-200">
          A request is running. Reload after it finishes; interrupted requests
          expire after five minutes.
        </p>
      )}
      {closed && (
        <Card>
          <p>
            {view?.status === "APPROVED"
              ? "Approved program saved. The accepted goals and baseline are available to the weekly, volume and workout coaches."
              : "Draft archived."}
          </p>
          {view?.approvedProgramId && (
            <Link
              className="text-orange-300 underline"
              href={`/programs/${view.approvedProgramId}`}
            >
              Open program settings and activation
            </Link>
          )}
          <p className="mt-2 text-sm text-slate-400">
            Programs saved for a future start remain inactive until you activate
            them from Programs.
          </p>
        </Card>
      )}
      <fieldset disabled={!!disabled} className="space-y-5 disabled:opacity-70">
        <Card>
          <div className="space-y-4">
            <h2 className="font-semibold">Your mesocycle brief</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <label>
                Start date
                <input
                  aria-label="Start date"
                  type="date"
                  min={today}
                  className={field}
                  value={brief.startDate}
                  onChange={(e) =>
                    editBrief({ ...brief, startDate: e.target.value })
                  }
                />
              </label>
              <label>
                Training days / week
                <input
                  type="number"
                  min={1}
                  max={7}
                  className={field}
                  value={brief.daysPerWeek}
                  onChange={(e) =>
                    editBrief({ ...brief, daysPerWeek: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Minutes / session
                <input
                  type="number"
                  min={20}
                  max={120}
                  className={field}
                  value={brief.minutesPerSession}
                  onChange={(e) =>
                    editBrief({
                      ...brief,
                      minutesPerSession: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            <div>
              <p className="text-sm text-slate-400">
                Available weekdays (leave empty for the coach to suggest a
                schedule)
              </p>
              <div className="flex flex-wrap gap-3">
                {days.map((day, i) => (
                  <label key={day} className="text-sm">
                    <input
                      type="checkbox"
                      checked={brief.availableWeekdays.includes(i)}
                      onChange={(e) =>
                        editBrief({
                          ...brief,
                          availableWeekdays: e.target.checked
                            ? [...brief.availableWeekdays, i]
                            : brief.availableWeekdays.filter((d) => d !== i),
                        })
                      }
                    />{" "}
                    {day.slice(0, 3)}
                  </label>
                ))}
              </div>
            </div>
            <label className="block">
              Intended energy phase
              <select
                className={field}
                value={brief.energyPhase}
                onChange={(e) =>
                  editBrief({
                    ...brief,
                    energyPhase: e.target.value as DesignBrief["energyPhase"],
                  })
                }
              >
                <option value="USE_CURRENT">
                  Use my current declared phase
                </option>
                <option value="CUTTING">Cutting</option>
                <option value="MAINTAINING">Maintaining</option>
                <option value="GAINING">Gaining</option>
              </select>
              <span className="text-xs text-slate-400">
                Planning intent only. Record actual phase changes in Metrics
                when they begin.
              </span>
            </label>
            <label className="block">
              Goals
              <textarea
                className={field}
                maxLength={1600}
                value={brief.goals}
                onChange={(e) => editBrief({ ...brief, goals: e.target.value })}
              />
            </label>
            <label className="block">
              Restrictions, equipment, pain concerns and preferences
              <textarea
                className={field}
                maxLength={1600}
                value={brief.restrictions}
                onChange={(e) =>
                  editBrief({ ...brief, restrictions: e.target.value })
                }
              />
            </label>
            {suggestions.length > 0 && (
              <details>
                <summary className="cursor-pointer text-orange-300">
                  Photo check-in suggestions — choose what to pursue
                </summary>
                <div className="space-y-3 pt-3">
                  {suggestions.map((p, i) => (
                    <div key={i} className="text-sm">
                      <strong>{muscleName(p.muscleId)}</strong> · {p.date} ·{" "}
                      {p.confidence.toLowerCase()} confidence
                      <p>{p.rationale}</p>
                      <button
                        type="button"
                        className={button}
                        onClick={() => acceptFocus(p.muscleId)}
                      >
                        Add as a confirmed growth priority
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}
            <details>
              <summary className="cursor-pointer">
                Confirmed priorities ({brief.priorities.length})
              </summary>
              <p className="text-xs text-slate-400">
                Unspecified priorities are proposals for your approval. No
                direct focus still permits indirect work.
              </p>
              <div className="grid gap-2 pt-3 sm:grid-cols-2">
                {groups.map((m) => (
                  <label key={m.id} className="text-sm">
                    {m.name}
                    <select
                      className={field}
                      value={
                        brief.priorities.find((p) => p.muscleId === m.id)
                          ?.priority ?? ""
                      }
                      onChange={(e) =>
                        editBrief({
                          ...brief,
                          priorities: [
                            ...brief.priorities.filter(
                              (p) => p.muscleId !== m.id,
                            ),
                            ...(e.target.value
                              ? [
                                  {
                                    muscleId: m.id,
                                    priority: e.target
                                      .value as DesignBrief["priorities"][number]["priority"],
                                  },
                                ]
                              : []),
                          ],
                        })
                      }
                    >
                      <option value="">Coach proposes</option>
                      {priorities.map((p) => (
                        <option key={p} value={p}>
                          {labels[p]}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </details>
            <details>
              <summary className="cursor-pointer">
                Exclude exercises for this block
              </summary>
              <div className="grid max-h-64 gap-2 overflow-y-auto pt-3 sm:grid-cols-2">
                {refs.exercises.map((e) => (
                  <label className="text-sm" key={e.id}>
                    <input
                      type="checkbox"
                      checked={brief.excludedExerciseIds.includes(e.id)}
                      onChange={(v) =>
                        editBrief({
                          ...brief,
                          excludedExerciseIds: v.target.checked
                            ? [...brief.excludedExerciseIds, e.id]
                            : brief.excludedExerciseIds.filter(
                                (id) => id !== e.id,
                              ),
                        })
                      }
                    />{" "}
                    {e.name}
                  </label>
                ))}
              </div>
            </details>
          </div>
        </Card>
        {plan && (
          <>
            <Card>
              <div className="space-y-3">
                <h2 className="font-semibold">Proposed mesocycle</h2>
                <p className="text-sm text-slate-300">{plan.summary}</p>
                <label className="block">
                  Program name
                  <input
                    className={field}
                    value={plan.name}
                    onChange={(e) => edit({ ...plan, name: e.target.value })}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label>
                    Length (weeks)
                    <input
                      type="number"
                      min={2}
                      max={16}
                      className={field}
                      value={plan.lengthWeeks}
                      onChange={(e) =>
                        edit({ ...plan, lengthWeeks: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Review after (weeks)
                    <input
                      type="number"
                      min={1}
                      max={plan.lengthWeeks}
                      className={field}
                      value={plan.reviewAfterWeeks}
                      onChange={(e) =>
                        edit({
                          ...plan,
                          reviewAfterWeeks: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Training phase
                    <select
                      className={field}
                      value={plan.phase}
                      onChange={(e) =>
                        edit({
                          ...plan,
                          phase: e.target.value as MesocycleDesign["phase"],
                        })
                      }
                    >
                      {["PUSH", "HOLD", "DELOAD"].map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="text-sm">{plan.durationReason}</p>
                <p className="text-sm">{plan.structureReason}</p>
                {view?.userEdited && (
                  <p className="text-sm text-amber-200">
                    Manually edited since the last coach response. Review the
                    rationale against your edits, or send the changes for a new
                    coach review.
                  </p>
                )}
                <label className="block">
                  Progression
                  <textarea
                    className={field}
                    value={plan.progression}
                    onChange={(e) =>
                      edit({ ...plan, progression: e.target.value })
                    }
                  />
                </label>
                <label className="block">
                  Success criteria (one per line)
                  <textarea
                    className={field}
                    value={plan.successCriteria.join("\n")}
                    onChange={(e) =>
                      edit({
                        ...plan,
                        successCriteria: e.target.value
                          .split("\n")
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
                <label className="block">
                  Reasons to adjust or change duration (one per line)
                  <textarea
                    className={field}
                    value={plan.adjustmentCriteria.join("\n")}
                    onChange={(e) =>
                      edit({
                        ...plan,
                        adjustmentCriteria: e.target.value
                          .split("\n")
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
                <details>
                  <summary>Proposed priorities and spacing</summary>
                  <div className="space-y-3 pt-3">
                    {plan.priorities.map((p, i) => (
                      <label className="block text-sm" key={p.muscleId}>
                        {muscleName(p.muscleId)}
                        <select
                          className={field}
                          value={p.priority}
                          onChange={(e) =>
                            edit({
                              ...plan,
                              priorities: plan.priorities.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      priority: e.target
                                        .value as typeof p.priority,
                                    }
                                  : x,
                              ),
                            })
                          }
                        >
                          {priorities.map((v) => (
                            <option key={v} value={v}>
                              {labels[v]}
                            </option>
                          ))}
                        </select>
                        <span className="text-slate-400">{p.rationale}</span>
                      </label>
                    ))}
                    {plan.spacing.map((s, i) => (
                      <label key={i} className="block text-sm">
                        {muscleName(s.muscleId)} · preferred gap in days
                        <input
                          className={field}
                          type="number"
                          min={1}
                          max={7}
                          value={s.preferredGapDays}
                          onChange={(e) =>
                            edit({
                              ...plan,
                              spacing: plan.spacing.map((v, j) =>
                                j === i
                                  ? {
                                      ...v,
                                      preferredGapDays: Number(e.target.value),
                                    }
                                  : v,
                              ),
                            })
                          }
                        />
                        {s.reason}
                      </label>
                    ))}
                  </div>
                </details>
              </div>
            </Card>
            {plan.sessions.map((day, di) => (
              <Card key={day.key}>
                <details open={di === 0}>
                  <summary className="cursor-pointer font-semibold">
                    {day.name} · {days[day.weekday]} · {day.items.length}{" "}
                    exercises
                  </summary>
                  <div className="mt-3 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label>
                        Session name
                        <input
                          className={field}
                          value={day.name}
                          onChange={(e) =>
                            edit({
                              ...plan,
                              sessions: plan.sessions.map((d, i) =>
                                i === di ? { ...d, name: e.target.value } : d,
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        Weekday
                        <select
                          className={field}
                          value={day.weekday}
                          onChange={(e) =>
                            edit({
                              ...plan,
                              sessions: plan.sessions.map((d, i) =>
                                i === di
                                  ? { ...d, weekday: Number(e.target.value) }
                                  : d,
                              ),
                            })
                          }
                        >
                          {days.map((d, i) => (
                            <option key={d} value={i}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <p className="text-sm text-slate-400">{day.rationale}</p>
                    {day.items.map((item, ii) => (
                      <div
                        className="space-y-2 rounded-xl border border-slate-700 p-3"
                        key={item.key}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold">
                            {ii + 1}. {item.purpose}
                          </p>
                          <label className="text-xs">
                            <input
                              type="checkbox"
                              checked={item.locked}
                              onChange={(e) =>
                                itemEdit(di, ii, { locked: e.target.checked })
                              }
                            />{" "}
                            Keep this item during coach revisions
                          </label>
                        </div>
                        <label className="block text-sm">
                          Exercise
                          <select
                            className={field}
                            value={item.exerciseId ?? ""}
                            onChange={(e) =>
                              itemEdit(di, ii, {
                                exerciseId: e.target.value || null,
                              })
                            }
                          >
                            <option value="">
                              Unresolved — choose from library
                            </option>
                            {refs.exercises.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.name}
                                {e.preference === "AVOID" ? " (Avoid)" : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                          {(
                            [
                              ["Sets", "sets", 1, 12],
                              ["Min reps", "minReps", 1, 50],
                              ["Max reps", "maxReps", 1, 50],
                              ["RIR", "rir", 0, 5],
                              ["Rest (sec)", "restSeconds", 30, 360],
                            ] as const
                          ).map(([label, key, min, max]) => (
                            <label className="text-xs" key={key}>
                              {label}
                              <input
                                className={field}
                                type="number"
                                min={min}
                                max={max}
                                step={key === "rir" ? 0.5 : 1}
                                value={item[key]}
                                onChange={(e) =>
                                  itemEdit(di, ii, {
                                    [key]: Number(e.target.value),
                                  })
                                }
                              />
                            </label>
                          ))}
                        </div>
                        <label className="block text-sm">
                          Set format
                          <select
                            className={field}
                            value={item.setTypeId ?? ""}
                            onChange={(e) =>
                              itemEdit(di, ii, {
                                setTypeId: e.target.value || null,
                              })
                            }
                          >
                            <option value="">Select format</option>
                            {refs.setTypes.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <p className="text-xs text-slate-400">
                          {item.rationale}
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className={button}
                            disabled={ii === 0}
                            onClick={() => {
                              const items = [...day.items];
                              [items[ii - 1], items[ii]] = [
                                items[ii],
                                items[ii - 1],
                              ];
                              edit({
                                ...plan,
                                sessions: plan.sessions.map((d, i) =>
                                  i === di ? { ...d, items } : d,
                                ),
                              });
                            }}
                          >
                            Move up
                          </button>
                          <button
                            type="button"
                            className={button}
                            onClick={() =>
                              edit({
                                ...plan,
                                sessions: plan.sessions.map((d, i) =>
                                  i === di
                                    ? {
                                        ...d,
                                        items: d.items.filter(
                                          (_, j) => j !== ii,
                                        ),
                                      }
                                    : d,
                                ),
                              })
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      className={button}
                      disabled={day.items.length >= 12}
                      onClick={() =>
                        edit({
                          ...plan,
                          sessions: plan.sessions.map((d, i) =>
                            i === di
                              ? {
                                  ...d,
                                  items: [
                                    ...d.items,
                                    {
                                      key: crypto.randomUUID(),
                                      exerciseId: null,
                                      purpose: "Additional exercise",
                                      sets: 2,
                                      minReps: 8,
                                      maxReps: 12,
                                      rir: 2,
                                      restSeconds: 120,
                                      setTypeId: basic?.id ?? null,
                                      slotRole: "ISOLATION",
                                      locked: false,
                                      rationale: "User added.",
                                    },
                                  ],
                                }
                              : d,
                          ),
                        })
                      }
                    >
                      Add exercise slot
                    </button>
                    <button
                      type="button"
                      className={`${button} ml-2`}
                      onClick={() =>
                        edit({
                          ...plan,
                          sessions: plan.sessions.filter((_, i) => i !== di),
                        })
                      }
                    >
                      Remove session
                    </button>
                  </div>
                </details>
              </Card>
            ))}
            <button
              type="button"
              className={button}
              disabled={plan.sessions.length >= 7}
              onClick={() =>
                edit({
                  ...plan,
                  sessions: [
                    ...plan.sessions,
                    {
                      key: crypto.randomUUID(),
                      name: "New session",
                      weekday: days.findIndex(
                        (_, i) => !plan.sessions.some((d) => d.weekday === i),
                      ),
                      rationale: "User added; ask the coach to populate it.",
                      items: [],
                    },
                  ],
                })
              }
            >
              Add session
            </button>
            {plan.libraryGaps.length > 0 && (
              <Card>
                <h2 className="font-semibold">Exercise library coverage</h2>
                {plan.libraryGaps.map((g, i) => (
                  <div className="mt-3 text-sm" key={i}>
                    <strong>
                      {muscleName(g.muscleId)} ·{" "}
                      {g.kind.replaceAll("_", " ").toLowerCase()}
                    </strong>
                    <p>{g.reason}</p>
                    {g.candidates.map((c, j) => (
                      <p key={j}>
                        {c.name} — {c.equipment}
                      </p>
                    ))}
                  </div>
                ))}
                <p className="mt-3 text-sm text-slate-400">
                  Confirm equipment availability, add the exercise manually and
                  assess it with Exercise Coach. Save this draft before
                  reloading the library.
                </p>
                <Link
                  href="/exercises"
                  target="_blank"
                  className="text-orange-300 underline"
                >
                  Open exercise library
                </Link>
                <button
                  type="button"
                  className={`${button} ml-2`}
                  onClick={() => window.location.reload()}
                >
                  Reload saved draft and library
                </button>
              </Card>
            )}
            {checks && (
              <Card>
                <h2 className="font-semibold">Feasibility review</h2>
                <div className="mt-2 space-y-1 text-sm">
                  {checks.sessions.map((s, i) => (
                    <p key={i}>
                      {days[s.weekday]} · {s.name}: {s.physicalSets} sets,
                      approximately {s.minutes} minutes
                    </p>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Duration includes a warm-up allowance, transitions, work and
                  rest. It is an estimate; extended sets and equipment queues
                  may take longer.
                </p>
                {plan.constraintChecks.map((c, i) => (
                  <p key={`constraint-${i}`} className="mt-2 text-sm">
                    {c.constraint}: {c.handling} ({c.status.toLowerCase()})
                  </p>
                ))}
                {checks.errors.map((e, i) => (
                  <p className="mt-2 text-sm text-rose-300" key={i}>
                    {e}
                  </p>
                ))}
                {checks.warnings.map((w, i) => (
                  <p className="mt-2 text-sm text-amber-200" key={i}>
                    {w}
                  </p>
                ))}
                <details className="mt-3">
                  <summary>Weekly workload estimate</summary>
                  {Object.entries(checks.dose).map(([id, n]) => (
                    <p className="text-sm" key={id}>
                      {muscleName(id)}: {n.toFixed(1)} effective sets
                    </p>
                  ))}
                </details>
                {plan.limitations.map((l, i) => (
                  <p className="mt-2 text-sm text-slate-400" key={i}>
                    {l}
                  </p>
                ))}
                {checks.warnings.length > 0 && (
                  <label className="mt-3 block text-sm">
                    <input
                      type="checkbox"
                      checked={ack}
                      onChange={(e) => setAck(e.target.checked)}
                    />{" "}
                    I reviewed these feasibility tradeoffs and accept them.
                  </label>
                )}
                <label className="mt-3 block text-sm">
                  <input
                    type="checkbox"
                    checked={activate}
                    disabled={brief.startDate > today}
                    onChange={(e) => setActivate(e.target.checked)}
                  />{" "}
                  Activate this program now (available for a start today).
                </label>
                <button
                  type="button"
                  className={`${button} mt-3`}
                  disabled={
                    checks.errors.length > 0 ||
                    (checks.warnings.length > 0 && !ack)
                  }
                  onClick={() => void act("APPROVE")}
                >
                  Approve program and mesocycle
                </button>
              </Card>
            )}
          </>
        )}
        <Card>
          <div className="space-y-3">
            <h2 className="font-semibold">Discuss with the coach</h2>
            {plan?.changes.map((c, i) => (
              <p className="text-sm text-slate-300" key={i}>
                {c}
              </p>
            ))}
            {plan?.questions.map((q, i) => (
              <p className="text-sm text-orange-200" key={i}>
                {q}
              </p>
            ))}
            {(view?.messages.length ?? 0) > 0 && (
              <details>
                <summary>Saved discussion</summary>
                {view?.messages.map((m, i) => (
                  <p key={i} className="mt-3 whitespace-pre-wrap text-sm">
                    <strong>{m.role === "user" ? "You" : "Coach"}:</strong>{" "}
                    {m.content}
                  </p>
                ))}
              </details>
            )}
            <label className="block text-sm">
              Answers or requested changes
              <textarea
                className={field}
                rows={4}
                maxLength={2000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="For example: Keep Wednesday shorter and retain the exercises I locked."
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className={button}
                onClick={() => void act("GENERATE")}
              >
                {busy
                  ? "Working…"
                  : plan
                    ? "Send and revise proposal"
                    : "Build my mesocycle proposal"}
              </button>
              <button
                type="button"
                className={button}
                onClick={() => void act("SAVE")}
              >
                Save edits without analysis
              </button>
              {view && (
                <button
                  type="button"
                  className={button}
                  onClick={() => void act("ARCHIVE")}
                >
                  Archive draft
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Only Build or Send requests AI coaching. Saving, editing, opening
              and approving do not. Approval creates a new program; your
              existing programs and workout history remain available.
            </p>
          </div>
        </Card>
      </fieldset>
    </div>
  );
}
