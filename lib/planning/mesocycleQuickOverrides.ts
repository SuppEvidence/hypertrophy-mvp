import {
  generateMesocyclePrescription as generateBaseMesocyclePrescription,
  type GeneratorMovementExerciseDefault,
  type GeneratorTemplateExercise,
} from "@/lib/planning/mesocycleGenerator";
import {
  parseMesocycleStructureOverrides,
  type MesocycleStructureAddAction,
} from "@/lib/planning/mesocycleStructure";

const QUICK_ADD_PREFIX = "quick-adjust:add:";
const QUICK_REMOVE_PREFIX = "quick-adjust:remove:";

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function appendReason(current: string | null, next: string) {
  return current ? `${next}; ${current}` : next;
}

function quickAdds(structureOverrides: unknown): MesocycleStructureAddAction[] {
  return parseMesocycleStructureOverrides(structureOverrides).actions.filter(
    (action): action is MesocycleStructureAddAction =>
      action.type === "ADD_SLOT" && action.id.startsWith(QUICK_ADD_PREFIX),
  );
}

function structureOverridesWithoutPairedQuickActions(structureOverrides: unknown) {
  const state = parseMesocycleStructureOverrides(structureOverrides);
  const pairedSourceIds = new Set(
    state.actions
      .filter(
        (action): action is MesocycleStructureAddAction =>
          action.type === "ADD_SLOT" && action.id.startsWith(QUICK_ADD_PREFIX),
      )
      .map((action) => action.sourceTemplateExerciseId)
      .filter((id): id is string => Boolean(id)),
  );

  return {
    version: 1 as const,
    actions: state.actions.filter((action) => {
      if (action.type === "ADD_SLOT" && action.id.startsWith(QUICK_ADD_PREFIX)) return false;
      if (
        action.type === "REMOVE_SLOT" &&
        action.id.startsWith(QUICK_REMOVE_PREFIX) &&
        pairedSourceIds.has(action.templateExerciseId)
      ) {
        return false;
      }
      return true;
    }),
  };
}

function movementDefaultForOverride(
  action: ReturnType<typeof quickAdds>[number],
  movementDefaults: GeneratorMovementExerciseDefault[],
) {
  return (
    movementDefaults.find(
      (exercise) =>
        exercise.movementGroupId === action.movementGroupId &&
        exercise.exerciseId === action.exerciseId,
    ) ??
    movementDefaults.find(
      (exercise) => exercise.movementGroupId === action.movementGroupId,
    ) ??
    null
  );
}

function mergeVolumeRows<
  T extends {
    muscleId: string;
    base: number;
    planned: number;
    delta: number;
    sortOrder: number;
    priorityLevel: number;
  },
>(baseRows: T[], adjustedRows: T[]) {
  const baseById = new Map(baseRows.map((row) => [row.muscleId, row]));
  const adjustedById = new Map(adjustedRows.map((row) => [row.muscleId, row]));
  const ids = new Set([...baseById.keys(), ...adjustedById.keys()]);

  return Array.from(ids)
    .map((id) => {
      const base = baseById.get(id);
      const adjusted = adjustedById.get(id);
      const source = adjusted ?? base;
      if (!source) return null;
      const baseValue = base?.base ?? 0;
      const planned = adjusted?.planned ?? 0;
      return {
        ...source,
        base: round(baseValue),
        planned: round(planned),
        delta: round(planned - baseValue),
      } as T;
    })
    .filter((row): row is T => Boolean(row))
    .sort(
      (a, b) =>
        b.priorityLevel - a.priorityLevel || a.sortOrder - b.sortOrder,
    );
}

function mergeMovementRows<
  T extends {
    movementGroupId: string;
    base: number;
    planned: number;
    delta: number;
    sortOrder: number;
  },
