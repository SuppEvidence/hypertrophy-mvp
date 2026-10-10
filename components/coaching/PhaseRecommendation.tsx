import Link from "next/link";
import { PhaseRecommendationSchema } from "@/lib/ai/phase-recommendation-schema";
import { getEnergyPhaseContext } from "@/lib/server/energy-phases";
import { requireUserId } from "@/lib/auth/user";

export async function PhaseRecommendation({ value }: { value: unknown }) {
  const parsed = PhaseRecommendationSchema.safeParse(value);
  if (!parsed.success) return null;
  const phase = await getEnergyPhaseContext(await requireUserId());
  const advice = parsed.data;
  if (phase?.phase !== "CUTTING" || phase.startDate !== advice.sourcePhaseStartDate) return null;
  return <aside className="mt-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-3">
    <p className="text-sm leading-6 text-slate-200">{advice.recommendation}</p>
    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-slate-400">
      {advice.evidence.map((item, index) => <li key={index}>{item}</li>)}
    </ul>
    <p className="mt-2 text-xs leading-5 text-slate-400">{advice.reassessWhen}</p>
    <Link href="/metrics" className="mt-2 inline-flex text-xs font-semibold text-orange-300">Review phase in Metrics</Link>
  </aside>;
}
