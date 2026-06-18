import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkoutHistory } from "@/components/workouts/WorkoutHistory";

export default async function WorkoutHistoryPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Training Log History"
        description="View, correct, or delete persisted workout sessions. Edits update dashboard and performance calculations automatically."
      />
      <Link href="/log" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200">
        Back to logger
      </Link>
      <WorkoutHistory />
    </div>
  );
}
