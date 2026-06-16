import type { VolumeWindowType } from "@/lib/types/domain";
import { volumeWindowDays } from "@/lib/programs/options";

export function buildTemplateVolumePreview(args: {
  program: { secondaryContribution: unknown; volumeWindowType: VolumeWindowType; customWindowDays?: number | null; volumeTargets?: Array<{ muscleId: string; weeklyTargetSets: unknown; muscle: { name: string } }> };
  templateExercises: Array<{
    plannedSets: number;
    defaultSetType: { multiplier: unknown };
    exercise: {
      primaryMuscles: Array<{ muscleId: string; muscle: { name: string; sortOrder: number } }>;
      secondaryMuscles: Array<{ muscleId: string; muscle: { name: string; sortOrder: number } }>;
    };
  }>;
}) {
  const secondaryContribution = Number(args.program.secondaryContribution);
  const rows = new Map<string, { muscleId: string; muscleName: string; sortOrder: number; direct: number; effective: number; target: number | null }>();
  const targets = new Map(
    (args.program.volumeTargets ?? []).map((target) => [target.muscleId, Number(target.weeklyTargetSets)]),
  );
  const windowDays = volumeWindowDays(args.program.volumeWindowType, args.program.customWindowDays ?? null);

  for (const item of args.templateExercises) {
    const multiplier = Number(item.defaultSetType.multiplier);
    for (const link of item.exercise.primaryMuscles) {
      const row = rows.get(link.muscleId) ?? {
        muscleId: link.muscleId,
        muscleName: link.muscle.name,
        sortOrder: link.muscle.sortOrder,
        direct: 0,
        effective: 0,
        target: targets.has(link.muscleId) ? (Number(targets.get(link.muscleId)) * windowDays) / 7 : null,
      };
      row.direct += item.plannedSets;
      row.effective += item.plannedSets * multiplier;
      rows.set(link.muscleId, row);
    }
    for (const link of item.exercise.secondaryMuscles) {
      const row = rows.get(link.muscleId) ?? {
        muscleId: link.muscleId,
        muscleName: link.muscle.name,
        sortOrder: link.muscle.sortOrder,
        direct: 0,
        effective: 0,
        target: targets.has(link.muscleId) ? (Number(targets.get(link.muscleId)) * windowDays) / 7 : null,
      };
      row.effective += item.plannedSets * multiplier * secondaryContribution;
      rows.set(link.muscleId, row);
    }
  }

  return Array.from(rows.values()).sort((a, b) => a.sortOrder - b.sortOrder);
}


export function buildTemplateTargetNotices(args: {
  program: {
    volumeWindowType: VolumeWindowType;
    customWindowDays?: number | null;
    volumeTargets?: Array<{ muscleId: string; weeklyTargetSets: unknown; muscle: { name: string; sortOrder: number } }>;
    priorityMuscles?: Array<{ muscleId: string }>;
  };
  preview: Array<{ muscleId: string; muscleName: string; effective: number; target: number | null }>;
}) {
  const previewByMuscle = new Map(args.preview.map((row) => [row.muscleId, row]));
  const priorityMuscleIds = new Set((args.program.priorityMuscles ?? []).map((link) => link.muscleId));
  const windowDays = volumeWindowDays(args.program.volumeWindowType, args.program.customWindowDays ?? null);

  return (args.program.volumeTargets ?? [])
    .map((target) => {
      const selectedWindowTarget = (Number(target.weeklyTargetSets) * windowDays) / 7;
      const effective = previewByMuscle.get(target.muscleId)?.effective ?? 0;
      const ratio = selectedWindowTarget > 0 ? effective / selectedWindowTarget : 1;
      const status = ratio < 0.85 ? "below" : ratio > 1.35 ? "excessive" : ratio > 1.15 ? "above" : "on";
      return {
        muscleId: target.muscleId,
        muscleName: target.muscle.name,
        sortOrder: target.muscle.sortOrder,
        effective,
        target: selectedWindowTarget,
        ratio,
        status,
        isPriority: priorityMuscleIds.has(target.muscleId),
      };
    })
    .filter((notice) => notice.target > 0 && notice.status !== "on")
    .sort((a, b) => Number(b.isPriority) - Number(a.isPriority) || a.sortOrder - b.sortOrder);
}
