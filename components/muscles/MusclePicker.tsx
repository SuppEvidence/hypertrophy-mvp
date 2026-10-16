"use client";
import { useState } from "react";
import { muscleDefinition, normalizeMuscleName, type MuscleReference } from "@/lib/muscles/catalog";

export function MusclePicker({ muscles, name, selected, annotations = {} }: {
  muscles: MuscleReference[]; name: string; selected: string[]; annotations?: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState(() => new Set(selected));
  const groups = muscles.filter(m => !(m.accountingSlug ?? muscleDefinition(m)?.accountingSlug));
  const regions = [...new Set(groups.map(m => m.bodyRegion ?? muscleDefinition(m)?.bodyRegion ?? "Other"))];
  const matches = (m: MuscleReference) => {
    const details = muscles.filter(d => (d.accountingSlug ?? muscleDefinition(d)?.accountingSlug) === (m.slug ?? muscleDefinition(m)?.slug));
    return normalizeMuscleName([m.name, ...(m.aliases ?? []), ...(muscleDefinition(m)?.aliases ?? []), ...details.flatMap(d => [d.name, ...(d.aliases ?? []), ...(muscleDefinition(d)?.aliases ?? [])])].join(" ")).includes(normalizeMuscleName(query));
  };
  return <div className="space-y-3">
    <label className="block text-sm text-slate-400">Find a muscle or anatomical target
      <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. soleus, rear delt, forearm" className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-base text-slate-100" />
    </label>
    <p className="text-xs text-slate-500">{checked.size} selected. Detailed targets appear under their workload group; the Exercise Coach records the specific emphasis.</p>
    {/* Keep controls mounted while filtering so search cannot erase form selections. */}
    {regions.map(region => <fieldset key={region} hidden={!groups.some(m => (m.bodyRegion ?? muscleDefinition(m)?.bodyRegion ?? "Other") === region && matches(m))}>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{region}</legend>
      <div className="grid gap-2 md:grid-cols-2">{groups.filter(m => (m.bodyRegion ?? muscleDefinition(m)?.bodyRegion ?? "Other") === region).map(m => <label key={m.id} hidden={!matches(m)} className="min-h-11 rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200">
        <span className="flex items-center gap-3"><input type="checkbox" name={name} value={m.id} checked={checked.has(m.id)} onChange={e => setChecked(prev => { const next = new Set(prev); if (e.target.checked) next.add(m.id); else next.delete(m.id); return next; })} className="h-5 w-5" /><span>{m.name}{annotations[m.id]}</span></span>
      </label>)}</div>
    </fieldset>)}
    {!groups.some(matches) && <p className="text-sm text-slate-400">No matching workload group. Browse the muscle catalogue for anatomical references.</p>}
  </div>;
}
