type DoseRow = { id: string; name: string; priority: string; doseReason: string | null;
  completed: number; remaining: number; weekly: number; target: number };

export function WeeklyDoseComparison({ rows, exerciseTotal, userEdited }: {
  rows: DoseRow[]; exerciseTotal: number; userEdited?: boolean;
}) {
  return <div className="rounded-xl border border-slate-800 p-3 text-sm text-slate-300">
          <p className="font-semibold">Weekly effective work · {exerciseTotal.toFixed(1)} exercise sets</p>
          <p className="text-xs text-slate-400">Completed actual work plus remaining planned work, including in-progress sessions until completion. Prescription is the current coaching dose, not a physiological limit. Muscle estimates include secondary contributions; their sum differs from exercise-set totals.</p>
          <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-xs"><thead><tr><th className="pr-3">Muscle / priority</th><th className="pr-3">Completed</th><th className="pr-3">Still planned</th><th className="pr-3">Week total</th><th className="pr-3">Prescription</th><th>Difference</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-slate-800"><td className="py-2">{row.name} · {row.priority.toLowerCase().replaceAll("_", " ")}{row.doseReason ? <p className="max-w-md text-slate-400">{row.doseReason}</p> : null}</td><td className="pr-3">{row.completed.toFixed(1)}</td><td className="pr-3">{row.remaining.toFixed(1)}</td><td className="pr-3">{row.weekly.toFixed(1)}</td><td className="pr-3">{row.target.toFixed(1)}</td><td className={row.weekly < row.target - .1 ? "text-amber-200" : "text-slate-300"}>{(row.weekly - row.target).toFixed(1)}{row.weekly < row.target - .1 ? <span className="block">Below prescription{!row.doseReason || userEdited ? " · review allocation" : ""}</span> : null}</td></tr>)}</tbody></table></div>
          {userEdited ? <p className="mt-2 text-xs text-orange-300">User-adjusted proposal. The original coach summary describes its original allocation; the totals above reflect your edits.</p> : null}
        </div>;
}
