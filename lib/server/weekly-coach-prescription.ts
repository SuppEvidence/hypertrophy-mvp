import "server-only";
import type { GeneratedPrescriptionItem } from "@/lib/planning/mesocycleGenerator";
import { readApprovedOccurrence } from "@/lib/server/weekly-coach-read";
import { isEdtSetType } from "@/lib/coaching/set-type-classification";

export async function applyWeeklyCoachOccurrence(args: {
  userId: string;
  programId: string;
  occurrenceId: string;
  mesocycleId: string | null;
  items: GeneratedPrescriptionItem[];
  movementDefaults: Array<{ exerciseId: string; exerciseName: string; movementGroupId: string; movementGroupName: string; movementGroupSortOrder: number;
    defaultMinReps?: number | null; defaultMaxReps?: number | null;
    primaryMuscles: GeneratedPrescriptionItem["primaryMuscles"]; secondaryMuscles: GeneratedPrescriptionItem["secondaryMuscles"] }>;
  setTypes: Array<{ id: string; name: string; slug?: string | null; multiplier: unknown; isIntensifier: boolean }>;
}) {
  const found = await readApprovedOccurrence(args.userId, args.programId, args.occurrenceId);
  if (!found || found.mesocycleId !== args.mesocycleId) return null;
  const { occurrence } = found;
  const normalTypes = new Map(args.setTypes.filter((type) => !type.isIntensifier && !isEdtSetType(type) && Math.abs(Number(type.multiplier) - 1) < .001).map((type) => [type.id, type]));
  const allTypes = new Map(args.setTypes.map((type) => [type.id, type]));
  if (!normalTypes.size) return null;
  const catalog = new Map(args.movementDefaults.map((row) => [row.exerciseId, row]));
  const sources = new Map(args.items.map((row) => [row.id, row]));
  const items: GeneratedPrescriptionItem[] = [];
  for (const [index, entry] of occurrence.items.entries()) {
    const source = sources.get(entry.sourceSlotId);
    const exercise = catalog.get(entry.exerciseId);
    if (!exercise || (source && source.movementGroupId !== exercise.movementGroupId && source.exerciseId !== entry.exerciseId) || entry.setTypeIds.length !== entry.sets) return null;
    const chosenTypes = entry.setTypeIds.map((id, index) => {
      const type = allTypes.get(id);
      const retained = source?.exerciseId === entry.exerciseId &&
        (source?.mesocycleAddedSetPlans.find((row) => row.setNumber === index + 1)?.setTypeId ??
          source?.setPlans.find((row) => row.setNumber === index + 1)?.setTypeId ?? source?.defaultSetTypeId) === id;
      const approvedSpecialType = found.plan.workouts.some((day) =>
        day.items.some((item) => item.exerciseId === entry.exerciseId && item.setTypeIds.includes(id)));
      return type && (normalTypes.has(id) || retained || approvedSpecialType) ? type : null;
    });
    if (chosenTypes.some((type) => !type)) return null;
    const firstType = chosenTypes[0]!;
    const virtual = !source || source.templateId !== occurrence.templateId;
    const fallback = source ?? args.items.find((row) => row.movementGroupId === exercise.movementGroupId) ?? args.items[0];
    if (!fallback) return null;
    const chosen: GeneratedPrescriptionItem = {
      ...fallback,
      id: virtual ? `weekly-coach:${occurrence.id}:${index}` : fallback.id,
      templateId: occurrence.templateId,
      templateName: source?.templateId === occurrence.templateId ? source.templateName : "Weekly coached workout",
      exerciseId: exercise.exerciseId, exerciseName: exercise.exerciseName,
      movementGroupId: exercise.movementGroupId, movementGroupName: exercise.movementGroupName,
      movementGroupSortOrder: exercise.movementGroupSortOrder,
      primaryMuscles: exercise.primaryMuscles, secondaryMuscles: exercise.secondaryMuscles,
      defaultMinReps: exercise.defaultMinReps, defaultMaxReps: exercise.defaultMaxReps,
      sortOrder: index,
      plannedSets: virtual ? 0 : fallback.plannedSets,
      basePlannedSets: virtual ? 0 : fallback.basePlannedSets,
      adjustedPlannedSets: entry.sets,
      maxSets: 8, minSets: 0, autoAdjustable: true,
      defaultSetTypeId: firstType.id, defaultSetTypeMultiplier: firstType.multiplier, defaultSetTypeIsIntensifier: firstType.isIntensifier,
      setPlans: chosenTypes.map((type, n) => ({ setNumber: n + 1, setTypeId: type!.id, multiplier: type!.multiplier, isIntensifier: type!.isIntensifier })),
      mesocycleAddedSetPlans: [],
      prescribedMinReps: source?.prescribedMinReps ?? exercise.defaultMinReps ?? fallback.prescribedMinReps,
      prescribedMaxReps: source?.prescribedMaxReps ?? exercise.defaultMaxReps ?? fallback.prescribedMaxReps,
      rirTarget: source?.rirTarget ?? 2,
      adjustmentDelta: entry.sets - (source?.adjustedPlannedSets ?? 0),
      adjustmentReason: `Approved weekly plan: ${entry.reason}`,
      isMesocycleVirtualSlot: virtual,
      isMesocycleSuppressed: false,
      mesocycleStructureActionId: null,
    };
    items.push(chosen);
  }
  return { items, occurrence };
}
