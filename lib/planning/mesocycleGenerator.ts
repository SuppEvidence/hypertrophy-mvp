import {
  parseMesocycleStructureOverrides,
  type MesocycleStructureAction,
  type MesocycleStructureAddAction,
  type MesocycleStructureRemoveAction,
} from "@/lib/planning/mesocycleStructure";

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

export type GeneratorSetType = {
  id: string;
  name: string;
  slug?: string | null;
  multiplier: unknown;
  isIntensifier: boolean;
  sortOrder?: number;
};

export type GeneratorTemplate = {
  id: string;
  name: string;
  sequenceIndex: number;
  expectedOccurrences: unknown;
};

export type GeneratorMovementExerciseDefault = {
  exerciseId: string;
  exerciseName: string;
  movementGroupId: string;
  movementGroupName: string;
  movementGroupSortOrder: number;
  defaultMinReps?: number | null;
  defaultMaxReps?: number | null;
  primaryMuscles: Array<{ muscleId: string; muscleName: string; sortOrder: number }>;
  secondaryMuscles: Array<{ muscleId: string; muscleName: string; sortOrder: number }>;
};

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
      movementVolumeTargets?: Array<{
        movementGroupId: string;
        movementGroupName: string;
        sortOrder: number;
        targetSets: unknown;
      }>;
      structureOverrides?: unknown;
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
  defaultSetTypeIsIntensifier?: boolean;
  setPlans: Array<{ setNumber: number; setTypeId: string; multiplier: unknown; isIntensifier?: boolean }>;
  slotPriority?: string | null;
  slotRole?: string | null;
  repBucket?: string | null;
  autoAdjustable?: boolean;
  primaryMuscles: Array<{ muscleId: string; muscleName: string; sortOrder: number }>;
  secondaryMuscles: Array<{ muscleId: string; muscleName: string; sortOrder: number }>;
};

export type MesocycleAddedSetPlan = {
  setNumber: number;
  setTypeId: string;
  multiplier: number;
  isIntensifier: boolean;
};

