import { generateMesocyclePrescriptionWithQuickOverrides as generate } from "../planning/mesocycleQuickOverrides";
import type { ProgrammingOption } from "../ai/programming-decision-schema";
import { t3StepLimits, T3_RANGE_CEILING } from "./t3-volume-policy";
import { z } from "zod";
import { planT3Structure } from "./t3-structure-implementation";
import { parseMesocycleStructureOverrides, type MesocycleStructureState } from "../planning/mesocycleStructure";

export const T3PlanPreviewSchema = z.object({
  slots: z.array(z.object({ id: z.string(), template: z.string(), exercise: z.string(), before: z.number(), after: z.number(),
    templateId: z.string().optional(), exerciseId: z.string().optional() })),
  muscles: z.array(z.object({ muscleId: z.string(), name: z.string(), before: z.number(), after: z.number() })),
  movementTargets: z.array(z.object({ movementGroupId: z.string(), targetSets: z.number() })),
  structureOverrides: z.unknown().optional(),
  implementationKind: z.literal("MESOCYCLE_STRUCTURE").optional(),
  weeklyPhysicalSetsAdded: z.number(), weeklyPhysicalSetsRemoved: z.number(),
});

export function readAppliedPreview(value: unknown): T3PlanPreview[] {
  if (!value || typeof value !== "object" || !("appliedPreview" in value)) return [];
  const parsed = T3PlanPreviewSchema.safeParse(value.appliedPreview);
  if (!parsed.success) return [];
  const { structureOverrides, ...rest } = parsed.data;
  return [{ ...rest, ...(structureOverrides ? { structureOverrides: parseMesocycleStructureOverrides(structureOverrides) } : {}) }];
}

