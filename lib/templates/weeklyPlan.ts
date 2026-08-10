export type StoredWeeklyPlan = {
  weekStart: string;
  missedTemplateIds: string[];
  recipientExcludedTemplateIds: string[];
};

export type WeeklyPlanSourceItem = {
  id: string;
  templateId: string;
  templateName: string;
  templateSequenceIndex: number;
  sortOrder: number;
  movementGroupId: string;
  movementGroupName: string;
  adjustedPlannedSets: number;
  maxSets?: number | null;
  defaultSetTypeId: string;
  defaultSetTypeMultiplier: unknown;
  setPlans: Array<{ setNumber: number; setTypeId: string; multiplier: unknown }>;
};

export type WeeklyAddedSetPlan = {
  setNumber: number;
  setTypeId: string;
  multiplier: number;
  sourceTemplateId: string;
  sourceTemplateName: string;
};

export type WeeklyAdjustedItem<T extends WeeklyPlanSourceItem> = T & {
  weeklyAdjustedPlannedSets: number;
  weeklyAdjustmentDelta: number;
  isMissedThisWeek: boolean;
  isWeeklyVirtualSlot: boolean;
  weeklyVirtualCapacity: number | null;
  weeklyAddedSetPlans: WeeklyAddedSetPlan[];
  weeklyEffectiveBase: number;
  weeklyEffectivePlanned: number;
  weeklyAdjustmentReason: string | null;
};

export type WeeklyPlanSummary = {
  weekStart: string;
  missedTemplateIds: string[];
  completedTemplateIds: string[];
  /** Backward-compatible aliases. These now represent effective-set units. */
  missedSets: number;
  reallocatedSets: number;
  unallocatedSets: number;
  missedPhysicalSets: number;
  reallocatedPhysicalSets: number;
  unallocatedPhysicalSets: number;
  missedEffectiveSets: number;
  reallocatedEffectiveSets: number;
  unallocatedEffectiveSets: number;
  virtualSlotsCreated: number;
};

export type WeeklyPlanTemplate = {
  id: string;
  name: string;
  sequenceIndex: number;
};

export function startOfIsoWeek(date = new Date()) {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  const day = value.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  value.setUTCDate(value.getUTCDate() - daysSinceMonday);
  return value;
}

export function endOfIsoWeek(date = new Date()) {
  const value = startOfIsoWeek(date);
  value.setUTCDate(value.getUTCDate() + 7);
  return value;
}

export function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function parseStoredWeeklyPlan(value: unknown, expectedWeekStart = toDateOnly(startOfIsoWeek())): StoredWeeklyPlan {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { weekStart: expectedWeekStart, missedTemplateIds: [], recipientExcludedTemplateIds: [] };
  }

  const candidate = value as { weekStart?: unknown; missedTemplateIds?: unknown; recipientExcludedTemplateIds?: unknown };
  const weekStart = typeof candidate.weekStart === "string" ? candidate.weekStart : expectedWeekStart;
  if (weekStart !== expectedWeekStart) {
    return { weekStart: expectedWeekStart, missedTemplateIds: [], recipientExcludedTemplateIds: [] };
  }

  const missedTemplateIds = Array.isArray(candidate.missedTemplateIds)
    ? Array.from(new Set(candidate.missedTemplateIds.filter((item): item is string => typeof item === "string" && item.length > 0)))
    : [];

  const recipientExcludedTemplateIds = Array.isArray(candidate.recipientExcludedTemplateIds)
    ? Array.from(new Set(candidate.recipientExcludedTemplateIds.filter((item): item is string => typeof item === "string" && item.length > 0)))
    : [];

  return { weekStart, missedTemplateIds, recipientExcludedTemplateIds };
}

function toNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundEffective(value: number) {
  return Math.round(value * 100) / 100;
}

