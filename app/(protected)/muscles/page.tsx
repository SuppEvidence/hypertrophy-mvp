import Link from "next/link";
import { getExerciseReferenceData } from "@/lib/server/exercises";
import { MuscleCatalog } from "@/components/muscles/MuscleCatalog";
export default async function MusclesPage() {
  const { muscles } = await getExerciseReferenceData();
  return <div className="space-y-5"><Link href="/exercises" className="text-sm text-orange-300">Back to exercises</Link>
    <h1 className="text-2xl font-semibold text-slate-100">Shared muscle catalogue</h1>
    <p className="text-sm leading-6 text-slate-400">Exercise analysis and physique coaching use the same anatomical references. Detailed targets guide exercise selection; workload groups keep set totals consistent. Saved assessments and historical exercise classifications remain available.</p>
    <MuscleCatalog muscles={muscles} />
  </div>;
}
