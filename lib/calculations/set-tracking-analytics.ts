export type DropSetDetail = {
  weight: number | null;
  reps: number | null;
};

export type NormalizedIntensifierDetails = {
  clusterCount: number | null;
  dropSets: DropSetDetail[];
};

export type SetTrackingSignals = {
  durationSeconds: number | null;
  clusterCount: number | null;
  dropSetCount: number;
  dropSetReps: number;
  dropSetVolumeLoad: number | null;
};

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function finiteInteger(value: unknown): number | null {
  const parsed = finiteNumber(value);
  if (parsed === null) return null;
  return Math.max(0, Math.round(parsed));
}

export function normalizeIntensifierDetails(value: unknown): NormalizedIntensifierDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { clusterCount: null, dropSets: [] };
  }

  const raw = value as Record<string, unknown>;
  const rawDrops = Array.isArray(raw.dropSets) ? raw.dropSets : [];
  const dropSets = rawDrops
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return { weight: null, reps: null };
      }
      const drop = entry as Record<string, unknown>;
      return {
        weight: finiteNumber(drop.weight),
        reps: finiteInteger(drop.reps),
      };
    })
    .filter((drop) => drop.weight !== null || drop.reps !== null);

  return {
    clusterCount: finiteInteger(raw.clusterCount),
    dropSets,
  };
}

export function setDurationSeconds(startedAt: Date | string | null | undefined, endedAt: Date | string | null | undefined) {
  if (!startedAt || !endedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / 1000);
}

export function buildSetTrackingSignals(input: {
  startedAt?: Date | string | null;
  endedAt?: Date | string | null;
  intensifierDetails?: unknown;
}): SetTrackingSignals {
  const details = normalizeIntensifierDetails(input.intensifierDetails);
  const validDropVolume = details.dropSets.filter(
    (drop): drop is { weight: number; reps: number } => drop.weight !== null && drop.reps !== null,
  );
  const dropSetReps = details.dropSets.reduce((sum, drop) => sum + (drop.reps ?? 0), 0);
  const dropSetVolumeLoad = validDropVolume.length > 0
    ? Math.round(validDropVolume.reduce((sum, drop) => sum + drop.weight * drop.reps, 0) * 100) / 100
    : null;

  return {
    durationSeconds: setDurationSeconds(input.startedAt, input.endedAt),
    clusterCount: details.clusterCount,
    dropSetCount: details.dropSets.length,
    dropSetReps,
    dropSetVolumeLoad,
  };
}
