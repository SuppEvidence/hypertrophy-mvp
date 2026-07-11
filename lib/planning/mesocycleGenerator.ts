export const repBuckets = [
  { value: "HEAVY_COMPOUND", label: "Heavy compound", defaultMin: 6, defaultMax: 10 },
  { value: "SECONDARY_COMPOUND", label: "Secondary compound", defaultMin: 8, defaultMax: 12 },
  { value: "ISOLATION", label: "Isolation", defaultMin: 10, defaultMax: 20 },
  { value: "LENGTHENED_ISOLATION", label: "Lengthened isolation", defaultMin: 10, defaultMax: 20 },
] as const;

export const slotRoles = [
  { value: "PRIMARY_COMPOUND", label: "Primary compound" },
  { value: "SECONDARY", label: "Secondary" },
  { value: "ISOLATION", label: "Isolation" },
  { value: "OPTIONAL_ACCESSORY", label: "Optional accessory" },
] as const;

export const slotPriorities = [
  { value: "CORE", label: "Core" },
  { value: "STANDARD", label: "Standard" },
  { value: "OPTIONAL", label: "Optional" },
] as const;

export type RepBucket = (typeof repBuckets)[number]["value"];
export type SlotRole = (typeof slotRoles)[number]["value"];
export type SlotPriority = (typeof slotPriorities)[number]["value"];

export type GeneratorProgram = {
  secondaryContribution: unknown;
  volumeWindowDays: number;
  volumeTargets: Array<{
    muscleId: string;
    muscleName: string;
    sortOrder: number;
    weeklyTargetSets: unknown;
    priorityLevel?: number;
  }>;
};

export type GeneratorMesocycle =
  | {
      id: string;
      volumeTargets: Array<{
        muscleId: string;
        muscleName: string;
        sortOrder: number;
        targetSets: unknown;
        minimumSets?: unknown;
        maximumSets?: unknown;
        priorityLevel?: number;
      }>;
      repPolicies: Array<{ repBucket: string; minReps: number; maxReps: number }>;
      movementRepPolicies?: Array<{ movementGroupId: string; minReps: number; maxReps: number }>;
    }
  | null;

export type GeneratorTemplateExercise = {
  id: string;
  templateId: string;
  templateName: string;
  templateSequenceIndex: number;
  expectedOccurrences: unknown;
  exerciseId: string;
  exerciseName: string;
  movementGroupId: string;
  movementGroupName: string;
  movementGroupSortOrder: number;
  defaultMinReps?: number | null;
  defaultMaxReps?: number | null;
  sortOrder: number;
  plannedSets: number;
  minSets?: number | null;
  maxSets?: number | null;
  minReps?: number | null;
  maxReps?: number | null;
  rirTarget?: unknown;
  defaultSetTypeId: string;
  defaultSetTypeMultiplier: unknown;
  setPlans: Array<{ setNumber: number; setTypeId: string; multiplier: unknown }>;
  slotPriority?: string | null;
  slotRole?: string | null;
  repBucket?: string | null;
  autoAdjustable?: boolean;
  primaryMuscles: Array<{ muscleId: string; muscleName: string; sortOrder: number }>;
  secondaryMuscles: Array<{ muscleId: string; muscleName: string; sortOrder: number }>;
};

export type GeneratedPrescriptionItem = GeneratorTemplateExercise & {
  basePlannedSets: number;
  adjustedPlannedSets: number;
  adjustmentDelta: number;
  prescribedMinReps: number | null;
  prescribedMaxReps: number | null;
  adjustmentReason: string | null;
};

export type GeneratedVolumeRow = {
  muscleId: string;
  muscleName: string;
  sortOrder: number;
  target: number | null;
  base: number;
  planned: number;
  delta: number;
  priorityLevel: number;
};

function toNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function repPolicyFor(bucket: string | null | undefined, policies: Array<{ repBucket: string; minReps: number; maxReps: number }>) {
  if (!bucket) return null;
  return policies.find((policy) => policy.repBucket === bucket) ?? null;
}

function movementRepPolicyFor(movementGroupId: string, policies: Array<{ movementGroupId: string; minReps: number; maxReps: number }>) {
  return policies.find((policy) => policy.movementGroupId === movementGroupId) ?? null;
}

function setEffectiveValue(item: GeneratorTemplateExercise, setNumber: number) {
  const plan = item.setPlans.find((row) => row.setNumber === setNumber);
  return toNumber(plan?.multiplier ?? item.defaultSetTypeMultiplier, 1);
}

