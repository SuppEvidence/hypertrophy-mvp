"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { editWeeklyPlanSetsAction } from "@/lib/server/weekly-coach";

export function WeeklySetEditor(props: {
  planId: string; proposalVersion: string; occurrenceId: string; sourceSlotId: string; setTypeIds: string[];
  options: { id: string; name: string; multiplier: number }[];
}) {
  const [count, setCount] = useState(props.setTypeIds.length);
  const [types, setTypes] = useState(props.setTypeIds);
  const fallback = props.options.find((row) => row.multiplier === 1)?.id ?? props.options[0]?.id ?? "";
  const selected = Array.from({ length: count }, (_, i) => types[i] ?? fallback);
  const effective = selected.reduce((sum, id) => sum + (props.options.find((row) => row.id === id)?.multiplier ?? 0), 0);
  return <details className="mt-2 rounded-lg border border-slate-700 p-2">
    <summary className="cursor-pointer text-orange-300">Adjust sets / set types</summary>
    <form action={editWeeklyPlanSetsAction} className="mt-2 space-y-2">
      <input type="hidden" name="planId" value={props.planId} />
      <input type="hidden" name="proposalVersion" value={props.proposalVersion} />
      <input type="hidden" name="occurrenceId" value={props.occurrenceId} />
      <input type="hidden" name="sourceSlotId" value={props.sourceSlotId} />
      <label className="block">Sets (0 removes this exercise)
        <input name="sets" type="number" min={0} max={8} value={count} onChange={(event) => setCount(Math.min(8, Math.max(0, Number(event.target.value) || 0)))} className="ml-2 w-16 rounded border border-slate-700 bg-slate-900 p-1" />
      </label>
      {selected.map((id, i) => <label key={i} className="flex items-center gap-2">Set {i + 1}
        <select name={`setType:${i}`} value={id} onChange={(event) => setTypes(Array.from({ length: count }, (_, j) => j === i ? event.target.value : selected[j]))} className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 p-1">
          {props.options.map((option) => <option key={option.id} value={option.id}>{option.name} · {option.multiplier} effective</option>)}
        </select>
      </label>)}
      <p>{effective.toFixed(1)} effective exercise sets. Muscle totals update after saving.</p>
      <Button type="submit" pendingText="Saving adjustments…" variant="secondary">Save adjustment</Button>
    </form>
  </details>;
}
