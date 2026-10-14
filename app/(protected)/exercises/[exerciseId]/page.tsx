import { Button } from "@/components/ui/Button";
import { notFound } from "next/navigation";
import { archiveExercise, restoreExercise, saveExercise, saveExerciseCoachingProfile, getExerciseForEdit, getExerciseReferenceData } from "@/lib/server/exercises";
import { ExerciseForm } from "@/components/exercises/ExerciseForm";
import { ExerciseCoachingProfileForm } from "@/components/exercises/ExerciseCoachingProfileForm";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function EditExercisePage({ params }: { params: Promise<{ exerciseId: string }> }) {
  const { exerciseId } = await params;
  const [exercise, referenceData] = await Promise.all([getExerciseForEdit(exerciseId), getExerciseReferenceData()]);

  if (!exercise) notFound();

  const action = saveExercise.bind(null, exercise.id);
  const archived = exercise.isArchived || exercise.coachingProfiles[0]?.isArchived === true;

  return (
    <div className="space-y-5">
      <PageHeader
        title={exercise.isSeed ? "Edit seed exercise" : "Edit exercise"}
        description="Exercise classification controls future template and volume logic."
      />
      <form action={archived ? restoreExercise : archiveExercise}>
        <input type="hidden" name="exerciseId" value={exercise.id} />
        <Button variant="secondary">{archived ? "Restore exercise" : "Archive exercise"}</Button>
        <p className="mt-2 text-xs text-slate-400">Archiving removes this exercise from future selections and coaching suggestions. Logged workouts remain available.</p>
      </form>
      <ExerciseForm exercise={exercise} muscles={referenceData.muscles} movementGroups={referenceData.movementGroups} action={action} />
      <ExerciseCoachingProfileForm profile={exercise.coachingProfiles[0] ?? null} setTypes={referenceData.setTypes} action={saveExerciseCoachingProfile.bind(null, exercise.id)} />
    </div>
  );
}
