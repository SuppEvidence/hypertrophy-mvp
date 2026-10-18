import { PageHeader } from "@/components/ui/PageHeader";
import { WorkoutLogger } from "@/components/workouts/WorkoutLogger";
import { getWorkoutLoggerData } from "@/lib/server/workouts";

export const maxDuration = 300;

type PageProps = {
  searchParams: Promise<{
    programId?: string;
    templateId?: string;
    sessionId?: string;
    occurrenceId?: string;
    planSource?: string;
  }>;
};

export default async function LogPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await getWorkoutLoggerData(params);
  return (
    <div className="space-y-5">
      <PageHeader title="Train" />
      <WorkoutLogger data={data} />
    </div>
  );
}
