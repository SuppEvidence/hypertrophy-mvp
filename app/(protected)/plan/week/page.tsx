import { WeeklyDoseComparison } from "@/components/weekly/WeeklyDoseComparison";
import { ReviewProgress } from "@/components/coaching/ReviewProgress";
import { WeeklySetEditor } from "@/components/weekly/WeeklySetEditor";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { approveWeeklyCoachAction, generateWeeklyCoachAction, getWeeklyCoachView, markWeeklyOccurrenceMissedAction, replaceWeeklyPlanExerciseAction } from "@/lib/server/weekly-coach";

export const maxDuration = 300;

export default async function WeeklyCoachPage({ searchParams }: { searchParams: Promise<{ week?: string; error?: string; approved?: string; reviewed?: string; redistributed?: string; setsUpdated?: string; exerciseUpdated?: string }> }) {
  const query = await searchParams;
  const view = await getWeeklyCoachView(query.week);
  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const monday = view ? new Date(`${view.weekStart}T00:00:00Z`) : new Date();
  return <div className="space-y-5">
    <Link href="/plan" className="text-sm font-semibold text-orange-300">← Plan</Link>
    <PageHeader title="Weekly coach" description="Plan the selected week around its completed work. Next week opens Sundays at 12:00 Helsinki time; the coach runs only when requested." />
    {query.error ? <Card className="border-rose-500/30 text-sm text-rose-200">{query.error}<p className="mt-2 text-xs">The review did not replace your saved plan. Retry using the availability and constraints below.</p></Card> : null}
    {query.reviewed ? <Card className="border-sky-500/30 text-sm text-sky-200"><p role="status">Review complete. Inspect the proposal and weekly dose before approving.</p></Card> : null}
    {query.approved ? <Card className="border-emerald-500/30 text-sm text-emerald-200">{view?.isUpcoming ? "Upcoming week approved. Its workouts become available in the logger on Monday." : "Weekly plan approved. Start its scheduled workouts from the logger."}</Card> : null}
    {query.redistributed ? <Card className="border-sky-500/30 text-sm text-sky-200">Missed work has been redistributed into compatible upcoming sessions where capacity allows.</Card> : null}
    {query.setsUpdated ? <Card className="border-emerald-500/30 text-sm text-emerald-200">Set allocation updated. Review the new weekly totals before approval.</Card> : null}
    {query.exerciseUpdated ? <Card className="border-emerald-500/30 text-sm text-emerald-200">Exercise updated in the weekly proposal. Review the revised week before approval.</Card> : null}
    {!view ? <Card>Activate a program to plan a week. <Link href="/programs" className="text-orange-300">Open programs</Link></Card> : <>
      <nav aria-label="Planning week" className="flex flex-wrap gap-2">
        <Link href={`/plan/week?week=${view.weekOptions.current}`} className={`rounded-xl border px-3 py-2 text-sm ${!view.isUpcoming ? "border-orange-500 text-orange-200" : "border-slate-700 text-slate-400"}`}>Current week · {view.weekOptions.current}</Link>
        {view.weekOptions.nextAvailable ? <Link href={`/plan/week?week=${view.weekOptions.next}`} className={`rounded-xl border px-3 py-2 text-sm ${view.isUpcoming ? "border-orange-500 text-orange-200" : "border-slate-700 text-slate-400"}`}>Upcoming week · {view.weekOptions.next}</Link> : <span className="self-center text-xs text-slate-500">Upcoming week opens Sunday at 12:00 Helsinki time.</span>}
      </nav>
      <Card className="space-y-3">
        <h2 className="font-semibold text-slate-100">Week of {view.weekStart} · {view.program.name}</h2>
        {view.isUpcoming ? <p className="text-sm text-sky-200">Planning ahead. This week&apos;s remaining workouts stay in the logger until Monday. Only work completed within the selected week counts toward its dose.</p> : null}
        <p className="text-sm text-slate-400">The coach preserves the established workout structure within this mesocycle, adjusting dose before changing exercises. Templates provide the starting framework when no approved week is available. Set your actual training availability and time limits. Exercise preferences, mesocycle priorities, recent workouts and metrics are read from the app.</p>
        {view.completedSessions.length ? <div className="text-sm text-slate-300"><p className="font-semibold text-slate-200">Already completed in this selected week</p>
          {view.completedSessions.map((session) => <p key={session.id}>{session.date} · {view.templates.find((row) => row.id === session.templateId)?.name ?? "Workout"} · {session.physicalSets} physical / {session.effectiveSets.toFixed(1)} effective sets</p>)}
          <p className="mt-1 text-xs text-slate-400">These logged sets count toward the week&apos;s muscle doses. The coach plans only the dates you select below.</p>
        </div> : null}
        {!view.canGenerate ? <p className="text-sm text-amber-200">Finish the current draft or use the approved weekly plan to mark a missed workout. Started weekly occurrences remain fixed.</p> : (
          <form action={generateWeeklyCoachAction} className="space-y-3">
            <input type="hidden" name="weekStart" value={view.weekStart} />
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
            <label className="block text-sm text-slate-300">Other known constraints for the selected week
              <textarea name="constraints" maxLength={1000} rows={3} placeholder="Equipment unavailable, travel, sore joints, exercise preferences, unusually short sessions…" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-slate-100" />
            </label>
            <Button type="submit" pendingText="Planning the week…" variant="secondary">{query.error ? "Retry weekly review" : "Review whole week with coach"}</Button>
            <ReviewProgress label="Planning the week…" />
          </form>
        )}
      </Card>
      {view.plan ? <Card className="space-y-4 border-orange-500/20">
        <div><p className="text-xs font-semibold uppercase text-orange-300">{view.status === "APPROVED" ? "Approved weekly plan" : "Coach proposal · needs your approval"}</p>{view.plan.summary ? <p className="mt-1 text-sm text-slate-300">{view.plan.summary}</p> : null}</div>
        <div className="rounded-lg border border-sky-900/50 p-3 text-xs text-slate-300">
          <p className="font-semibold text-sky-200">Plan source: {view.plan.lineage?.source === "CARRY_FORWARD" ? `Accepted/completed structure from ${view.plan.lineage.sourceWeek}` : view.plan.lineage?.source === "TEMPLATES" ? "Program templates, adapted by the weekly coach" : "Source not recorded for this older plan"}</p>
          {view.plan.lineage?.source === "CARRY_FORWARD" ? <p className="mt-1">{view.plan.lineage.changedWorkoutDates.length ? `At the coach review, revised: ${view.plan.lineage.changedWorkoutDates.join(", ")}. Other days retained the carried structure.` : "At review, the coach retained the carried workout structure."}</p> : null}
          {view.plan.userEdited ? <p className="mt-1">Includes your edits after the review.</p> : null}
          {view.missedIds.length ? <p className="mt-1">Missed-session redistribution is included in the remaining plan below.</p> : null}
        </div>
        {view.proposalStale ? <p className="text-sm text-amber-200">Your logged workouts or available dates changed since this proposal. These proposal totals use completed work from the review time. Run the review again before approval.</p> : null}
        {view.status === "PROPOSED" && view.exerciseIssues.length ? <p className="rounded-lg border border-amber-500/30 p-3 text-sm text-amber-100">
          {view.exerciseIssues.length} exercise {view.exerciseIssues.length === 1 ? "choice needs" : "choices need"} your decision. Exercises marked Avoid can be explicitly accepted; an unavailable exercise must be replaced before approval. The muscle estimates omit unavailable exercises until they are replaced.
        </p> : null}
        {view.allocated?.unallocatedSets ? <p className="rounded-lg border border-amber-500/30 p-2 text-xs text-amber-200">{view.allocated.unallocatedSets} physical sets from missed workouts could not fit into compatible remaining sessions.</p> : null}
        {view.priorityChecks.length ? <div className="rounded-xl border border-amber-500/30 p-3 text-sm text-amber-200">
          <p className="font-semibold">Allocation needs a look</p>
          <ul className="mt-2 space-y-2 text-xs">{view.priorityChecks.map((check) => <li key={`${check.muscleId}:${check.code}`}>{check.message}</li>)}</ul>
          <p className="mt-2 text-xs text-slate-400">These checks do not impose category set caps or block approval. Adjust the proposal below, or accept a tradeoff that fits your needs.</p>
        </div> : null}
        {view.plan.exerciseChanges?.length ? <div className="rounded-lg border border-slate-800 p-3 text-xs text-slate-300">
          <p className="font-semibold">Exercise changes from the established structure</p>
          {view.plan.exerciseChanges.filter((change) => view.plan?.workouts.some((day) => day.date === change.date && day.items.some((item) => item.exerciseId === change.toExerciseId))).map((change) => <p className="mt-1" key={`${change.date}:${change.sourceSlotId}`}>{change.date} · {view.exerciseNames[change.fromExerciseId] ?? "Previous exercise"} → {view.exerciseNames[change.toExerciseId] ?? "Replacement"}: {change.reason}</p>)}
        </div> : null}
        <WeeklyDoseComparison rows={view.muscleSummary} exerciseTotal={view.weekEffectiveTotal} userEdited={view.plan.userEdited} />
        <div className="grid gap-3 md:grid-cols-2">
          {(view.allocated?.workouts ?? view.plan.workouts).map((day) => {
            const missed = view.missedIds.includes(day.id);
            const started = view.startedIds.includes(day.id);
            return <div key={day.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <h3 className="font-semibold text-slate-100">{day.date} · {view.templates.find((row) => row.id === day.templateId)?.name ?? "Workout"}</h3>
              <p className="text-xs text-slate-400">{day.durationMinutes} minutes available · {day.items.reduce((sum, item) => sum + item.sets, 0)} physical sets · {missed ? "Missed" : view.completedIds.includes(day.id) ? "Completed" : started ? "Started" : "Planned"}</p>
              <p className={`mt-1 text-xs ${day.estimatedMinutes != null && day.estimatedMinutes > day.durationMinutes ? "text-amber-200" : "text-slate-400"}`}>
                {day.estimatedMinutes != null ? `Coach estimate: about ${Math.round(day.estimatedMinutes)} minutes${day.estimatedMinutes > day.durationMinutes ? " · exceeds available time; review the tradeoff before approval" : ""}` : "Time not estimated for this version of the workout."}
              </p>
              <p className="mt-1 text-xs text-slate-500">{day.rationale}</p>
              <ul className="mt-2 space-y-2 text-xs text-slate-300">{day.items.map((item) => {
                const issue = view.status === "PROPOSED" ? view.exerciseIssues.find((row) => row.occurrenceId === day.id && row.sourceSlotId === item.sourceSlotId) : null;
                return <li key={item.sourceSlotId} className={issue ? "rounded-lg border border-amber-500/30 p-2" : ""}>
                  {item.sets} × {view.exerciseNames[item.exerciseId] ?? `Unavailable exercise ${item.exerciseId}`} · {item.reason}
                  <p className="mt-1 text-slate-400">Set types: {item.setTypeIds.map((id) => view.setTypeNames[id] ?? "Unavailable type").join(" · ")}</p>
                  {view.status === "PROPOSED" && !view.proposalStale && issue?.kind !== "UNAVAILABLE" ? <WeeklySetEditor key={`${item.sourceSlotId}:${item.setTypeIds.join(",")}`} weekStart={view.weekStart} planId={view.recordId ?? ""} proposalVersion={view.proposalVersion} occurrenceId={day.id} sourceSlotId={item.sourceSlotId} setTypeIds={item.setTypeIds}
                    options={view.editSetTypes} /> : null}
                  {issue ? <><p className="mt-1 text-amber-200">{issue.kind === "AVOID" ? "Marked Avoid in your coaching profile. You can accept it for this week or replace it." : "Inactive, archived, or absent from your exercise catalog. Choose a replacement before approval."}</p>
                    <form action={replaceWeeklyPlanExerciseAction} className="mt-2 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="weekStart" value={view.weekStart} /><input type="hidden" name="planId" value={view.recordId ?? ""} /><input type="hidden" name="occurrenceId" value={day.id} />
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
                <input type="hidden" name="weekStart" value={view.weekStart} /><input type="hidden" name="planId" value={view.recordId ?? ""} /><input type="hidden" name="occurrenceId" value={day.id} />
                <Button type="submit" variant="ghost" pendingText="Redistributing…">Mark missed and redistribute</Button>
              </form> : null}
              {view.status === "APPROVED" && view.isUpcoming && !missed ? <p className="mt-2 text-xs text-sky-200">Available in the logger from Monday.</p> : null}
              {view.status === "APPROVED" && !view.isUpcoming && !missed && !started ? <Link href={`/log?programId=${view.program.id}&templateId=${day.templateId}&occurrenceId=${day.id}`} className="mt-1 inline-block text-xs font-semibold text-orange-300">Open planned workout →</Link> : null}
            </div>;
          })}
        </div>
        {view.status === "PROPOSED" && view.canGenerate && !view.proposalStale ? <form action={approveWeeklyCoachAction}>
          <input type="hidden" name="weekStart" value={view.weekStart} /><input type="hidden" name="planId" value={view.recordId ?? ""} />
          {view.exerciseIssues.some((issue) => issue.kind === "AVOID") ? <label className="mb-3 flex items-center gap-2 text-sm text-amber-200">
            <input type="checkbox" name="acceptAvoided" required />I approve using the flagged Avoid exercise choices for this week.
          </label> : null}
          <Button type="submit" pendingText="Approving…" disabled={view.exerciseIssues.some((issue) => issue.kind === "UNAVAILABLE")}>Approve this week</Button>
        </form> : null}
      </Card> : null}
    </>}
  </div>;
}