function plannedEffectiveForSets(item: GeneratorTemplateExercise, sets: number) {
  let total = 0;
  for (let setNumber = 1; setNumber <= sets; setNumber += 1) {
    total += setEffectiveValue(item, setNumber);
  }
  return total;
}

function contributionToMuscle(item: GeneratorTemplateExercise, muscleId: string, sets: number, secondaryContribution: number) {
  const effective = plannedEffectiveForSets(item, sets);
  if (item.primaryMuscles.some((link) => link.muscleId === muscleId)) return effective;
  if (item.secondaryMuscles.some((link) => link.muscleId === muscleId)) return effective * secondaryContribution;
  return 0;
}

function setBounds(item: GeneratorTemplateExercise) {
  const base = item.plannedSets;
  const min = item.autoAdjustable ? Math.max(0, item.minSets ?? base) : base;
  const max = item.autoAdjustable ? Math.max(min, item.maxSets ?? base) : base;
  return { min, max };
}

function addScore(item: GeneratedPrescriptionItem) {
  const roleScore = item.slotRole === "OPTIONAL_ACCESSORY" ? 0 : item.slotRole === "ISOLATION" || item.slotRole === "LENGTHENED_ISOLATION" ? 1 : item.slotRole === "SECONDARY" ? 2 : 3;
  const priorityScore = item.slotPriority === "OPTIONAL" ? 0 : item.slotPriority === "STANDARD" ? 1 : 2;
  return roleScore * 10 + priorityScore;
}

function removeScore(item: GeneratedPrescriptionItem) {
  const priorityScore = item.slotPriority === "OPTIONAL" ? 0 : item.slotPriority === "STANDARD" ? 1 : 2;
  const roleScore = item.slotRole === "OPTIONAL_ACCESSORY" ? 0 : item.slotRole === "ISOLATION" || item.slotRole === "LENGTHENED_ISOLATION" ? 1 : item.slotRole === "SECONDARY" ? 2 : 3;
  return priorityScore * 10 + roleScore;
}

function targetRows(program: GeneratorProgram, mesocycle: GeneratorMesocycle) {
  const rows = new Map<string, GeneratedVolumeRow>();
  for (const target of program.volumeTargets) {
    rows.set(target.muscleId, {
      muscleId: target.muscleId,
      muscleName: target.muscleName,
      sortOrder: target.sortOrder,
      target: round((toNumber(target.weeklyTargetSets) * program.volumeWindowDays) / 7),
      base: 0,
      planned: 0,
      delta: 0,
      priorityLevel: target.priorityLevel ?? 0,
    });
  }

  for (const target of mesocycle?.volumeTargets ?? []) {
    const previous = rows.get(target.muscleId);
    const overrideTarget = toNumber(target.targetSets);
    rows.set(target.muscleId, {
      muscleId: target.muscleId,
      muscleName: target.muscleName,
      sortOrder: target.sortOrder,
      target: overrideTarget > 0 ? round((overrideTarget * program.volumeWindowDays) / 7) : previous?.target ?? 0,
      base: 0,
      planned: 0,
      delta: 0,
      priorityLevel: target.priorityLevel ?? 0,
    });
  }

  return rows;
}

function addContributions(rows: Map<string, GeneratedVolumeRow>, item: GeneratorTemplateExercise, sets: number, secondaryContribution: number, key: "base" | "planned") {
  const occurrence = toNumber(item.expectedOccurrences, 1);
  const primaryContribution = plannedEffectiveForSets(item, sets) * occurrence;
  for (const link of item.primaryMuscles) {
    const row = rows.get(link.muscleId) ?? {
      muscleId: link.muscleId,
      muscleName: link.muscleName,
      sortOrder: link.sortOrder,
      target: null,
      base: 0,
      planned: 0,
      delta: 0,
      priorityLevel: 0,
    };
    row[key] += primaryContribution;
    rows.set(link.muscleId, row);
  }

  const secondaryContributionValue = primaryContribution * secondaryContribution;
  for (const link of item.secondaryMuscles) {
    const row = rows.get(link.muscleId) ?? {
      muscleId: link.muscleId,
      muscleName: link.muscleName,
      sortOrder: link.sortOrder,
      target: null,
      base: 0,
      planned: 0,
      delta: 0,
      priorityLevel: 0,
    };
    row[key] += secondaryContributionValue;
    rows.set(link.muscleId, row);
  }
}

