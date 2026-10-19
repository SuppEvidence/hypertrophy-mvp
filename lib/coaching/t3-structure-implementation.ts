import { resolveExerciseRepTargets } from "./exercise-rep-targets";
import type { ProgrammingOption } from "../ai/programming-decision-schema";
import type { GeneratedPrescriptionItem, GeneratorMovementExerciseDefault } from "../planning/mesocycleGenerator";
import { parseMesocycleStructureOverrides, type MesocycleStructureAction } from "../planning/mesocycleStructure";
import type { T3PrescriptionInput, T3PlanPreview } from "./t3-prescription-preview";
import { t3ExerciseType } from "./t3-exercise-type";
import { regularWeeklySetTypeIds } from "./weekly-set-types";

/** Implement the requested movement dose directly; template min/max are not coaching limits. */
export function planT3Structure(input: T3PrescriptionInput, before: { items: GeneratedPrescriptionItem[] },
  muscleId: string, option: ProgrammingOption, reviewedSlots?: T3PlanPreview["slots"]) {
  if (!input.mesocycle) throw new Error("No active block");
  const multipliers = new Map((input.setTypes ?? []).map((row) => [row.id, Number(row.multiplier)]));
  const regular = regularWeeklySetTypeIds((input.setTypes ?? []).map((row) => ({ ...row, slug: row.slug ?? row.name.toLowerCase().replaceAll(" ", "-"), multiplier: Number(row.multiplier) })))[0];
  const active = before.items.filter((row) => !row.isMesocycleSuppressed && row.adjustedPlannedSets > 0);
  const typesFor = (item: GeneratedPrescriptionItem) => Array.from({ length: item.adjustedPlannedSets }, (_, index) =>
    item.mesocycleAddedSetPlans.find((row) => row.setNumber === index + 1)?.setTypeId ??
    item.setPlans.find((row) => row.setNumber === index + 1)?.setTypeId ?? item.defaultSetTypeId);
  const working = active.map((item) => ({ item, sourceId: item.id as string | null, types: typesFor(item) }));
  const weekly = 7 / input.program.volumeWindowDays;
  const frequency = (item: GeneratedPrescriptionItem) => Number(item.expectedOccurrences) * weekly;
  const templates = input.templates?.length ? input.templates : [...new Map(before.items.map((item) => [item.templateId,
    { id: item.templateId, name: item.templateName, sequenceIndex: item.templateSequenceIndex, expectedOccurrences: item.expectedOccurrences }])).values()];
  const catalog: GeneratorMovementExerciseDefault[] = input.movementDefaults ?? active.map((item) => ({
    exerciseId: item.exerciseId, exerciseName: item.exerciseName, movementGroupId: item.movementGroupId,
    movementGroupName: item.movementGroupName, movementGroupSortOrder: item.movementGroupSortOrder,
    primaryMuscles: item.primaryMuscles, secondaryMuscles: item.secondaryMuscles,
  }));
  const allowed = new Set(catalog.map((row) => row.exerciseId));
  const matchesType = (name: string, role?: string | null) => option.preferredExerciseType === "EITHER" ||
    t3ExerciseType(name, role) == null || t3ExerciseType(name, role) === option.preferredExerciseType;
  const load = (templateId: string) => working.filter((row) => row.item.templateId === templateId).reduce((sum, row) => sum + row.types.length, 0);
  const extraActions: MesocycleStructureAction[] = [];
  const preferred = (templateId: string, exerciseId: string) => Number(reviewedSlots?.some((slot) =>
    slot.templateId === templateId && slot.exerciseId === exerciseId));
  for (const change of option.movementChanges) {
    const sign = Math.sign(change.deltaSets);
    let remaining = Math.abs(change.deltaSets), changes = 0;
    while (remaining > .05 && changes < 16) {
      const candidates = working.filter((row) => row.item.movementGroupId === change.movementPatternId && frequency(row.item) > 0 &&
        (sign < 0 ? row.types.length > 0 : regular && row.types.length < 8 && allowed.has(row.item.exerciseId) && matchesType(row.item.movementGroupName, row.item.slotRole)))
        .map((row) => {
          const typeId = sign < 0 ? row.types[row.types.length - 1] : regular!;
          const effect = (multipliers.get(typeId) ?? 0) * frequency(row.item);
          return { row, typeId, effect, gap: Math.abs(remaining - effect) };
        }).filter((candidate) => candidate.effect > 0 && Number.isFinite(candidate.effect))
        .sort((a, b) => a.gap - b.gap || preferred(b.row.item.templateId, b.row.item.exerciseId) - preferred(a.row.item.templateId, a.row.item.exerciseId) ||
          Number(b.row.item.primaryMuscles.some((link) => link.muscleId === muscleId)) - Number(a.row.item.primaryMuscles.some((link) => link.muscleId === muscleId)) ||
          (sign > 0 ? load(a.row.item.templateId) - load(b.row.item.templateId) : load(b.row.item.templateId) - load(a.row.item.templateId)) || a.row.item.sortOrder - b.row.item.sortOrder);
      // Prefer an existing exercise. A new slot is needed only if none can take another set.
      if (!candidates.length && sign > 0 && regular) {
        const choices = templates.filter((template) => Number(template.expectedOccurrences) > 0).flatMap((template) =>
          catalog.filter((exercise) => exercise.movementGroupId === change.movementPatternId && matchesType(exercise.movementGroupName) &&
            !working.some((row) => row.types.length && row.item.templateId === template.id && row.item.exerciseId === exercise.exerciseId))
            .map((exercise) => ({ template, exercise })))
          .sort((a, b) => preferred(b.template.id, b.exercise.exerciseId) - preferred(a.template.id, a.exercise.exerciseId) || load(a.template.id) - load(b.template.id) ||
            Number(b.exercise.primaryMuscles.some((link) => link.muscleId === muscleId)) - Number(a.exercise.primaryMuscles.some((link) => link.muscleId === muscleId)) || a.template.sequenceIndex - b.template.sequenceIndex);
        const choice = choices[0];
        if (choice) {
          const source = before.items.find((row) => row.movementGroupId === change.movementPatternId) ?? before.items[0] ?? {
            ...choice.exercise, id: "t3-proposal-source", templateId: choice.template.id, templateName: choice.template.name,
            templateSequenceIndex: choice.template.sequenceIndex, expectedOccurrences: choice.template.expectedOccurrences,
            sortOrder: 0, plannedSets: 0, defaultSetTypeId: regular, defaultSetTypeMultiplier: multipliers.get(regular)!, setPlans: [],
            basePlannedSets: 0, adjustedPlannedSets: 0, adjustmentDelta: 0, prescribedMinReps: null, prescribedMaxReps: null,
            adjustmentReason: null, mesocycleAddedSetPlans: [], isMesocycleVirtualSlot: true, isMesocycleSuppressed: false,
            mesocycleStructureActionId: null,
          };
          const targets = resolveExerciseRepTargets({ exerciseId: choice.exercise.exerciseId,
            source: { exerciseId: source.exerciseId, minReps: source.prescribedMinReps,
              maxReps: source.prescribedMaxReps, rirTarget: source.rirTarget },
            defaultMinReps: choice.exercise.defaultMinReps, defaultMaxReps: choice.exercise.defaultMaxReps });
          const compound = t3ExerciseType(choice.exercise.movementGroupName) === "COMPOUND";
          const first = working.filter((row) => row.item.templateId === choice.template.id).map((row) => row.item.sortOrder);
          const item: GeneratedPrescriptionItem = { ...source, ...choice.exercise,
            id: `t3-new:${choice.template.id}:${choice.exercise.exerciseId}`, templateId: choice.template.id,
            templateName: choice.template.name, templateSequenceIndex: choice.template.sequenceIndex,
            expectedOccurrences: choice.template.expectedOccurrences, adjustedPlannedSets: 0, plannedSets: 0,
            sortOrder: option.placementPreference === "EARLIER_IF_LOGICAL" ? Math.min(0, ...first) - 1 : Math.max(0, ...first) + 1,
            defaultSetTypeId: regular, defaultSetTypeMultiplier: multipliers.get(regular)!,
            minReps: targets.minReps, maxReps: targets.maxReps,
            prescribedMinReps: targets.minReps, prescribedMaxReps: targets.maxReps, rirTarget: targets.targetRir,
            slotRole: compound ? "SECONDARY" : "ISOLATION", repBucket: compound ? "SECONDARY_COMPOUND" : "ISOLATION" };
          working.push({ item, sourceId: null, types: [] });
          continue;
        }
      }
      const chosen = candidates[0];
      if (!chosen || (changes > 0 && chosen.gap >= remaining - .05)) break;
      if (sign < 0) chosen.row.types.pop(); else chosen.row.types.push(chosen.typeId);
      remaining -= chosen.effect;
      changes++;
    }
    if (!changes) throw new Error(`${change.movementPatternName}: no legal discrete set change is available; choose another compatible movement or distribution.`);
  }
  const current = parseMesocycleStructureOverrides(input.mesocycle.structureOverrides);
  for (const row of working) {
    const old = row.sourceId ? active.find((item) => item.id === row.sourceId) : null;
    if (old && JSON.stringify(typesFor(old)) === JSON.stringify(row.types)) continue;
    const key = `t3-dose:${current.actions.length + extraActions.length}:${row.item.templateId}:${row.item.movementGroupId}`;
    if (old) extraActions.push({ id: `${key}:remove`, type: "REMOVE_SLOT", templateId: old.templateId,
      movementGroupId: old.movementGroupId, templateExerciseId: old.id });
    if (row.types.length) extraActions.push({ id: `${key}:add`, type: "ADD_SLOT", templateId: row.item.templateId,
      movementGroupId: row.item.movementGroupId, sourceTemplateExerciseId: old?.id ?? null, exerciseId: row.item.exerciseId,
      defaultSetTypeId: regular ?? row.item.defaultSetTypeId, plannedSets: row.types.length, maxSets: row.types.length,
      setPlans: row.types.map((setTypeId, index) => ({ setNumber: index + 1, setTypeId })), fixedSets: true,
      sortOrder: row.item.sortOrder, slotRole: row.item.slotRole ?? undefined, repBucket: row.item.repBucket ?? undefined });
  }
  return { structure: { version: 1 as const, actions: [...current.actions, ...extraActions] }, templates };
}
