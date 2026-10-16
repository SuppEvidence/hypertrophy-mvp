import { SyncSavedProfiles } from "@/components/exercises/SyncSavedProfiles";
import { EffectiveClassification } from "@/components/exercises/EffectiveClassification";
import { ExerciseMechanicsCoach } from "@/components/exercises/ExerciseMechanicsCoach";
import { mechanicsBasis } from "@/lib/coaching/exercise-mechanics";
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
      <SyncSavedProfiles pending={referenceData.pendingProfileSync} />
      <EffectiveClassification value={exercise.coachingProfiles[0]?.appliedClassification}
        basis={mechanicsBasis(exercise, exercise.coachingProfiles[0]?.executionSetup ?? null)}
        muscles={referenceData.muscles} primary={exercise.primaryMuscles} secondary={exercise.secondaryMuscles}
        pending={!!exercise.coachingProfiles[0]?.mechanicsProfile && exercise.coachingProfiles[0]?.classificationSyncedRevision !== exercise.coachingProfiles[0]?.mechanicsRevision} />
      <ExerciseMechanicsCoach key={`${exercise.id}:${exercise.coachingProfiles[0]?.mechanicsRevision ?? 0}`} exerciseId={exercise.id}
        profile={exercise.coachingProfiles[0] ?? null} muscles={referenceData.muscles} archived={archived}
        currentBasis={mechanicsBasis(exercise, exercise.coachingProfiles[0]?.executionSetup ?? null)} />
      <details className="rounded-xl border border-slate-700 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-100">Equipment settings and fallback classification</summary>
        <p className="my-3 text-xs text-slate-400">These muscle links are used when no current, supported coach classification is available. Changing the exercise setup or fallback classification can make an existing assessment outdated.</p>
        <ExerciseForm exercise={exercise} muscles={referenceData.muscles} movementGroups={referenceData.movementGroups} action={action} />
      </details>
      <ExerciseCoachingProfileForm profile={exercise.coachingProfiles[0] ?? null} setTypes={referenceData.setTypes} action={saveExerciseCoachingProfile.bind(null, exercise.id)} />
    </div>
  );
}