export function generateMesocyclePrescription(args: {
  program: GeneratorProgram;
  mesocycle: GeneratorMesocycle;
  templateExercises: GeneratorTemplateExercise[];
}) {
  const secondaryContribution = toNumber(args.program.secondaryContribution, 0.5);
  const items: GeneratedPrescriptionItem[] = args.templateExercises.map((item) => {
    const movementPolicy = movementRepPolicyFor(item.movementGroupId, args.mesocycle?.movementRepPolicies ?? []);
    const bucketPolicy = repPolicyFor(item.repBucket, args.mesocycle?.repPolicies ?? []);
    return {
      ...item,
      basePlannedSets: item.plannedSets,
      adjustedPlannedSets: item.plannedSets,
      adjustmentDelta: 0,
      prescribedMinReps: movementPolicy?.minReps ?? bucketPolicy?.minReps ?? item.minReps ?? item.defaultMinReps ?? null,
      prescribedMaxReps: movementPolicy?.maxReps ?? bucketPolicy?.maxReps ?? item.maxReps ?? item.defaultMaxReps ?? null,
      adjustmentReason: null,
    };
  });

  if (args.mesocycle) {
    const targets = targetRows(args.program, args.mesocycle);
    const updateRows = () => {
      const rows = targetRows(args.program, args.mesocycle);
      for (const item of items) {
        addContributions(rows, item, item.basePlannedSets, secondaryContribution, "base");
        addContributions(rows, item, item.adjustedPlannedSets, secondaryContribution, "planned");
      }
      for (const row of rows.values()) row.delta = row.planned - row.base;
      return rows;
    };

    let rows = updateRows();
    const orderedTargets = Array.from(targets.values())
      .filter((row) => row.target !== null && row.target > 0)
      .sort((a, b) => b.priorityLevel - a.priorityLevel || a.sortOrder - b.sortOrder);

    for (const target of orderedTargets) {
      let guard = 0;
      while ((rows.get(target.muscleId)?.planned ?? 0) < (target.target ?? 0) - 0.1 && guard < 100) {
        guard += 1;
        const candidates = items
          .filter((item) => contributionToMuscle(item, target.muscleId, 1, secondaryContribution) > 0)
          .filter((item) => item.adjustedPlannedSets < setBounds(item).max)
          .sort((a, b) => addScore(a) - addScore(b) || a.adjustmentDelta - b.adjustmentDelta || a.templateSequenceIndex - b.templateSequenceIndex || a.sortOrder - b.sortOrder);
        const selected = candidates[0];
        if (!selected) break;
        selected.adjustedPlannedSets += 1;
        selected.adjustmentDelta += 1;
        selected.adjustmentReason = selected.adjustmentReason ? `${selected.adjustmentReason}; +1 for ${target.muscleName}` : `+1 set for ${target.muscleName}`;
        rows = updateRows();
      }
    }

    const highTargets = Array.from(rows.values())
      .filter((row) => row.target !== null && row.target > 0 && row.planned > row.target * 1.15)
      .sort((a, b) => a.priorityLevel - b.priorityLevel || b.planned - (b.target ?? 0) - (a.planned - (a.target ?? 0)));

    for (const target of highTargets) {
      let guard = 0;
      while ((rows.get(target.muscleId)?.planned ?? 0) > (target.target ?? 0) * 1.15 && guard < 100) {
        guard += 1;
        const candidates = items
          .filter((item) => contributionToMuscle(item, target.muscleId, 1, secondaryContribution) > 0)
          .filter((item) => item.adjustedPlannedSets > setBounds(item).min)
          .sort((a, b) => removeScore(a) - removeScore(b) || a.adjustmentDelta - b.adjustmentDelta || b.templateSequenceIndex - a.templateSequenceIndex || b.sortOrder - a.sortOrder);
        const selected = candidates[0];
        if (!selected) break;
        selected.adjustedPlannedSets -= 1;
        selected.adjustmentDelta -= 1;
        selected.adjustmentReason = selected.adjustmentReason ? `${selected.adjustmentReason}; -1 for ${target.muscleName}` : `-1 set for ${target.muscleName}`;
        rows = updateRows();
      }
    }
  }

  const volumeRows = targetRows(args.program, args.mesocycle);
  for (const item of items) {
    addContributions(volumeRows, item, item.basePlannedSets, secondaryContribution, "base");
    addContributions(volumeRows, item, item.adjustedPlannedSets, secondaryContribution, "planned");
  }

  return {
    mesocycleId: args.mesocycle?.id ?? null,
    items,
    volumeRows: Array.from(volumeRows.values())
      .map((row) => ({ ...row, base: round(row.base), planned: round(row.planned), delta: round(row.planned - row.base) }))
      .filter((row) => row.target !== null || row.base > 0 || row.planned > 0)
      .sort((a, b) => b.priorityLevel - a.priorityLevel || a.sortOrder - b.sortOrder),
  };
}
