import { PageHeader } from "@/components/ui/PageHeader";
import { WorkoutLogger } from "@/components/workouts/WorkoutLogger";
import { getWorkoutLoggerData } from "@/lib/server/workouts";

export const maxDuration = 300;

type PageProps = {
  searchParams: Promise<{
    programId?: string;
    templateId?: string;
    sessionId?: string;
  }>;
};

export default async function LogPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await getWorkoutLoggerData(params);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Workout Logger"
        description="Perform the movement well and log what happened. The logbook is evidence, not today's target."
      />
      <div className="rounded-2xl border border-orange-400/15 bg-orange-500/[0.06] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-orange-300/80">
          Stimulus first
        </p>
        <p className="mt-1 text-sm leading-5 text-slate-300">
          Stay inside the prescribed effort and execute the exercise well. You do not need to match or beat the previous exposure; load and reps are recorded so the Advisor can interpret the longer-term pattern.
        </p>
      </div>
      <WorkoutLogger data={data} />
    </div>
  );
}
