import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { approveWeeklyCoachAction, generateWeeklyCoachAction, getWeeklyCoachView, markWeeklyOccurrenceMissedAction, replaceWeeklyPlanExerciseAction } from "@/lib/server/weekly-coach";

export const maxDuration = 300;

export default async function WeeklyCoachPage({ searchParams }: { searchParams: Promise<{ error?: string; approved?: string; reviewed?: string; redistributed?: string; exerciseUpdated?: string }> }) {
  const [view, query] = await Promise.all([getWeeklyCoachView(), searchParams]);
  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const monday = view ? new Date(`${view.weekStart}T00:00:00Z`) : new Date();
  return <div className="space-y-5">
    <Link href="/plan" className="text-sm font-semibold text-orange-300">← Plan</Link>
    <PageHeader title="Weekly coach" description="Review remaining sessions around this week's completed work. The coach runs only when you request it." />
    {query.error ? <Card className="border-rose-500/30 text-sm text-rose-200">{query.error}</Card> : null}
    {query.approved ? <Card className="border-emerald-500/30 text-sm text-emerald-200">Weekly plan approved. Start its scheduled workouts from the logger.</Card> : null}
    {query.redistributed ? <Card className="border-sky-500/30 text-sm text-sky-200">Missed work has been redistributed into compatible upcoming sessions where capacity allows.</Card> : null}
    {query.exerciseUpdated ? <Card className="border-emerald-500/30 text-sm text-emerald-200">Exercise updated in the weekly proposal. Review the revised week before approval.</Card> : null}
    {!view ? <Card>Activate a program to plan a week. <Link href="/programs" className="text-orange-300">Open programs</Link></Card> : <>
      <Card className="space-y-3">
        <h2 className="font-semibold text-slate-100">Week of {view.weekStart} · {view.program.name}</h2>
        <p className="text-sm text-slate-400">Existing templates give the coach a starting structure. Set your actual training availability and time limits. Exercise preferences, mesocycle priorities, recent workouts and metrics are read from the app.</p>
        {view.completedSessions.length ? <div className="text-sm text-slate-300"><p className="font-semibold text-slate-200">Already completed this week</p>
          {view.completedSessions.map((session) => <p key={session.id}>{session.date} · {view.templates.find((row) => row.id === session.templateId)?.name ?? "Workout"} · {session.physicalSets} physical / {session.effectiveSets.toFixed(1)} effective sets</p>)}
          <p className="mt-1 text-xs text-slate-400">These logged sets count toward the week&apos;s muscle doses. The coach plans only the dates you select below.</p>
        </div> : null}
        {!view.canGenerate ? <p className="text-sm text-amber-200">Finish the current draft or use the approved weekly plan to mark a missed workout. Started weekly occurrences remain fixed.</p> : (
          <form action={generateWeeklyCoachAction} className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {weekdays.map((name, index) => {
                const date = new Date(monday); date.setUTCDate(date.getUTCDate() + index);
                const isoDate = date.toISOString().slice(0, 10);
                const unavailable = isoDate < view.today || view.completedSessions.some((session) => session.date === isoDate);
                return <div key={name} className="rounded-xl border border-slate-800 bg-slate-950 p-2">
                  <label className="flex items-center gap-2 text-sm text-slate-200"><input name={`available:${index}`} type="checkbox" disabled={unavailable} defaultChecked={!unavailable && (index === 0 || index === 2 || index === 4)} />{name} · {date.toISOString().slice(5, 10)}{unavailable ? " · completed or past" : ""}</label>
                  <label className="mt-2 block text-xs text-slate-400">Minutes available<input name={`minutes:${index}`} type="number" min="20" max="120" defaultValue="60" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-100" /></label>
                </div>;
              })}
            </div>
            <label className="block text-sm text-slate-300">Other known constraints for this week
              <textarea name="constraints" maxLength={1000} rows={3} placeholder="Equipment unavailable, travel, sore joints, exercise preferences, unusually short sessions…" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-slate-100" />
            </label>
            <Button type="submit" pendingText="Planning the week…" variant="secondary">Review whole week with coach</Button>
          </form>
        )}
      </Card>
      {view.plan ? <Card className="space-y-4 border-orange-500/20">
        <div><p className="text-xs font-semibold uppercase text-orange-300">{view.status === "APPROVED" ? "Approved weekly plan" : "Coach proposal · needs your approval"}</p><p className="mt-1 text-sm text-slate-300">{view.plan.summary}</p></div>
        {view.proposalStale ? <p className="text-sm text-amber-200">Your logged workouts or available dates changed since this proposal. Run the review again before approval.</p> : null}
        {view.status === "PROPOSED" && view.exerciseIssues.length ? <p className="rounded-lg border border-amber-500/30 p-3 text-sm text-amber-100">
          {view.exerciseIssues.length} exercise {view.exerciseIssues.length === 1 ? "choice needs" : "choices need"} your decision. Exercises marked Avoid can be explicitly accepted; an unavailable exercise must be replaced before approval. The muscle estimates omit unavailable exercises until they are replaced.
        </p> : null}
        {view.allocated?.unallocatedSets ? <p className="rounded-lg border border-amber-500/30 p-2 text-xs text-amber-200">{view.allocated.unallocatedSets} physical sets from missed workouts could not fit into compatible remaining sessions.</p> : null}
        {view.muscleSummary.length ? <details className="rounded-xl border border-slate-800 p-3 text-xs text-slate-300"><summary className="cursor-pointer font-semibold">Planned effective work across the week</summary>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">{view.muscleSummary.map((row) => <p key={row.name}>{row.name} · {row.priority.toLowerCase().replaceAll("_", " ")} · {row.weekly} estimated effective sets this week · largest session {row.largestSession}</p>)}</div>
        </details> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {(view.allocated?.workouts ?? view.plan.workouts).map((day) => {
            const missed = view.missedIds.includes(day.id);
            const started = view.startedIds.includes(day.id);
            return <div key={day.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <h3 className="font-semibold text-slate-100">{day.date} · {view.templates.find((row) => row.id === day.templateId)?.name ?? "Workout"}</h3>
              <p className="text-xs text-slate-400">{day.durationMinutes} minutes · {day.items.reduce((sum, item) => sum + item.sets, 0)} physical sets · {missed ? "Missed" : started ? "Started" : "Planned"}</p>
              <p className="mt-1 text-xs text-slate-500">{day.rationale}</p>
              <ul className="mt-2 space-y-2 text-xs text-slate-300">{day.items.map((item) => {
                const issue = view.status === "PROPOSED" ? view.exerciseIssues.find((row) => row.occurrenceId === day.id && row.sourceSlotId === item.sourceSlotId) : null;
                return <li key={item.sourceSlotId} className={issue ? "rounded-lg border border-amber-500/30 p-2" : ""}>
                  {item.sets} × {view.exerciseNames[item.exerciseId] ?? `Unavailable exercise ${item.exerciseId}`} · {item.reason}
                  <p className="mt-1 text-slate-400">Set types: {item.setTypeIds.map((id) => view.setTypeNames[id] ?? "Unavailable type").join(" · ")}</p>
                  {issue ? <><p className="mt-1 text-amber-200">{issue.kind === "AVOID" ? "Marked Avoid in your coaching profile. You can accept it for this week or replace it." : "Inactive, archived, or absent from your exercise catalog. Choose a replacement before approval."}</p>
                    <form action={replaceWeeklyPlanExerciseAction} className="mt-2 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="planId" value={view.recordId ?? ""} /><input type="hidden" name="occurrenceId" value={day.id} />
                      <input type="hidden" name="sourceSlotId" value={item.sourceSlotId} />
                      <label className="text-slate-300">Replacement exercise
                        <select name="exerciseId" required className="mt-1 block max-w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-100">
                          <option value="">Select an active exercise</option>
                          {[...view.availableExercises].sort((a, b) => a.name.localeCompare(b.name)).map((exercise) =>
                            <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
                        </select>
                      </label>
                      <Button type="submit" pendingText="Updating…" variant="secondary">Replace</Button>
                    </form></> : null}
                </li>;
              })}</ul>
              {view.status === "APPROVED" && !missed && !started ? <form action={markWeeklyOccurrenceMissedAction} className="mt-2">
                <input type="hidden" name="planId" value={view.recordId ?? ""} /><input type="hidden" name="occurrenceId" value={day.id} />
                <Button type="submit" variant="ghost" pendingText="Redistributing…">Mark missed and redistribute</Button>
              </form> : null}
              {view.status === "APPROVED" && !missed && !started ? <Link href={`/log?programId=${view.program.id}&templateId=${day.templateId}&occurrenceId=${day.id}`} className="mt-1 inline-block text-xs font-semibold text-orange-300">Open planned workout →</Link> : null}
            </div>;
          })}
        </div>
        {view.status === "PROPOSED" && view.canGenerate && !view.proposalStale ? <form action={approveWeeklyCoachAction}>
          <input type="hidden" name="planId" value={view.recordId ?? ""} />
          {view.exerciseIssues.some((issue) => issue.kind === "AVOID") ? <label className="mb-3 flex items-center gap-2 text-sm text-amber-200">
            <input type="checkbox" name="acceptAvoided" required />I approve using the flagged Avoid exercise choices for this week.
          </label> : null}
          <Button type="submit" pendingText="Approving…" disabled={view.exerciseIssues.some((issue) => issue.kind === "UNAVAILABLE")}>Approve this week</Button>
        </form> : null}
      </Card> : null}
    </>}
  </div>;
}
