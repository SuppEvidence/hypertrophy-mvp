import { createExercise, getExerciseReferenceData } from "@/lib/server/exercises";
import { ExerciseForm } from "@/components/exercises/ExerciseForm";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function NewExercisePage() {
  const { muscles, movementGroups } = await getExerciseReferenceData();

  return (
    <div className="space-y-5">
      <PageHeader
        title="New exercise"
        description="Create a classification-focused exercise. Rep ranges are set per template, not on exercise records."
      />
      <ExerciseForm muscles={muscles} movementGroups={movementGroups} action={createExercise} />
    </div>
  );
}
