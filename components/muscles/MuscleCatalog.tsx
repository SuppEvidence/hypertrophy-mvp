"use client";
import { useState } from "react";
import { accountingMuscle, muscleDefinition, normalizeMuscleName, type MuscleReference } from "@/lib/muscles/catalog";
export function MuscleCatalog({ muscles }: { muscles: MuscleReference[] }) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const regions = [...new Set(muscles.map(m => m.bodyRegion ?? muscleDefinition(m)?.bodyRegion ?? "Other"))];
  const filtered = muscles.filter(m => (!region || (m.bodyRegion ?? muscleDefinition(m)?.bodyRegion) === region) && normalizeMuscleName([m.name, ...(m.aliases ?? []), ...(muscleDefinition(m)?.aliases ?? [])].join(" ")).includes(normalizeMuscleName(query)));
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm text-slate-400">Search anatomy or common names<input type="search" value={query} onChange={e => setQuery(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-base text-slate-100" /></label><label className="text-sm text-slate-400">Body area<select value={region} onChange={e => setRegion(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-base text-slate-100"><option value="">All areas</option>{regions.map(r => <option key={r}>{r}</option>)}</select></label></div>
    <p className="text-xs text-slate-400">{filtered.length} references. Availability does not mean a muscle needs direct work or can be assessed from photos.</p>
    <div className="grid gap-3 md:grid-cols-2">{filtered.map(m => {
      const d = muscleDefinition(m); const group = accountingMuscle(m, muscles);
      return <article key={m.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3"><h2 className="font-semibold text-slate-100">{m.name}</h2>
        <p className="mt-1 text-xs text-slate-400">{d?.anatomyKind === "REGION" ? "Regional emphasis" : d?.anatomyKind === "MUSCLE" ? "Anatomical muscle" : "Muscle group"} · {m.bodyRegion ?? d?.bodyRegion ?? "Other"}</p>
        <p className="mt-2 text-sm text-slate-300">Workload group: {group?.name ?? "Needs classification"}</p>
        {!!(m.aliases ?? d?.aliases)?.length && <p className="mt-1 text-xs text-slate-500">Also known as: {(m.aliases ?? d?.aliases)?.join(", ")}</p>}
        <p className="mt-2 text-xs text-slate-500">{(m.visualAssessable ?? d?.visualAssessable) ? "Visible appearance may be reviewed when photo conditions support it." : "Exercise mechanics can inform targeting; independent development is not reliably assessed from check-in photos."}</p>
      </article>;
    })}</div>
    {!filtered.length && <p className="text-sm text-slate-400">No matching reference. Unmatched coach observations are retained for review.</p>}
  </div>;
}
