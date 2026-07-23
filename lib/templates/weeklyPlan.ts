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
};

export type WeeklyAdjustedItem<T extends WeeklyPlanSourceItem> = T & {
  weeklyAdjustedPlannedSets: number;
  weeklyAdjustmentDelta: number;
  isMissedThisWeek: boolean;
  weeklyAdjustmentReason: string | null;
};

export type WeeklyPlanSummary = {
  weekStart: string;
  missedTemplateIds: string[];
  completedTemplateIds: string[];
  missedSets: number;
  reallocatedSets: number;
  unallocatedSets: number;
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

function weeklyCapacity(item: WeeklyPlanSourceItem) {
  const base = Math.max(0, item.adjustedPlannedSets);
  const explicitMax = item.maxSets === null || item.maxSets === undefined ? null : Math.max(0, item.maxSets);
  return Math.max(base, explicitMax ?? base + 1);
}

export function applyWeeklyMissedWorkoutPlan<T extends WeeklyPlanSourceItem>(args: {
  items: T[];
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
    return {
      ...item,
      weeklyAdjustedPlannedSets: isMissedThisWeek ? 0 : item.adjustedPlannedSets,
      weeklyAdjustmentDelta: isMissedThisWeek ? -item.adjustedPlannedSets : 0,
      isMissedThisWeek,
      weeklyAdjustmentReason: isMissedThisWeek ? "Workout marked missed for this week" : null,
    };
  });

  const missedItems = items
    .filter((item) => item.isMissedThisWeek)
    .sort((a, b) => a.templateSequenceIndex - b.templateSequenceIndex || a.sortOrder - b.sortOrder);

  let missedSets = 0;
  let reallocatedSets = 0;

  for (const source of missedItems) {
    const sourceSets = Math.max(0, source.adjustedPlannedSets);
    missedSets += sourceSets;

    for (let setIndex = 0; setIndex < sourceSets; setIndex += 1) {
      const candidates = items
        .filter((item) => !item.isMissedThisWeek)
        .filter((item) => !recipientExcludedSet.has(item.templateId))
        .filter((item) => item.templateId !== source.templateId)
        .filter((item) => item.movementGroupId === source.movementGroupId)
        .filter((item) => item.weeklyAdjustedPlannedSets < weeklyCapacity(item))
        .sort(
          (a, b) =>
            a.weeklyAdjustmentDelta - b.weeklyAdjustmentDelta ||
            a.templateSequenceIndex - b.templateSequenceIndex ||
            a.sortOrder - b.sortOrder,
        );

      const selected = candidates[0];
      if (!selected) continue;

      selected.weeklyAdjustedPlannedSets += 1;
      selected.weeklyAdjustmentDelta += 1;
      selected.weeklyAdjustmentReason = selected.weeklyAdjustmentReason
        ? `${selected.weeklyAdjustmentReason}; +1 recovered from ${source.templateName}`
        : `+1 set recovered from missed ${source.templateName}`;
      reallocatedSets += 1;
    }
  }

  return {
    items,
    summary: {
      weekStart: args.weekStart,
      missedTemplateIds,
      completedTemplateIds,
      missedSets,
      reallocatedSets,
      unallocatedSets: Math.max(0, missedSets - reallocatedSets),
    } satisfies WeeklyPlanSummary,
  };
}
