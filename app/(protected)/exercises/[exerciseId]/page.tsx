import { notFound } from "next/navigation";
import { saveExercise, saveExerciseCoachingProfile, getExerciseForEdit, getExerciseReferenceData } from "@/lib/server/exercises";
import { ExerciseForm } from "@/components/exercises/ExerciseForm";
import { ExerciseCoachingProfileForm } from "@/components/exercises/ExerciseCoachingProfileForm";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function EditExercisePage({ params }: { params: Promise<{ exerciseId: string }> }) {
  const { exerciseId } = await params;
  const [exercise, referenceData] = await Promise.all([getExerciseForEdit(exerciseId), getExerciseReferenceData()]);

  if (!exercise) notFound();

  const action = saveExercise.bind(null, exercise.id);

  return (
    <div className="space-y-5">
      <PageHeader
        title={exercise.isSeed ? "Edit seed exercise" : "Edit exercise"}
        description="Exercise classification controls future template and volume logic."
      />
      <ExerciseForm exercise={exercise} muscles={referenceData.muscles} movementGroups={referenceData.movementGroups} action={action} />
      <ExerciseCoachingProfileForm profile={exercise.coachingProfiles[0] ?? null} setTypes={referenceData.setTypes} action={saveExerciseCoachingProfile.bind(null, exercise.id)} />
    </div>
  );
}
