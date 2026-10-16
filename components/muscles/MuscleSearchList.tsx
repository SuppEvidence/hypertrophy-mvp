"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { muscleCatalog, muscleDefinition, normalizeMuscleName } from "@/lib/muscles/catalog";
const Search = createContext("");
export function MuscleSearchList({ children, className = "space-y-2" }: { children: ReactNode; className?: string }) {
  const [query, setQuery] = useState("");
  return <div className="space-y-3"><label className="block text-xs text-slate-400">Find a workload group or anatomical emphasis
    <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. quads, soleus, lateral delts" className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-base text-slate-100" />
  </label><p className="text-xs text-slate-500">Search hides other rows without changing their saved or selected values.</p>
    <Search.Provider value={normalizeMuscleName(query)}><div className={className}>{children}</div></Search.Provider>
  </div>;
}
export function MuscleSearchRow({ muscle, children }: { muscle: { name: string; slug?: string }; children: ReactNode }) {
  const query = useContext(Search); const definition = muscleDefinition(muscle);
  const related = definition ? muscleCatalog.filter(m => m.slug === definition.slug || m.accountingSlug === definition.slug) : [];
  const text = normalizeMuscleName([muscle.name, ...related.flatMap(m => [m.name, ...m.aliases])].join(" "));
  // Keep inputs mounted: filtered priorities must still be submitted with the form.
  return <div hidden={!text.includes(query)}>{children}</div>;
}
