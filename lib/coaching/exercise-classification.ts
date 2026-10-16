import { z } from "zod";
import { accountingMuscle, type MuscleReference } from "@/lib/muscles/catalog";
import { mechanicsBasis, readMechanics, reconcileMechanicsTargets, type MechanicsEnvelope } from "./exercise-mechanics";

const link = z.object({ muscleId: z.string().uuid(), estimateSource: z.enum(["COACH", "LEGACY", "UNKNOWN"]).optional(), contributionEstimate: z.number().min(0).max(1).nullable().optional() });
export const classificationSchema = z.object({ version: z.literal(1), source: z.enum(["COACH", "CATALOG"]),
  primary: z.array(link), secondary: z.array(link), basis: z.string().optional(), revision: z.number().optional(),
  appliedAt: z.string().optional(), profile: z.unknown().optional(), executionSetup: z.string().nullable().optional(),
  issues: z.array(z.string()).default([]) });
export type ExerciseClassification = z.infer<typeof classificationSchema>;
export function readClassification(value: unknown) {
  const parsed = classificationSchema.safeParse(value); return parsed.success ? parsed.data : null;
}
export type ClassificationExercise = { name: string; setupNotes?: string | null; movementGroupId: string;
  primaryMuscles: Array<{ muscleId: string }>; secondaryMuscles: Array<{ muscleId: string; contributionEstimate?: unknown }> };

/** Derive only what was recorded. Never infer numerical fractions from a qualitative role. */
export function classificationFromProfile(exercise: ClassificationExercise, value: unknown, setup: string | null,
  muscles: MuscleReference[], revision: number, appliedAt = new Date().toISOString()): ExerciseClassification | null {
  const saved = readMechanics(value);
  if (!saved?.acceptedAt || saved.basis !== mechanicsBasis(exercise, setup)) return null;
  const envelope: MechanicsEnvelope = structuredClone(saved);
  reconcileMechanicsTargets(envelope.profile, muscles);
  const primary = new Map<string, { muscleId: string }>();
  const secondary = new Map<string, { muscleId: string; contributionEstimate: number | null; estimateSource: "COACH" | "LEGACY" | "UNKNOWN" }>();
  const issues: string[] = [];
  for (const target of envelope.profile.targets) {
    const muscle = muscles.find(m => m.id === target.muscleId);
    const group = muscle && accountingMuscle(muscle, muscles);
    if (!group) { issues.push(`${target.muscleName}: unresolved reference; previous classification retained.`); continue; }
    if (target.confidence === "LOW") { issues.push(`${target.muscleName}: low-confidence classification; previous classification retained.`); continue; }
    if (target.role === "PRIMARY") primary.set(group.id, { muscleId: group.id });
    else {
      const previous = exercise.secondaryMuscles.find(m => m.muscleId === group.id);
      const legacy = target.contributionEstimate === undefined && previous?.contributionEstimate != null;
      const fraction = legacy ? Number(previous!.contributionEstimate) : target.contributionEstimate ?? null;
      const prior = secondary.get(group.id);
      // Multiple detailed targets in one group are one exposure, never summed.
      if (!prior || prior.contributionEstimate === null || (fraction !== null && fraction > prior.contributionEstimate)) {
        secondary.set(group.id, { muscleId: group.id, estimateSource: legacy ? "LEGACY" : fraction === null ? "UNKNOWN" : "COACH", contributionEstimate: fraction });
      }
    }
  }
  // Partial mappings must not erase valid baseline targets.
  if (!primary.size || issues.length) return { version: 1, source: "CATALOG", primary: exercise.primaryMuscles.map(m => ({ muscleId: m.muscleId })),
    secondary: exercise.secondaryMuscles.map(m => ({ muscleId: m.muscleId, contributionEstimate: m.contributionEstimate == null ? null : Number(m.contributionEstimate) })),
    basis: saved.basis, revision, appliedAt, profile: envelope, executionSetup: setup,
    issues: issues.length ? issues : ["No supported primary target; previous classification retained."] };
  for (const id of primary.keys()) secondary.delete(id);
  const unchangedPrimary = primary.size === exercise.primaryMuscles.length && exercise.primaryMuscles.every(m => primary.has(m.muscleId));
  for (const target of secondary.values()) if (target.estimateSource === "LEGACY" && !unchangedPrimary) {
    target.contributionEstimate = null; target.estimateSource = "UNKNOWN";
  }
  if ([...secondary.values()].some(m => m.estimateSource === "LEGACY")) issues.push("Existing indirect estimates retained for unchanged targets; they were not newly assessed from this saved profile.");
  if ([...secondary.values()].some(m => m.contributionEstimate === null)) issues.push("Some indirect contributions remain unassessed; no numerical estimates were invented.");
  return { version: 1, source: "COACH", primary: [...primary.values()], secondary: [...secondary.values()],
    basis: saved.basis, revision, appliedAt, profile: envelope, executionSetup: setup, issues };
}
