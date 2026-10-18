import {
  mechanicsBasis,
  readMechanics,
} from "@/lib/coaching/exercise-mechanics";

export function exerciseGuidance(exercise: {
  name: string;
  setupNotes: string | null;
  movementGroupId: string;
  mechanicsSourceBasis?: string;
  primaryMuscles: Array<{ muscleId: string }>;
  secondaryMuscles: Array<{ muscleId: string }>;
  coachingProfiles: Array<{
    executionSetup: string | null;
    mechanicsProfile: unknown;
  }>;
}) {
  const saved = exercise.coachingProfiles[0];
  const envelope = readMechanics(saved?.mechanicsProfile);
  const accepted = envelope?.acceptedAt ? envelope : null;
  const status = !accepted
    ? "MISSING"
    : accepted.basis === mechanicsBasis(exercise, saved?.executionSetup ?? null)
      ? "ACCEPTED"
      : "STALE";
  const profile = status === "ACCEPTED" ? accepted!.profile : null;
  return {
    status,
    setup: [
      ...new Set(
        [exercise.setupNotes?.trim(), saved?.executionSetup?.trim()].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    ],
    summary: profile?.summary ?? null,
    cues: profile?.techniqueAdvice ?? [],
    observedExecution: profile?.observedExecution ?? [],
    movement: profile?.movement.description ?? null,
    resistance: profile?.resistanceProfile.description ?? null,
    muscleLength: profile?.muscleLengthExposure.description ?? null,
    fatigue: profile?.stabilityAndFatigue.description ?? null,
    setFormats: profile?.setTypeSuitability.description ?? null,
    targets:
      profile?.targets.map((target) => ({
        name: target.muscleName,
        region: target.region,
        role: target.role,
        confidence: target.confidence,
      })) ?? [],
    limitations: profile?.limitations ?? [],
  };
}
export type WorkoutExerciseGuidance = ReturnType<typeof exerciseGuidance>;