export type T3PrescriptionInput = Parameters<typeof generate>[0];
export type T3PlanPreview = {
  slots: Array<{ id: string; template: string; exercise: string; before: number; after: number; templateId?: string; exerciseId?: string }>;
  muscles: Array<{ muscleId: string; name: string; before: number; after: number }>;
  movementTargets: Array<{ movementGroupId: string; targetSets: number }>;
  structureOverrides?: MesocycleStructureState;
  implementationKind?: "MESOCYCLE_STRUCTURE";
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
  option: ProgrammingOption, confidence: string, status: string, reviewedSlots?: T3PlanPreview["slots"]): T3PlanPreview {
  if (!input.mesocycle) throw new Error("No active prescription");
  const before = generate(input);
  const weekly = 7 / input.program.volumeWindowDays;
  const movementTargets = new Map((input.mesocycle.movementVolumeTargets ?? []).map((row) => [row.movementGroupId, { ...row }]));
  const appliedTargets = option.movementChanges.map((change) => {
    const row = before.movementVolumeRows.find((item) => item.movementGroupId === change.movementPatternId);
    // Apply the delta to implemented movement work, not an unattained old quota.
    const next = (row?.planned ?? 0) * weekly + change.deltaSets;
    if (next < 0) throw new Error("Movement target would become negative");
    movementTargets.set(change.movementPatternId, {
      movementGroupId: change.movementPatternId, movementGroupName: change.movementPatternName,
      sortOrder: row?.sortOrder ?? 0, targetSets: next,
    });
    return { movementGroupId: change.movementPatternId, targetSets: next };
  });
  const implementation = planT3Structure(input, before, muscleId, option, reviewedSlots);
  const after = generate({ ...input, templates: implementation.templates, mesocycle: {
    ...input.mesocycle,
    volumeTargets: input.mesocycle.volumeTargets.map((row) => row.muscleId === muscleId
      ? { ...row, targetSets: Number(row.targetSets) + option.deltaWeeklySets } : row),
    movementVolumeTargets: [...movementTargets.values()],
    structureOverrides: implementation.structure,
  } });
  const beforeActive = before.items.filter((row) => !row.isMesocycleSuppressed && row.adjustedPlannedSets > 0);
  const afterActive = after.items.filter((row) => !row.isMesocycleSuppressed && row.adjustedPlannedSets > 0);
  const originalFor = (row: typeof after.items[number]) => {
    const action = implementation.structure.actions.find((action) => action.id === row.mesocycleStructureActionId);
    const sourceId = action?.type === "ADD_SLOT" ? action.sourceTemplateExerciseId : null;
    return beforeActive.find((old) => old.id === row.id || old.id === sourceId);
  };
  const matched = new Set<string>();
  const slots: T3PlanPreview["slots"] = [];
  let added = 0, removed = 0;
  for (const row of afterActive) {
    const old = originalFor(row);
    if (old) matched.add(old.id);
    const delta = row.adjustedPlannedSets - (old?.adjustedPlannedSets ?? 0);
    if (!delta) continue;
    if (row.adjustedPlannedSets > 8 && delta > 0) throw new Error("An exercise would exceed the eight-set application limit");
    slots.push({ id: old?.id ?? row.id, template: row.templateName, exercise: row.exerciseName,
      templateId: row.templateId, exerciseId: row.exerciseId,
      before: old?.adjustedPlannedSets ?? 0, after: row.adjustedPlannedSets });
    added += Math.max(0, delta) * Number(row.expectedOccurrences) * weekly;
    removed += Math.max(0, -delta) * Number(row.expectedOccurrences) * weekly;
  }
  for (const old of beforeActive.filter((row) => !matched.has(row.id))) {
    slots.push({ id: old.id, template: old.templateName, exercise: old.exerciseName, templateId: old.templateId, exerciseId: old.exerciseId,
      before: old.adjustedPlannedSets, after: 0 });
    removed += old.adjustedPlannedSets * Number(old.expectedOccurrences) * weekly;
  }
  if (!slots.length) throw new Error("No physical implementation changed. The requested effective-dose step may be smaller than the available discrete set increment.");
  for (const templateId of new Set(afterActive.map((row) => row.templateId))) {
    const old = beforeActive.filter((row) => row.templateId === templateId);
    const next = afterActive.filter((row) => row.templateId === templateId);
    const oldSets = old.reduce((sum, row) => sum + row.adjustedPlannedSets, 0);
    const nextSets = next.reduce((sum, row) => sum + row.adjustedPlannedSets, 0);
    if ((nextSets > 36 && nextSets > oldSets) || (next.length > 16 && next.length > old.length)) {
      throw new Error("This implementation exceeds session capacity; reallocate existing work or choose another template.");
    }
    const duplicates = next.filter((row, index) => next.findIndex((item) => item.exerciseId === row.exerciseId) !== index);
    if (duplicates.some((row) => old.filter((item) => item.exerciseId === row.exerciseId).length < next.filter((item) => item.exerciseId === row.exerciseId).length)) {
      throw new Error("This implementation would introduce a duplicate exercise within one workout");
    }
  }
  if (added > 6.05 || removed > 8.05) throw new Error("This implementation changes too many weekly physical sets");
  const muscles = after.volumeRows.flatMap((row) => {
    const old = before.volumeRows.find((item) => item.muscleId === row.muscleId);
    const from = (old?.planned ?? 0) * weekly;
    const to = row.planned * weekly;
    if (Math.abs(to - from) < 0.05) return [];
    if (to > T3_RANGE_CEILING + .05 && to > from) throw new Error("The realized muscle dose exceeds the application sanity ceiling");
    const limit = t3StepLimits(from, confidence, status);
    if (to - from > limit.increase + 0.05 || from - to > limit.decrease + 0.05) throw new Error("The realized dose change or compound overlap exceeds its staged limit");
    return [{ muscleId: row.muscleId, name: row.muscleName, before: Math.round(from * 10) / 10, after: Math.round(to * 10) / 10 }];
  });
  const target = muscles.find((row) => row.muscleId === muscleId);
  const delta = target ? target.after - target.before : 0;
  if ((option.deltaWeeklySets > 0 && delta <= 0) || (option.deltaWeeklySets < 0 && delta >= 0) ||
      (option.action === "REALLOCATE_VOLUME" && Math.abs(delta) > 0.5)) throw new Error("The planner cannot realize the proposed muscle-dose direction");
  return { slots, muscles, movementTargets: appliedTargets, structureOverrides: parseMesocycleStructureOverrides(implementation.structure),
    implementationKind: "MESOCYCLE_STRUCTURE", weeklyPhysicalSetsAdded: added, weeklyPhysicalSetsRemoved: removed };
}

/** Compare exactly what the athlete reviewed, not changing internal action IDs. */
export function t3PreviewEffectsSignature(preview: Pick<T3PlanPreview, "slots" | "muscles" | "movementTargets" | "weeklyPhysicalSetsAdded" | "weeklyPhysicalSetsRemoved">) {
  const sorted = <T>(rows: T[]) => rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify({
    slots: sorted(preview.slots.map(({ templateId, exerciseId, template, exercise, before, after }) => ({ templateId, exerciseId, template, exercise, before, after }))),
    muscles: sorted([...preview.muscles]), movementTargets: sorted([...preview.movementTargets]),
    weeklyPhysicalSetsAdded: preview.weeklyPhysicalSetsAdded, weeklyPhysicalSetsRemoved: preview.weeklyPhysicalSetsRemoved,
  });
}
