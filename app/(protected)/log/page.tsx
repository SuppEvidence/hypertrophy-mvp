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
        description="Choose the planned workout, select exercises from each movement-pattern pool, and log set quality with minimal friction."
      />
      <WorkoutLogger data={data} />
    </div>
  );
}
