import type { VolumeWindowType } from "@/lib/types/domain";
import { volumeWindowDays } from "@/lib/programs/options";

type VolumePreviewProgram = {
  secondaryContribution: unknown;
  volumeWindowType: VolumeWindowType;
  customWindowDays?: number | null;
  volumeTargets?: Array<{
    muscleId: string;
    weeklyTargetSets: unknown;
    muscle: { name: string; sortOrder?: number };
  }>;
};

type VolumePreviewTemplateExercise = {
  plannedSets: number;
  occurrenceMultiplier?: unknown;
  defaultSetType: { multiplier: unknown };
  setPlans?: Array<{ setNumber: number; setType: { multiplier: unknown } }>;
  exercise: {
    primaryMuscles: Array<{ muscleId: string; muscle: { name: string; sortOrder: number } }>;
    secondaryMuscles: Array<{ muscleId: string; muscle: { name: string; sortOrder: number } }>;
  };
};

export type TemplateVolumePreviewRow = {
  muscleId: string;
  muscleName: string;
  sortOrder: number;
  direct: number;
  effective: number;
  target: number | null;
};

function setPlanMultipliers(item: VolumePreviewTemplateExercise) {
  const sortedPlans = [...(item.setPlans ?? [])].sort((a, b) => a.setNumber - b.setNumber).slice(0, item.plannedSets);
  if (sortedPlans.length > 0) {
    const multipliers = sortedPlans.map((plan) => Number(plan.setType.multiplier)).filter((value) => Number.isFinite(value));
    if (multipliers.length > 0) return multipliers;
  }

  const fallbackMultiplier = Number(item.defaultSetType.multiplier);
  const multiplier = Number.isFinite(fallbackMultiplier) ? fallbackMultiplier : 1;
  return Array.from({ length: item.plannedSets }, () => multiplier);
}

export function buildTemplateVolumePreview(args: {
  program: VolumePreviewProgram;
  templateExercises: VolumePreviewTemplateExercise[];
}) {
  const secondaryContribution = Number(args.program.secondaryContribution);
  const safeSecondaryContribution = Number.isFinite(secondaryContribution) ? secondaryContribution : 0;
  const rows = new Map<string, TemplateVolumePreviewRow>();
  const targets = new Map<string, number>(
    (args.program.volumeTargets ?? []).map((target) => [target.muscleId, Number(target.weeklyTargetSets)]),
  );
  const windowDays = volumeWindowDays(args.program.volumeWindowType, args.program.customWindowDays ?? null);

  for (const item of args.templateExercises) {
    const occurrenceMultiplier = Number(item.occurrenceMultiplier ?? 1);
    const safeOccurrenceMultiplier = Number.isFinite(occurrenceMultiplier) ? occurrenceMultiplier : 1;
    const directSets = item.plannedSets * safeOccurrenceMultiplier;
    const effectiveSetTotal = setPlanMultipliers(item).reduce((sum, multiplier) => sum + multiplier, 0) * safeOccurrenceMultiplier;

    for (const link of item.exercise.primaryMuscles) {
      const row = rows.get(link.muscleId) ?? {
        muscleId: link.muscleId,
        muscleName: link.muscle.name,
        sortOrder: link.muscle.sortOrder,
        direct: 0,
        effective: 0,
        target: targets.has(link.muscleId) ? ((targets.get(link.muscleId) ?? 0) * windowDays) / 7 : null,
      };
      row.direct += directSets;
      row.effective += effectiveSetTotal;
      rows.set(link.muscleId, row);
    }

    for (const link of item.exercise.secondaryMuscles) {
      const row = rows.get(link.muscleId) ?? {
        muscleId: link.muscleId,
        muscleName: link.muscle.name,
        sortOrder: link.muscle.sortOrder,
        direct: 0,
        effective: 0,
        target: targets.has(link.muscleId) ? ((targets.get(link.muscleId) ?? 0) * windowDays) / 7 : null,
      };
      row.effective += effectiveSetTotal * safeSecondaryContribution;
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