export type GeneratedPrescriptionItem = GeneratorTemplateExercise & {
  basePlannedSets: number;
  adjustedPlannedSets: number;
  adjustmentDelta: number;
  prescribedMinReps: number | null;
  prescribedMaxReps: number | null;
  adjustmentReason: string | null;
  mesocycleAddedSetPlans: MesocycleAddedSetPlan[];
  isMesocycleVirtualSlot: boolean;
  isMesocycleSuppressed: boolean;
  mesocycleStructureActionId: string | null;
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

export type GeneratedMovementVolumeRow = {
  movementGroupId: string;
  movementGroupName: string;
  sortOrder: number;
  target: number | null;
  base: number;
  planned: number;
  delta: number;
};

export type MesocycleStructureProposal = {
  id: string;
  type: "ADD_SLOT" | "REMOVE_SLOT";
  movementGroupId: string;
  movementGroupName: string;
  templateId: string;
  templateName: string;
  targetEffectiveSets: number;
  currentEffectiveSets: number;
  projectedEffectiveSets: number;
  physicalSets: number;
  setTypeSummary: string | null;
  reason: string;
  action: MesocycleStructureAction;
};

export type MesocycleApprovedStructureSummary = {
  id: string;
  type: "ADD_SLOT" | "REMOVE_SLOT";
  movementGroupId: string;
  movementGroupName: string;
  templateId: string;
  templateName: string;
  description: string;
};

function toNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function appendReason(current: string | null, next: string) {
  return current ? `${current}; ${next}` : next;
}

function repPolicyFor(bucket: string | null | undefined, policies: Array<{ repBucket: string; minReps: number; maxReps: number }>) {
  if (!bucket) return null;
  return policies.find((policy) => policy.repBucket === bucket) ?? null;
}

function movementRepPolicyFor(movementGroupId: string, policies: Array<{ movementGroupId: string; minReps: number; maxReps: number }>) {
  return policies.find((policy) => policy.movementGroupId === movementGroupId) ?? null;
}

function setTypeMap(setTypes: GeneratorSetType[]) {
  return new Map(setTypes.map((setType) => [setType.id, setType]));
}

function normalSetType(setTypes: GeneratorSetType[]) {
  return (
    setTypes.find((setType) => setType.slug === "normal" && !setType.isIntensifier) ??
    setTypes.find((setType) => !setType.isIntensifier && Math.abs(toNumber(setType.multiplier, 1) - 1) < 0.001) ??
    setTypes.find((setType) => !setType.isIntensifier) ??
    setTypes[0] ??
    null
  );
}

function baseSetPlanFor(item: GeneratorTemplateExercise, setNumber: number) {
  const plan = item.setPlans.find((row) => row.setNumber === setNumber);
  return {
    setTypeId: plan?.setTypeId ?? item.defaultSetTypeId,
    multiplier: Math.max(0, toNumber(plan?.multiplier ?? item.defaultSetTypeMultiplier, 1)),
    isIntensifier: plan?.isIntensifier ?? item.defaultSetTypeIsIntensifier ?? false,
  };
}

function setPlanFor(item: GeneratedPrescriptionItem, setNumber: number) {
  const mesocyclePlan = item.mesocycleAddedSetPlans.find((row) => row.setNumber === setNumber);
  if (mesocyclePlan) return mesocyclePlan;
  return baseSetPlanFor(item, setNumber);
}

function plannedEffectiveForSets(item: GeneratedPrescriptionItem, sets: number) {
  let total = 0;
  for (let setNumber = 1; setNumber <= Math.max(0, sets); setNumber += 1) {
    total += setPlanFor(item, setNumber).multiplier;
  }
  return round2(total);
}

function baseEffectiveForSets(item: GeneratorTemplateExercise, sets: number) {
  let total = 0;
  for (let setNumber = 1; setNumber <= Math.max(0, sets); setNumber += 1) {
    total += baseSetPlanFor(item, setNumber).multiplier;
  }
  return round2(total);
}

function occurrence(item: GeneratorTemplateExercise) {
  return Math.max(0, toNumber(item.expectedOccurrences, 1));
}

function contributionFactor(item: GeneratorTemplateExercise, muscleId: string, secondaryContribution: number) {
  if (item.primaryMuscles.some((link) => link.muscleId === muscleId)) return 1;
  if (item.secondaryMuscles.some((link) => link.muscleId === muscleId)) return secondaryContribution;
  return 0;
}

function contributionToMuscle(item: GeneratedPrescriptionItem, muscleId: string, sets: number, secondaryContribution: number) {
  const factor = contributionFactor(item, muscleId, secondaryContribution);
  if (factor <= 0) return 0;
  return plannedEffectiveForSets(item, sets) * factor;
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

function addContributions(rows: Map<string, GeneratedVolumeRow>, item: GeneratedPrescriptionItem, sets: number, secondaryContribution: number, key: "base" | "planned") {
  const effective = key === "base" ? baseEffectiveForSets(item, sets) : plannedEffectiveForSets(item, sets);
  const primaryContribution = effective * occurrence(item);
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

function itemHasIntensifier(item: GeneratedPrescriptionItem) {
  for (let setNumber = 1; setNumber <= item.adjustedPlannedSets; setNumber += 1) {
    if (setPlanFor(item, setNumber).isIntensifier) return true;
  }
  return false;
}

function chooseAddedSetType(args: {
  item: GeneratedPrescriptionItem;
  desiredEffectivePerOccurrence: number;
  setTypes: GeneratorSetType[];
}) {
  const { item, setTypes } = args;
  const desired = Math.max(0.05, args.desiredEffectivePerOccurrence);
  const byId = setTypeMap(setTypes);
  const fallbackNormal = normalSetType(setTypes);
  const itemDefault = byId.get(item.defaultSetTypeId) ?? null;
  const hasIntensifier = itemHasIntensifier(item);

  const candidates = setTypes.filter((setType) => {
    const multiplier = toNumber(setType.multiplier, 1);
    if (multiplier <= 0) return false;
    if (setType.isIntensifier && hasIntensifier) return false;
    return true;
  });

  const preferredNormal = itemDefault && !itemDefault.isIntensifier ? itemDefault : fallbackNormal;
  if (preferredNormal && !candidates.some((candidate) => candidate.id === preferredNormal.id)) candidates.push(preferredNormal);

  const sorted = candidates.sort((a, b) => {
    const aMultiplier = toNumber(a.multiplier, 1);
    const bMultiplier = toNumber(b.multiplier, 1);
    const aGap = Math.abs(desired - aMultiplier);
    const bGap = Math.abs(desired - bMultiplier);
    if (Math.abs(aGap - bGap) > 0.001) return aGap - bGap;

    const preferIntensifier = desired > 1.25;
    if (a.isIntensifier !== b.isIntensifier) {
      if (preferIntensifier) return Number(b.isIntensifier) - Number(a.isIntensifier);
      return Number(a.isIntensifier) - Number(b.isIntensifier);
    }
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });

  const selected = sorted[0] ?? preferredNormal ?? itemDefault;
  if (!selected) {
    return {
      setTypeId: item.defaultSetTypeId,
      multiplier: Math.max(0, toNumber(item.defaultSetTypeMultiplier, 1)),
      isIntensifier: item.defaultSetTypeIsIntensifier ?? false,
    };
  }

  return {
    setTypeId: selected.id,
    multiplier: Math.max(0, toNumber(selected.multiplier, 1)),
    isIntensifier: selected.isIntensifier,
  };
}

function addOneSet(args: {
  item: GeneratedPrescriptionItem;
  desiredEffectivePerOccurrence: number;
  setTypes: GeneratorSetType[];
  reason: string;
}) {
  const { item } = args;
  const bounds = setBounds(item);
  if (item.isMesocycleSuppressed || item.adjustedPlannedSets >= bounds.max) return false;
  const nextSetNumber = item.adjustedPlannedSets + 1;

  if (!item.setPlans.some((plan) => plan.setNumber === nextSetNumber) && nextSetNumber > item.plannedSets) {
    const selected = chooseAddedSetType({
      item,
      desiredEffectivePerOccurrence: args.desiredEffectivePerOccurrence,
      setTypes: args.setTypes,
    });
    item.mesocycleAddedSetPlans = item.mesocycleAddedSetPlans.filter((plan) => plan.setNumber !== nextSetNumber);
    item.mesocycleAddedSetPlans.push({ setNumber: nextSetNumber, ...selected });
    item.mesocycleAddedSetPlans.sort((a, b) => a.setNumber - b.setNumber);
  }

  item.adjustedPlannedSets += 1;
  item.adjustmentDelta = item.adjustedPlannedSets - item.basePlannedSets;
  item.adjustmentReason = appendReason(item.adjustmentReason, args.reason);
  return true;
}

function removeOneSet(item: GeneratedPrescriptionItem, reason: string) {
  const bounds = setBounds(item);
  if (item.isMesocycleSuppressed || item.adjustedPlannedSets <= bounds.min) return false;
  const removedSetNumber = item.adjustedPlannedSets;
  item.adjustedPlannedSets -= 1;
  item.mesocycleAddedSetPlans = item.mesocycleAddedSetPlans.filter((plan) => plan.setNumber <= item.adjustedPlannedSets);
  item.adjustmentDelta = item.adjustedPlannedSets - item.basePlannedSets;
  item.adjustmentReason = appendReason(item.adjustmentReason, reason);
  return removedSetNumber > 0;
}

function movementRows(args: {
  program: GeneratorProgram;
  mesocycle: GeneratorMesocycle;
  items: GeneratedPrescriptionItem[];
}) {
  const rows = new Map<string, GeneratedMovementVolumeRow>();
  for (const target of args.mesocycle?.movementVolumeTargets ?? []) {
    rows.set(target.movementGroupId, {
      movementGroupId: target.movementGroupId,
      movementGroupName: target.movementGroupName,
      sortOrder: target.sortOrder,
      target: round((toNumber(target.targetSets) * args.program.volumeWindowDays) / 7),
      base: 0,
      planned: 0,
      delta: 0,
    });
  }

  for (const item of args.items) {
    const row = rows.get(item.movementGroupId) ?? {
      movementGroupId: item.movementGroupId,
      movementGroupName: item.movementGroupName,
      sortOrder: item.movementGroupSortOrder,
      target: null,
      base: 0,
      planned: 0,
      delta: 0,
    };
    row.base += baseEffectiveForSets(item, item.basePlannedSets) * occurrence(item);
    if (!item.isMesocycleSuppressed) row.planned += plannedEffectiveForSets(item, item.adjustedPlannedSets) * occurrence(item);
    rows.set(item.movementGroupId, row);
  }

  for (const row of rows.values()) {
    row.base = round(row.base);
    row.planned = round(row.planned);
    row.delta = round(row.planned - row.base);
  }
  return rows;
}

function templatePhysicalLoad(items: GeneratedPrescriptionItem[], templateId: string) {
  return items
    .filter((item) => item.templateId === templateId && !item.isMesocycleSuppressed)
    .reduce((sum, item) => sum + Math.max(0, item.adjustedPlannedSets), 0);
}

function appliedAddItem(args: {
  action: MesocycleStructureAddAction;
  mesocycleId: string;
  templates: GeneratorTemplate[];
  baseItems: GeneratedPrescriptionItem[];
  movementDefaults: GeneratorMovementExerciseDefault[];
  setTypes: GeneratorSetType[];
  repPolicies: Array<{ repBucket: string; minReps: number; maxReps: number }>;
  movementRepPolicies: Array<{ movementGroupId: string; minReps: number; maxReps: number }>;
}) {
  const template = args.templates.find((row) => row.id === args.action.templateId);
  if (!template) return null;
  const source = args.baseItems.find((row) => row.id === args.action.sourceTemplateExerciseId) ??
    args.baseItems.find((row) => row.movementGroupId === args.action.movementGroupId && !row.isMesocycleVirtualSlot) ?? null;
  const actionExercise = args.movementDefaults.find(
    (row) => row.movementGroupId === args.action.movementGroupId && row.exerciseId === args.action.exerciseId,
  ) ?? null;
  const fallback = actionExercise ?? args.movementDefaults.find((row) => row.movementGroupId === args.action.movementGroupId) ?? null;
  if (!source && !fallback) return null;

  const setTypeById = setTypeMap(args.setTypes);
  const defaultSetType = setTypeById.get(args.action.defaultSetTypeId) ?? normalSetType(args.setTypes);
  if (!defaultSetType) return null;

  const movementGroupId = args.action.movementGroupId;
  const movementGroupName = source?.movementGroupName ?? fallback?.movementGroupName ?? "Movement slot";
  const movementGroupSortOrder = source?.movementGroupSortOrder ?? fallback?.movementGroupSortOrder ?? 0;
  const repBucket = source?.repBucket ?? "ISOLATION";
  const movementPolicy = movementRepPolicyFor(movementGroupId, args.movementRepPolicies);
  const bucketPolicy = repPolicyFor(repBucket, args.repPolicies);
  const setPlans = args.action.setPlans
    .map((plan) => {
      const setType = setTypeById.get(plan.setTypeId);
      if (!setType) return null;
      return {
        setNumber: plan.setNumber,
        setTypeId: setType.id,
        multiplier: toNumber(setType.multiplier, 1),
        isIntensifier: setType.isIntensifier,
      };
    })
    .filter((plan): plan is NonNullable<typeof plan> => Boolean(plan));

  const item: GeneratedPrescriptionItem = {
    id: `mesocycle-virtual:${args.mesocycleId}:${args.action.id}`,
    templateId: template.id,
    templateName: template.name,
    templateSequenceIndex: template.sequenceIndex,
    expectedOccurrences: template.expectedOccurrences,
    exerciseId: actionExercise?.exerciseId ?? source?.exerciseId ?? fallback?.exerciseId ?? args.action.exerciseId,
    exerciseName: actionExercise?.exerciseName ?? source?.exerciseName ?? fallback?.exerciseName ?? "Exercise",
    movementGroupId,
    movementGroupName,
    movementGroupSortOrder,
    defaultMinReps: actionExercise?.defaultMinReps ?? source?.defaultMinReps ?? fallback?.defaultMinReps ?? null,
    defaultMaxReps: actionExercise?.defaultMaxReps ?? source?.defaultMaxReps ?? fallback?.defaultMaxReps ?? null,
    sortOrder: 1000 + template.sequenceIndex * 100 + args.baseItems.filter((row) => row.templateId === template.id).length,
    plannedSets: args.action.plannedSets,
    minSets: 0,
    maxSets: args.action.maxSets,
    minReps: source?.minReps ?? null,
    maxReps: source?.maxReps ?? null,
    rirTarget: source?.rirTarget ?? null,
    defaultSetTypeId: defaultSetType.id,
    defaultSetTypeMultiplier: defaultSetType.multiplier,
    defaultSetTypeIsIntensifier: defaultSetType.isIntensifier,
    setPlans,
    slotPriority: source?.slotPriority ?? "STANDARD",
    slotRole: source?.slotRole ?? "ISOLATION",
    repBucket,
    autoAdjustable: true,
    primaryMuscles: actionExercise?.primaryMuscles ?? source?.primaryMuscles ?? fallback?.primaryMuscles ?? [],
    secondaryMuscles: actionExercise?.secondaryMuscles ?? source?.secondaryMuscles ?? fallback?.secondaryMuscles ?? [],
    basePlannedSets: 0,
    adjustedPlannedSets: args.action.plannedSets,
    adjustmentDelta: args.action.plannedSets,
    prescribedMinReps: movementPolicy?.minReps ?? bucketPolicy?.minReps ?? source?.minReps ?? fallback?.defaultMinReps ?? null,
    prescribedMaxReps: movementPolicy?.maxReps ?? bucketPolicy?.maxReps ?? source?.maxReps ?? fallback?.defaultMaxReps ?? null,
    adjustmentReason: "Approved mesocycle-only movement slot",
    mesocycleAddedSetPlans: [],
    isMesocycleVirtualSlot: true,
    isMesocycleSuppressed: false,
    mesocycleStructureActionId: args.action.id,
  };
  return item;
}

function applyStructureActions(args: {
  items: GeneratedPrescriptionItem[];
  mesocycle: NonNullable<GeneratorMesocycle>;
  templates: GeneratorTemplate[];
  movementDefaults: GeneratorMovementExerciseDefault[];
  setTypes: GeneratorSetType[];
}) {
  const state = parseMesocycleStructureOverrides(args.mesocycle.structureOverrides);
  const approved: MesocycleApprovedStructureSummary[] = [];

  for (const action of state.actions) {
    if (action.type === "REMOVE_SLOT") {
      const item = args.items.find((row) => row.id === action.templateExerciseId && row.templateId === action.templateId);
      if (!item) continue;
      item.isMesocycleSuppressed = true;
      item.adjustedPlannedSets = 0;
      item.adjustmentDelta = -item.basePlannedSets;
      item.adjustmentReason = appendReason(item.adjustmentReason, "Removed for this mesocycle by approved structure change");
      item.mesocycleStructureActionId = action.id;
      approved.push({
        id: action.id,
        type: action.type,
        movementGroupId: item.movementGroupId,
        movementGroupName: item.movementGroupName,
        templateId: item.templateId,
        templateName: item.templateName,
        description: `Remove ${item.movementGroupName} from ${item.templateName} for this mesocycle`,
      });
      continue;
    }

    const added = appliedAddItem({
      action,
      mesocycleId: args.mesocycle.id,
      templates: args.templates,
      baseItems: args.items,
      movementDefaults: args.movementDefaults,
      setTypes: args.setTypes,
      repPolicies: args.mesocycle.repPolicies,
      movementRepPolicies: args.mesocycle.movementRepPolicies ?? [],
    });
    if (!added) continue;
    args.items.push(added);
    approved.push({
      id: action.id,
      type: action.type,
      movementGroupId: added.movementGroupId,
      movementGroupName: added.movementGroupName,
      templateId: added.templateId,
      templateName: added.templateName,
      description: `Add ${added.movementGroupName} to ${added.templateName} for this mesocycle`,
    });
  }

  return approved;
}

function structuralAddProposal(args: {
  mesocycle: NonNullable<GeneratorMesocycle>;
  movementRow: GeneratedMovementVolumeRow;
  items: GeneratedPrescriptionItem[];
  templates: GeneratorTemplate[];
  movementDefaults: GeneratorMovementExerciseDefault[];
  setTypes: GeneratorSetType[];
}) : MesocycleStructureProposal | null {
  if (args.movementRow.target === null || args.movementRow.planned >= args.movementRow.target - 0.1) return null;
  const remainingWindow = args.movementRow.target - args.movementRow.planned;
  const currentMovementItems = args.items.filter(
    (item) => item.movementGroupId === args.movementRow.movementGroupId && !item.isMesocycleSuppressed,
  );
  const source = currentMovementItems.find((item) => !item.isMesocycleVirtualSlot) ?? currentMovementItems[0] ?? null;
  const fallback = args.movementDefaults.find((row) => row.movementGroupId === args.movementRow.movementGroupId) ?? null;
  if (!source && !fallback) return null;

  const template = [...args.templates].sort((a, b) => {
    const loadDelta = templatePhysicalLoad(args.items, a.id) - templatePhysicalLoad(args.items, b.id);
    if (loadDelta !== 0) return loadDelta;
    const aHasMovement = currentMovementItems.some((item) => item.templateId === a.id);
    const bHasMovement = currentMovementItems.some((item) => item.templateId === b.id);
    if (aHasMovement !== bHasMovement) return Number(aHasMovement) - Number(bHasMovement);
    return a.sequenceIndex - b.sequenceIndex;
  })[0];
  if (!template) return null;

  const occurrenceValue = Math.max(0.1, toNumber(template.expectedOccurrences, 1));
  const desiredPerOccurrence = remainingWindow / occurrenceValue;
  const setTypes = args.setTypes;
  const fallbackNormal = normalSetType(setTypes);
  const defaultSetType = source
    ? setTypes.find((setType) => setType.id === source.defaultSetTypeId && !setType.isIntensifier) ?? fallbackNormal
    : fallbackNormal;
  if (!defaultSetType) return null;

  const maxSets = Math.max(1, Math.min(6, Math.max(source?.maxSets ?? 0, source?.plannedSets ?? 0, 3)));
  const synthetic: GeneratedPrescriptionItem = {
    ...(source ?? {
      id: "proposal-source",
      templateId: template.id,
      templateName: template.name,
      templateSequenceIndex: template.sequenceIndex,
      expectedOccurrences: template.expectedOccurrences,
      exerciseId: fallback?.exerciseId ?? "",
      exerciseName: fallback?.exerciseName ?? "Exercise",
      movementGroupId: fallback?.movementGroupId ?? args.movementRow.movementGroupId,
      movementGroupName: fallback?.movementGroupName ?? args.movementRow.movementGroupName,
      movementGroupSortOrder: fallback?.movementGroupSortOrder ?? args.movementRow.sortOrder,
      defaultMinReps: fallback?.defaultMinReps ?? null,
      defaultMaxReps: fallback?.defaultMaxReps ?? null,
      sortOrder: 0,
      plannedSets: 0,
      minSets: 0,
      maxSets,
      minReps: null,
      maxReps: null,
      rirTarget: null,
      defaultSetTypeId: defaultSetType.id,
      defaultSetTypeMultiplier: defaultSetType.multiplier,
      defaultSetTypeIsIntensifier: defaultSetType.isIntensifier,
      setPlans: [],
      slotPriority: "STANDARD",
      slotRole: "ISOLATION",
      repBucket: "ISOLATION",
      autoAdjustable: true,
      primaryMuscles: fallback?.primaryMuscles ?? [],
      secondaryMuscles: fallback?.secondaryMuscles ?? [],
    }),
    id: "proposal-source",
    templateId: template.id,
    templateName: template.name,
    templateSequenceIndex: template.sequenceIndex,
    expectedOccurrences: template.expectedOccurrences,
    plannedSets: 0,
    minSets: 0,
    maxSets,
    defaultSetTypeId: defaultSetType.id,
    defaultSetTypeMultiplier: defaultSetType.multiplier,
    defaultSetTypeIsIntensifier: defaultSetType.isIntensifier,
    setPlans: [],
    basePlannedSets: 0,
    adjustedPlannedSets: 0,
    adjustmentDelta: 0,
    prescribedMinReps: null,
    prescribedMaxReps: null,
    adjustmentReason: null,
    mesocycleAddedSetPlans: [],
    isMesocycleVirtualSlot: true,
    isMesocycleSuppressed: false,
    mesocycleStructureActionId: null,
  };

  let remainingPerOccurrence = desiredPerOccurrence;
  while (synthetic.adjustedPlannedSets < maxSets && remainingPerOccurrence > 0.1) {
    const nextNumber = synthetic.adjustedPlannedSets + 1;
    const selected = chooseAddedSetType({ item: synthetic, desiredEffectivePerOccurrence: remainingPerOccurrence, setTypes });
    synthetic.mesocycleAddedSetPlans.push({ setNumber: nextNumber, ...selected });
    synthetic.adjustedPlannedSets += 1;
    remainingPerOccurrence -= selected.multiplier;
  }

  if (synthetic.adjustedPlannedSets < 1) return null;
  const recommendedEffectiveWindow = plannedEffectiveForSets(synthetic, synthetic.adjustedPlannedSets) * occurrenceValue;
  const setPlans = synthetic.mesocycleAddedSetPlans.map((plan) => ({ setNumber: plan.setNumber, setTypeId: plan.setTypeId }));
  const actionId = `add:${args.mesocycle.id}:${args.movementRow.movementGroupId}:${template.id}`;
  const action: MesocycleStructureAddAction = {
    id: actionId,
    type: "ADD_SLOT",
    templateId: template.id,
    movementGroupId: args.movementRow.movementGroupId,
    sourceTemplateExerciseId: source && !source.isMesocycleVirtualSlot ? source.id : null,
    exerciseId: source?.exerciseId ?? fallback?.exerciseId ?? "",
    defaultSetTypeId: defaultSetType.id,
    plannedSets: synthetic.adjustedPlannedSets,
    maxSets,
    setPlans,
  };

  const setTypeById = setTypeMap(setTypes);
  const setTypeSummary = setPlans
    .map((plan) => setTypeById.get(plan.setTypeId)?.name ?? "Set")
    .join(" + ");

  return {
    id: actionId,
    type: "ADD_SLOT",
    movementGroupId: args.movementRow.movementGroupId,
    movementGroupName: args.movementRow.movementGroupName,
    templateId: template.id,
    templateName: template.name,
    targetEffectiveSets: round(args.movementRow.target),
    currentEffectiveSets: round(args.movementRow.planned),
    projectedEffectiveSets: round(args.movementRow.planned + recommendedEffectiveWindow),
    physicalSets: synthetic.adjustedPlannedSets,
    setTypeSummary: setTypeSummary || null,
    reason: `Existing ${args.movementRow.movementGroupName} slots are already at their allowed set capacity.`,
    action,
  };
}

function structuralRemoveProposal(args: {
  mesocycle: NonNullable<GeneratorMesocycle>;
  movementRow: GeneratedMovementVolumeRow;
  items: GeneratedPrescriptionItem[];
}) : MesocycleStructureProposal | null {
  if (args.movementRow.target === null || args.movementRow.planned <= args.movementRow.target + 0.1) return null;
  const currentGap = Math.abs(args.movementRow.planned - args.movementRow.target);
  const candidates = args.items
    .filter((item) => item.movementGroupId === args.movementRow.movementGroupId)
    .filter((item) => !item.isMesocycleSuppressed && !item.isMesocycleVirtualSlot && item.adjustedPlannedSets > 0)
    .map((item) => {
      const contribution = plannedEffectiveForSets(item, item.adjustedPlannedSets) * occurrence(item);
      const projected = Math.max(0, args.movementRow.planned - contribution);
      return { item, contribution, projected, gap: Math.abs(projected - args.movementRow.target!) };
    })
    .filter((candidate) => candidate.gap + 0.05 < currentGap)
    .sort((a, b) => {
      const priorityDelta = removeScore(a.item) - removeScore(b.item);
      if (priorityDelta !== 0) return priorityDelta;
      const gapDelta = a.gap - b.gap;
      if (Math.abs(gapDelta) > 0.01) return gapDelta;
      const loadDelta = templatePhysicalLoad(args.items, b.item.templateId) - templatePhysicalLoad(args.items, a.item.templateId);
      if (loadDelta !== 0) return loadDelta;
      return b.item.templateSequenceIndex - a.item.templateSequenceIndex;
    });
  const selected = candidates[0];
  if (!selected) return null;

  const actionId = `remove:${args.mesocycle.id}:${selected.item.id}`;
  const action: MesocycleStructureRemoveAction = {
    id: actionId,
    type: "REMOVE_SLOT",
    templateId: selected.item.templateId,
    movementGroupId: selected.item.movementGroupId,
    templateExerciseId: selected.item.id,
  };
  return {
    id: actionId,
    type: "REMOVE_SLOT",
    movementGroupId: selected.item.movementGroupId,
    movementGroupName: selected.item.movementGroupName,
    templateId: selected.item.templateId,
    templateName: selected.item.templateName,
    targetEffectiveSets: round(args.movementRow.target),
    currentEffectiveSets: round(args.movementRow.planned),
    projectedEffectiveSets: round(selected.projected),
    physicalSets: selected.item.adjustedPlannedSets,
    setTypeSummary: null,
    reason: `The new target no longer needs every ${selected.item.movementGroupName} slot. The base template remains unchanged.`,
    action,
  };
}

export function generateMesocyclePrescription(args: {
  program: GeneratorProgram;
  mesocycle: GeneratorMesocycle;
  templateExercises: GeneratorTemplateExercise[];
  templates?: GeneratorTemplate[];
  setTypes?: GeneratorSetType[];
  movementDefaults?: GeneratorMovementExerciseDefault[];
}) {
  const secondaryContribution = toNumber(args.program.secondaryContribution, 0.5);
  const setTypes = args.setTypes ?? [];
  const templates = args.templates ?? [];
  const movementDefaults = args.movementDefaults ?? [];
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
      mesocycleAddedSetPlans: [],
      isMesocycleVirtualSlot: false,
      isMesocycleSuppressed: false,
      mesocycleStructureActionId: null,
    };
  });

  let approvedStructureActions: MesocycleApprovedStructureSummary[] = [];
  if (args.mesocycle) {
    approvedStructureActions = applyStructureActions({
      items,
      mesocycle: args.mesocycle,
      templates,
      movementDefaults,
      setTypes,
    });

    const targets = targetRows(args.program, args.mesocycle);
    const updateRows = () => {
      const rows = targetRows(args.program, args.mesocycle);
      for (const item of items) {
        addContributions(rows, item, item.basePlannedSets, secondaryContribution, "base");
        addContributions(rows, item, item.isMesocycleSuppressed ? 0 : item.adjustedPlannedSets, secondaryContribution, "planned");
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
        const current = rows.get(target.muscleId)?.planned ?? 0;
        const remaining = Math.max(0, (target.target ?? 0) - current);
        const candidates = items
          .filter((item) => !item.isMesocycleSuppressed)
          .filter((item) => contributionFactor(item, target.muscleId, secondaryContribution) > 0)
          .filter((item) => item.adjustedPlannedSets < setBounds(item).max)
          .sort((a, b) => addScore(a) - addScore(b) || a.adjustmentDelta - b.adjustmentDelta || templatePhysicalLoad(items, a.templateId) - templatePhysicalLoad(items, b.templateId) || a.templateSequenceIndex - b.templateSequenceIndex || a.sortOrder - b.sortOrder);
        const selected = candidates[0];
        if (!selected) break;
        const factor = contributionFactor(selected, target.muscleId, secondaryContribution);
        const desired = remaining / Math.max(0.1, occurrence(selected) * factor);
        if (!addOneSet({ item: selected, desiredEffectivePerOccurrence: desired, setTypes, reason: `+1 for ${target.muscleName}` })) break;
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
          .filter((item) => !item.isMesocycleSuppressed)
          .filter((item) => contributionFactor(item, target.muscleId, secondaryContribution) > 0)
          .filter((item) => item.adjustedPlannedSets > setBounds(item).min)
          .sort((a, b) => removeScore(a) - removeScore(b) || a.adjustmentDelta - b.adjustmentDelta || b.templateSequenceIndex - a.templateSequenceIndex || b.sortOrder - a.sortOrder);
        const selected = candidates[0];
        if (!selected || !removeOneSet(selected, `-1 for ${target.muscleName}`)) break;
        rows = updateRows();
      }
    }

    for (const movementTarget of args.mesocycle.movementVolumeTargets ?? []) {
      const targetWindow = round((toNumber(movementTarget.targetSets) * args.program.volumeWindowDays) / 7);
      if (targetWindow < 0) continue;
      let guard = 0;
      let movement = movementRows({ program: args.program, mesocycle: args.mesocycle, items }).get(movementTarget.movementGroupId);

      while ((movement?.planned ?? 0) < targetWindow - 0.1 && guard < 100) {
        guard += 1;
        const remaining = targetWindow - (movement?.planned ?? 0);
        const candidates = items
          .filter((item) => !item.isMesocycleSuppressed && item.movementGroupId === movementTarget.movementGroupId)
          .filter((item) => item.adjustedPlannedSets < setBounds(item).max)
          .sort((a, b) => a.adjustmentDelta - b.adjustmentDelta || templatePhysicalLoad(items, a.templateId) - templatePhysicalLoad(items, b.templateId) || a.templateSequenceIndex - b.templateSequenceIndex || a.sortOrder - b.sortOrder);
        const selected = candidates[0];
        if (!selected) break;
        const desired = remaining / Math.max(0.1, occurrence(selected));
        if (!addOneSet({
          item: selected,
          desiredEffectivePerOccurrence: desired,
          setTypes,
          reason: `+1 for ${movementTarget.movementGroupName} target`,
        })) break;
        movement = movementRows({ program: args.program, mesocycle: args.mesocycle, items }).get(movementTarget.movementGroupId);
      }

      guard = 0;
      movement = movementRows({ program: args.program, mesocycle: args.mesocycle, items }).get(movementTarget.movementGroupId);
      while ((movement?.planned ?? 0) > targetWindow + 0.1 && guard < 100) {
        guard += 1;
        const currentGap = Math.abs((movement?.planned ?? 0) - targetWindow);
        const candidates = items
          .filter((item) => !item.isMesocycleSuppressed && item.movementGroupId === movementTarget.movementGroupId)
          .filter((item) => item.adjustedPlannedSets > setBounds(item).min)
          .map((item) => {
            const currentContribution = plannedEffectiveForSets(item, item.adjustedPlannedSets) * occurrence(item);
            const reducedContribution = plannedEffectiveForSets(item, item.adjustedPlannedSets - 1) * occurrence(item);
            const projected = (movement?.planned ?? 0) - (currentContribution - reducedContribution);
            return { item, gap: Math.abs(projected - targetWindow) };
          })
          .filter((candidate) => candidate.gap + 0.05 < currentGap)
          .sort((a, b) => a.gap - b.gap || removeScore(a.item) - removeScore(b.item) || b.item.templateSequenceIndex - a.item.templateSequenceIndex);
        const selected = candidates[0]?.item;
        if (!selected || !removeOneSet(selected, `-1 for ${movementTarget.movementGroupName} target`)) break;
        movement = movementRows({ program: args.program, mesocycle: args.mesocycle, items }).get(movementTarget.movementGroupId);
      }
    }
  }

  const volumeRows = targetRows(args.program, args.mesocycle);
  for (const item of items) {
    addContributions(volumeRows, item, item.basePlannedSets, secondaryContribution, "base");
    addContributions(volumeRows, item, item.isMesocycleSuppressed ? 0 : item.adjustedPlannedSets, secondaryContribution, "planned");
  }

  const movementVolumeRows = Array.from(movementRows({ program: args.program, mesocycle: args.mesocycle, items }).values())
    .filter((row) => row.target !== null || row.base > 0 || row.planned > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const structureProposals: MesocycleStructureProposal[] = [];
  if (args.mesocycle) {
    const approvedIds = new Set(approvedStructureActions.map((action) => action.id));
    for (const row of movementVolumeRows.filter((entry) => entry.target !== null)) {
      let proposal: MesocycleStructureProposal | null = null;
      if ((row.target ?? 0) > row.planned + 0.1) {
        proposal = structuralAddProposal({
          mesocycle: args.mesocycle,
          movementRow: row,
          items,
          templates,
          movementDefaults,
          setTypes,
        });
      } else if ((row.target ?? 0) + 0.1 < row.planned) {
        proposal = structuralRemoveProposal({ mesocycle: args.mesocycle, movementRow: row, items });
      }
      if (proposal && !approvedIds.has(proposal.id)) structureProposals.push(proposal);
    }
  }

  return {
    mesocycleId: args.mesocycle?.id ?? null,
    items,
    volumeRows: Array.from(volumeRows.values())
      .map((row) => ({ ...row, base: round(row.base), planned: round(row.planned), delta: round(row.planned - row.base) }))
      .filter((row) => row.target !== null || row.base > 0 || row.planned > 0)
      .sort((a, b) => b.priorityLevel - a.priorityLevel || a.sortOrder - b.sortOrder),
    movementVolumeRows,
    structureProposals,
    approvedStructureActions,
  };
}