>(baseRows: T[], adjustedRows: T[]) {
  const baseById = new Map(
    baseRows.map((row) => [row.movementGroupId, row]),
  );
  const adjustedById = new Map(
    adjustedRows.map((row) => [row.movementGroupId, row]),
  );
  const ids = new Set([...baseById.keys(), ...adjustedById.keys()]);

  return Array.from(ids)
    .map((id) => {
      const base = baseById.get(id);
      const adjusted = adjustedById.get(id);
      const source = adjusted ?? base;
      if (!source) return null;
      const baseValue = base?.base ?? 0;
      const planned = adjusted?.planned ?? 0;
      return {
        ...source,
        base: round(baseValue),
        planned: round(planned),
        delta: round(planned - baseValue),
      } as T;
    })
    .filter((row): row is T => Boolean(row))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Mesocycle-only manual slot adjustments are intentionally encoded using the
 * existing ADD_SLOT + REMOVE_SLOT JSON actions so the database schema and old
 * structure-management code remain backward compatible.
 *
 * This wrapper recognizes paired "quick-adjust" actions, applies them in place
 * before the normal mesocycle generator runs, and removes only those paired
 * actions from the generator's structural action list. A REMOVE without a
 * matching ADD still behaves as a normal mesocycle-only hidden slot.
 */
export function generateMesocyclePrescriptionWithQuickOverrides(
  args: Parameters<typeof generateBaseMesocyclePrescription>[0],
): ReturnType<typeof generateBaseMesocyclePrescription> {
  const overrides = quickAdds(args.mesocycle?.structureOverrides);
  if (!args.mesocycle || overrides.length === 0) {
    return generateBaseMesocyclePrescription(args);
  }

  const cleanedStructureOverrides =
    structureOverridesWithoutPairedQuickActions(
      args.mesocycle.structureOverrides,
    );

  const mesocycle = {
    ...args.mesocycle,
    structureOverrides: cleanedStructureOverrides,
  };

  const baseGenerated = generateBaseMesocyclePrescription({
    ...args,
    mesocycle,
  });

  const overrideByTemplateExerciseId = new Map(
    overrides
      .filter((action) => Boolean(action.sourceTemplateExerciseId))
      .map((action) => [action.sourceTemplateExerciseId!, action]),
  );

  const transformedTemplateExercises: GeneratorTemplateExercise[] =
    args.templateExercises.map((item) => {
      const override = overrideByTemplateExerciseId.get(item.id);
      if (!override) return item;

      const target = movementDefaultForOverride(
        override,
        args.movementDefaults ?? [],
      );
      if (!target) return item;

      return {
        ...item,
        exerciseId: target.exerciseId,
        exerciseName: target.exerciseName,
        movementGroupId: target.movementGroupId,
        movementGroupName: target.movementGroupName,
        movementGroupSortOrder: target.movementGroupSortOrder,
        defaultMinReps: target.defaultMinReps,
        defaultMaxReps: target.defaultMaxReps,
        plannedSets: override.plannedSets,
        minSets: override.plannedSets,
        maxSets: override.plannedSets,
        autoAdjustable: false,
        primaryMuscles: target.primaryMuscles,
        secondaryMuscles: target.secondaryMuscles,
      };
    });

  const adjustedGenerated = generateBaseMesocyclePrescription({
    ...args,
    mesocycle,
    templateExercises: transformedTemplateExercises,
  });

  const originalById = new Map(
    args.templateExercises.map((item) => [item.id, item]),
  );
  const baseGeneratedById = new Map(
    baseGenerated.items.map((item) => [item.id, item]),
  );

  for (const item of adjustedGenerated.items) {
    const override = overrideByTemplateExerciseId.get(item.id);
    if (!override) continue;

    const original = originalById.get(item.id);
    const originalGenerated = baseGeneratedById.get(item.id);
    const originalMovementGroupId =
      original?.movementGroupId ?? item.movementGroupId;
    const movementChanged =
      override.movementGroupId !== originalMovementGroupId;

    item.basePlannedSets =
      originalGenerated?.basePlannedSets ??
      original?.plannedSets ??
      item.basePlannedSets;
    item.adjustmentDelta =
      item.adjustedPlannedSets - item.basePlannedSets;
    item.adjustmentReason = appendReason(
      item.adjustmentReason,
      movementChanged
        ? "Manual mesocycle movement-pattern and set override"
        : "Manual mesocycle set override",
    );
    item.mesocycleStructureActionId = override.id;

    // A movement-swapped slot must not keep a TemplateExercise relation when a
    // workout is snapshotted, otherwise the logger would still constrain
    // substitutions to the base slot's old movement group.
    if (movementChanged) item.isMesocycleVirtualSlot = true;
  }

  return {
    ...adjustedGenerated,
    volumeRows: mergeVolumeRows(
      baseGenerated.volumeRows,
      adjustedGenerated.volumeRows,
    ),
    movementVolumeRows: mergeMovementRows(
      baseGenerated.movementVolumeRows,
      adjustedGenerated.movementVolumeRows,
    ),
  };
}
