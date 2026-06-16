import { PageHeader } from "@/components/ui/PageHeader";
import { WorkoutLogger } from "@/components/workouts/WorkoutLogger";
import { getWorkoutLoggerData } from "@/lib/server/workouts";

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
        description="Template-based logging for real persisted sessions. Fast set entry first; analytics remain limited to session summary in this slice."
      />
      <WorkoutLogger data={data} />
    </div>
  );
}
