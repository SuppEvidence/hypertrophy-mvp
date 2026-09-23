import { generateMesocyclePrescriptionWithQuickOverrides as generate } from "../planning/mesocycleQuickOverrides";
import type { ProgrammingOption } from "../ai/programming-decision-schema";
import { t3StepLimits } from "./t3-volume-policy";
import { z } from "zod";

export const T3PlanPreviewSchema = z.object({
  slots: z.array(z.object({ id: z.string(), template: z.string(), exercise: z.string(), before: z.number(), after: z.number() })),
  muscles: z.array(z.object({ muscleId: z.string(), name: z.string(), before: z.number(), after: z.number() })),
  movementTargets: z.array(z.object({ movementGroupId: z.string(), targetSets: z.number() })),
  weeklyPhysicalSetsAdded: z.number(), weeklyPhysicalSetsRemoved: z.number(),
});

export function readAppliedPreview(value: unknown): T3PlanPreview[] {
  if (!value || typeof value !== "object" || !("appliedPreview" in value)) return [];
  const parsed = T3PlanPreviewSchema.safeParse(value.appliedPreview);
  return parsed.success ? [parsed.data] : [];
}

export type T3PrescriptionInput = Parameters<typeof generate>[0];
export type T3PlanPreview = {
  slots: Array<{ id: string; template: string; exercise: string; before: number; after: number }>;
  muscles: Array<{ muscleId: string; name: string; before: number; after: number }>;
  movementTargets: Array<{ movementGroupId: string; targetSets: number }>;
  weeklyPhysicalSetsAdded: number;
  weeklyPhysicalSetsRemoved: number;
};

export function assertT3WeeklyBudget(next: T3PlanPreview, previous: T3PlanPreview[]) {
  for (const muscle of next.muscles) {
    const deltas = previous.flatMap((preview) => preview.muscles.filter((row) => row.muscleId === muscle.muscleId).map((row) => row.after - row.before));
    deltas.push(muscle.after - muscle.before);
    if (deltas.reduce((sum, delta) => sum + Math.max(0, delta), 0) > 4.05 ||
        deltas.reduce((sum, delta) => sum + Math.max(0, -delta), 0) > 6.05) {
      throw new Error("This muscle has reached its staged change budget for the last seven days. Keep the current dose and assess its response before another change.");
    }
  }
  if ([...previous, next].reduce((sum, row) => sum + row.weeklyPhysicalSetsAdded, 0) > 12.05 ||
      [...previous, next].reduce((sum, row) => sum + row.weeklyPhysicalSetsRemoved, 0) > 16.05) {
    throw new Error("The block has reached its seven-day adjustment budget. Allow time to assess the approved changes.");
  }
}

export function previewT3Prescription(input: T3PrescriptionInput, muscleId: string,
  option: ProgrammingOption, confidence: string, status: string): T3PlanPreview {
  if (!input.mesocycle) throw new Error("No active prescription");
  const before = generate(input);
  const weekly = 7 / input.program.volumeWindowDays;
  const movementTargets = new Map((input.mesocycle.movementVolumeTargets ?? []).map((row) => [row.movementGroupId, { ...row }]));
  const appliedTargets = option.movementChanges.map((change) => {
    const row = before.movementVolumeRows.find((item) => item.movementGroupId === change.movementPatternId);
    const current = movementTargets.get(change.movementPatternId);
    const next = Number(current?.targetSets ?? ((row?.planned ?? 0) * weekly)) + change.deltaSets;
    if (next < 0) throw new Error("Movement target would become negative");
    movementTargets.set(change.movementPatternId, {
      movementGroupId: change.movementPatternId, movementGroupName: change.movementPatternName,
      sortOrder: row?.sortOrder ?? 0, targetSets: next,
    });
    return { movementGroupId: change.movementPatternId, targetSets: next };
  });
  const after = generate({ ...input, mesocycle: {
    ...input.mesocycle,
    volumeTargets: input.mesocycle.volumeTargets.map((row) => row.muscleId === muscleId
      ? { ...row, targetSets: Number(row.targetSets) + option.deltaWeeklySets } : row),
    movementVolumeTargets: [...movementTargets.values()],
  } });
  const slots = after.items.flatMap((row) => {
    const old = before.items.find((item) => item.id === row.id && item.templateId === row.templateId);
    if (!old || old.adjustedPlannedSets === row.adjustedPlannedSets) return [];
    return [{ id: row.id, template: row.templateName, exercise: row.exerciseName,
      before: old.adjustedPlannedSets, after: row.adjustedPlannedSets }];
  });
  if (!slots.length) throw new Error("This target change cannot be implemented inside the current slot limits. A structural change is needed first.");
  let added = 0;
  let removed = 0;
  for (const row of after.items) {
    const old = before.items.find((item) => item.id === row.id && item.templateId === row.templateId);
    const delta = (row.adjustedPlannedSets - (old?.adjustedPlannedSets ?? 0)) * Number(row.expectedOccurrences) * weekly;
    const exerciseType = row.secondaryMuscles.length ? "COMPOUND" : "ISOLATION";
    if (delta > 0 && option.preferredExerciseType !== "EITHER" && exerciseType !== option.preferredExerciseType) {
      throw new Error("The current slots cannot implement the requested exercise type; use a structural proposal first.");
    }
    added += Math.max(0, delta);
    removed += Math.max(0, -delta);
  }
  if (added > 6.05 || removed > 8.05) throw new Error("This implementation changes too many weekly physical sets");
  const muscles = after.volumeRows.flatMap((row) => {
    const old = before.volumeRows.find((item) => item.muscleId === row.muscleId);
    const from = (old?.planned ?? 0) * weekly;
    const to = row.planned * weekly;
    if (Math.abs(to - from) < 0.05) return [];
    const limit = t3StepLimits(from, confidence, status);
    if (to - from > limit.increase + 0.05 || from - to > limit.decrease + 0.05) throw new Error("The realized dose change or compound overlap exceeds its staged limit");
    return [{ muscleId: row.muscleId, name: row.muscleName, before: Math.round(from * 10) / 10, after: Math.round(to * 10) / 10 }];
  });
  const target = muscles.find((row) => row.muscleId === muscleId);
  const delta = target ? target.after - target.before : 0;
  if ((option.deltaWeeklySets > 0 && delta <= 0) || (option.deltaWeeklySets < 0 && delta >= 0) ||
      (option.action === "REALLOCATE_VOLUME" && Math.abs(delta) > 0.5)) throw new Error("The planner cannot realize the proposed muscle-dose direction");
  return { slots, muscles, movementTargets: appliedTargets, weeklyPhysicalSetsAdded: added, weeklyPhysicalSetsRemoved: removed };
}
