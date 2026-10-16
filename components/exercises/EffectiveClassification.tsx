import { readClassification } from "@/lib/coaching/exercise-classification";
import { Card } from "@/components/ui/Card";
export function EffectiveClassification({ value, basis, muscles, primary, secondary, pending }: {
  value: unknown; basis: string; muscles: Array<{id:string;name:string}>;
  primary: Array<{muscleId:string}>; secondary: Array<{muscleId:string;contributionEstimate?:unknown;estimateSource?:string}>; pending: boolean;
}) {
  const stored = readClassification(value); const active = stored?.basis === basis ? stored : null;
  const name = (id:string) => muscles.find(m=>m.id===id)?.name ?? "Reference needs review";
  const indirect = active?.secondary ?? secondary;
  return <Card><div className="space-y-3 text-sm text-slate-300"><h2 className="font-semibold text-slate-100">Exercise information used by the app</h2>
    <p className="text-xs text-orange-300">{active?.source === "COACH" ? "Source: accepted Exercise Coach profile" : pending ? "Source: fallback classification · saved profile conversion pending" : "Source: fallback classification"}</p>
    <p><strong>Primary workload groups:</strong> {(active?.primary ?? primary).map(m=>name(m.muscleId)).join(", ") || "None classified"}</p>
    <p><strong>Secondary workload groups:</strong> {indirect.map(m=>`${name(m.muscleId)} (${m.contributionEstimate == null ? "contribution unknown" : `${Number(m.contributionEstimate)} equivalent sets per direct set${m.estimateSource === "LEGACY" ? "; retained earlier estimate" : ""}`})`).join(", ") || "None classified"}</p>
    {active?.issues.map((issue,i)=><p key={i} className="text-xs text-amber-300">{issue}</p>)}
    <p className="text-xs text-slate-400">Detailed emphasis and execution come from the accepted profile below. Workload groups avoid counting the same anatomical target twice. Existing workouts retain their recorded classification.</p>
  </div></Card>;
}