function setPlanFor(item: WeeklyPlanSourceItem, setNumber: number) {
  const plan = item.setPlans.find((row) => row.setNumber === setNumber);
  return {
    setTypeId: plan?.setTypeId ?? item.defaultSetTypeId,
    multiplier: Math.max(0, toNumber(plan?.multiplier ?? item.defaultSetTypeMultiplier, 1)),
  };
}

function plannedEffective(item: WeeklyPlanSourceItem, sets: number) {
  let total = 0;
  for (let setNumber = 1; setNumber <= Math.max(0, sets); setNumber += 1) {
    total += setPlanFor(item, setNumber).multiplier;
  }
  return roundEffective(total);
}

function weeklyCapacity(item: WeeklyAdjustedItem<WeeklyPlanSourceItem>) {
  if (item.isWeeklyVirtualSlot && item.weeklyVirtualCapacity !== null) {
    return Math.max(0, item.weeklyVirtualCapacity);
  }
  const base = Math.max(0, item.adjustedPlannedSets);
  const explicitMax = item.maxSets === null || item.maxSets === undefined ? null : Math.max(0, item.maxSets);
  return Math.max(base, explicitMax ?? base + 1);
}

function hasMultiplierSet(item: WeeklyAdjustedItem<WeeklyPlanSourceItem>) {
  for (let setNumber = 1; setNumber <= item.adjustedPlannedSets; setNumber += 1) {
    if (setPlanFor(item, setNumber).multiplier > 1.0001) return true;
  }
  return item.weeklyAddedSetPlans.some((plan) => plan.multiplier > 1.0001);
}

function effectiveWithWeeklyAdds(item: WeeklyAdjustedItem<WeeklyPlanSourceItem>) {
  if (item.isMissedThisWeek) return 0;
  const base = plannedEffective(item, item.adjustedPlannedSets);
  return roundEffective(base + item.weeklyAddedSetPlans.reduce((sum, plan) => sum + plan.multiplier, 0));
}

function appendReason(current: string | null, next: string) {
  return current ? `${current}; ${next}` : next;
}

export function applyWeeklyMissedWorkoutPlan<T extends WeeklyPlanSourceItem>(args: {
  items: T[];
  templates?: WeeklyPlanTemplate[];
  weekStart: string;
  missedTemplateIds: string[];
  completedTemplateIds?: string[];
  recipientExcludedTemplateIds?: string[];
}) {
  const missedTemplateIds = Array.from(new Set(args.missedTemplateIds));
  const completedTemplateIds = Array.from(new Set(args.completedTemplateIds ?? []));
  const recipientExcludedTemplateIds = Array.from(new Set(args.recipientExcludedTemplateIds ?? []));
  const missedSet = new Set(missedTemplateIds);
  const completedSet = new Set(completedTemplateIds);
  const recipientExcludedSet = new Set(recipientExcludedTemplateIds);

  const items: WeeklyAdjustedItem<T>[] = args.items.map((item) => {
    const isMissedThisWeek = missedSet.has(item.templateId) && !completedSet.has(item.templateId);
    const baseEffective = plannedEffective(item, item.adjustedPlannedSets);
    return {
      ...item,
      weeklyAdjustedPlannedSets: isMissedThisWeek ? 0 : item.adjustedPlannedSets,
      weeklyAdjustmentDelta: isMissedThisWeek ? -item.adjustedPlannedSets : 0,
      isMissedThisWeek,
      isWeeklyVirtualSlot: false,
      weeklyVirtualCapacity: null,
      weeklyAddedSetPlans: [],
      weeklyEffectiveBase: baseEffective,
      weeklyEffectivePlanned: isMissedThisWeek ? 0 : baseEffective,
      weeklyAdjustmentReason: isMissedThisWeek ? "Workout marked missed for this week" : null,
    };
  });

  const templateMeta = new Map<string, WeeklyPlanTemplate>();
  for (const template of args.templates ?? []) templateMeta.set(template.id, template);
  for (const item of args.items) {
    if (!templateMeta.has(item.templateId)) {
      templateMeta.set(item.templateId, {
        id: item.templateId,
        name: item.templateName,
        sequenceIndex: item.templateSequenceIndex,
      });
    }
  }

  const originalTemplateSets = new Map<string, number>();
  for (const template of templateMeta.values()) originalTemplateSets.set(template.id, 0);
  for (const item of args.items) {
    originalTemplateSets.set(item.templateId, (originalTemplateSets.get(item.templateId) ?? 0) + Math.max(0, item.adjustedPlannedSets));
  }

  const templateAllocatedPhysical = new Map<string, number>();
  const nextVirtualSortOrder = new Map<string, number>();
  for (const template of templateMeta.values()) {
    const maxSort = args.items
      .filter((item) => item.templateId === template.id)
      .reduce((max, item) => Math.max(max, item.sortOrder), -1);
    nextVirtualSortOrder.set(template.id, maxSort + 1);
  }

  const missedItems = items
    .filter((item) => item.isMissedThisWeek)
    .sort((a, b) => a.templateSequenceIndex - b.templateSequenceIndex || a.sortOrder - b.sortOrder);

  let missedPhysicalSets = 0;
  let reallocatedPhysicalSets = 0;
  let unallocatedPhysicalSets = 0;
  let missedEffectiveSets = 0;
  let reallocatedEffectiveSets = 0;
  let unallocatedEffectiveSets = 0;
  let virtualSlotsCreated = 0;

  const eligibleTemplateIds = () =>
    Array.from(templateMeta.values())
      .filter((template) => !missedSet.has(template.id))
      .filter((template) => !completedSet.has(template.id))
      .filter((template) => !recipientExcludedSet.has(template.id));

  const currentTemplatePhysicalSets = (templateId: string) =>
    (originalTemplateSets.get(templateId) ?? 0) + (templateAllocatedPhysical.get(templateId) ?? 0);

  const chooseTemplateForVirtualSlot = () =>
    eligibleTemplateIds()
      .sort(
        (a, b) =>
          currentTemplatePhysicalSets(a.id) - currentTemplatePhysicalSets(b.id) ||
          (originalTemplateSets.get(a.id) ?? 0) - (originalTemplateSets.get(b.id) ?? 0) ||
          a.sequenceIndex - b.sequenceIndex,
      )[0] ?? null;

  const createVirtualSlot = (source: WeeklyAdjustedItem<T>) => {
    const destination = chooseTemplateForVirtualSlot();
    if (!destination) return null;

    virtualSlotsCreated += 1;
    const virtualCapacity = Math.max(1, source.maxSets ?? 0, source.adjustedPlannedSets);
    const sortOrder = nextVirtualSortOrder.get(destination.id) ?? 0;
    nextVirtualSortOrder.set(destination.id, sortOrder + 1);

    const virtual = {
      ...source,
      id: `weekly-virtual:${args.weekStart}:${destination.id}:${source.movementGroupId}:${virtualSlotsCreated}`,
      templateId: destination.id,
      templateName: destination.name,
      templateSequenceIndex: destination.sequenceIndex,
      sortOrder,
      plannedSets: 0,
      minSets: 0,
      maxSets: virtualCapacity,
      setPlans: [],
      basePlannedSets: 0,
      adjustedPlannedSets: 0,
      adjustmentDelta: 0,
      adjustmentReason: null,
      weeklyAdjustedPlannedSets: 0,
      weeklyAdjustmentDelta: 0,
      isMissedThisWeek: false,
      isWeeklyVirtualSlot: true,
      weeklyVirtualCapacity: virtualCapacity,
      weeklyAddedSetPlans: [],
      weeklyEffectiveBase: 0,
      weeklyEffectivePlanned: 0,
      weeklyAdjustmentReason: `Temporary ${source.movementGroupName} slot added to recover missed weekly volume`,
    } as unknown as WeeklyAdjustedItem<T>;

    items.push(virtual);
    return virtual;
  };

  for (const source of missedItems) {
    const sourceSets = Math.max(0, source.adjustedPlannedSets);
    missedPhysicalSets += sourceSets;

    for (let setNumber = 1; setNumber <= sourceSets; setNumber += 1) {
      const sourcePlan = setPlanFor(source, setNumber);
      const effectiveValue = sourcePlan.multiplier;
      missedEffectiveSets += effectiveValue;

      const canReceive = (item: WeeklyAdjustedItem<T>) => {
        if (item.isMissedThisWeek) return false;
        if (recipientExcludedSet.has(item.templateId) || completedSet.has(item.templateId)) return false;
        if (item.templateId === source.templateId) return false;
        if (item.movementGroupId !== source.movementGroupId) return false;
        if (item.weeklyAdjustedPlannedSets >= weeklyCapacity(item as WeeklyAdjustedItem<WeeklyPlanSourceItem>)) return false;
        if (effectiveValue > 1.0001 && hasMultiplierSet(item as WeeklyAdjustedItem<WeeklyPlanSourceItem>)) return false;
        return true;
      };

      const candidates = items
        .filter(canReceive)
        .sort(
          (a, b) =>
            Number(a.isWeeklyVirtualSlot) - Number(b.isWeeklyVirtualSlot) ||
            currentTemplatePhysicalSets(a.templateId) - currentTemplatePhysicalSets(b.templateId) ||
            a.weeklyAdjustmentDelta - b.weeklyAdjustmentDelta ||
            a.templateSequenceIndex - b.templateSequenceIndex ||
            a.sortOrder - b.sortOrder,
        );

      let selected: WeeklyAdjustedItem<T> | null = candidates[0] ?? null;
      if (!selected) {
        selected = createVirtualSlot(source);
      }

      if (!selected) {
        unallocatedPhysicalSets += 1;
        unallocatedEffectiveSets += effectiveValue;
        continue;
      }

      const addedSetNumber = selected.weeklyAdjustedPlannedSets + 1;
      selected.weeklyAddedSetPlans.push({
        setNumber: addedSetNumber,
        setTypeId: sourcePlan.setTypeId,
        multiplier: effectiveValue,
        sourceTemplateId: source.templateId,
        sourceTemplateName: source.templateName,
      });
      selected.weeklyAdjustedPlannedSets += 1;
      selected.weeklyAdjustmentDelta += 1;
      selected.weeklyAdjustmentReason = appendReason(
        selected.weeklyAdjustmentReason,
        `+${roundEffective(effectiveValue)} effective set${Math.abs(effectiveValue - 1) < 0.0001 ? "" : "s"} from missed ${source.templateName}`,
      );
      selected.weeklyEffectivePlanned = effectiveWithWeeklyAdds(selected as WeeklyAdjustedItem<WeeklyPlanSourceItem>);
      templateAllocatedPhysical.set(selected.templateId, (templateAllocatedPhysical.get(selected.templateId) ?? 0) + 1);
      reallocatedPhysicalSets += 1;
      reallocatedEffectiveSets += effectiveValue;
    }
  }

  for (const item of items) {
    item.weeklyEffectivePlanned = effectiveWithWeeklyAdds(item as WeeklyAdjustedItem<WeeklyPlanSourceItem>);
  }

  missedEffectiveSets = roundEffective(missedEffectiveSets);
  reallocatedEffectiveSets = roundEffective(reallocatedEffectiveSets);
  unallocatedEffectiveSets = roundEffective(unallocatedEffectiveSets);

  return {
    items,
    summary: {
      weekStart: args.weekStart,
      missedTemplateIds,
      completedTemplateIds,
      missedSets: missedEffectiveSets,
      reallocatedSets: reallocatedEffectiveSets,
      unallocatedSets: unallocatedEffectiveSets,
      missedPhysicalSets,
      reallocatedPhysicalSets,
      unallocatedPhysicalSets,
      missedEffectiveSets,
      reallocatedEffectiveSets,
      unallocatedEffectiveSets,
      virtualSlotsCreated,
    } satisfies WeeklyPlanSummary,
  };
}
