export type PhaseEntry = { phase: "CUTTING" | "MAINTAINING" | "GAINING"; startDate: Date };

export function interpretEnergyPhase(entries: PhaseEntry[], at = new Date()) {
  const day = at.toISOString().slice(0, 10);
  const chronological = [...entries].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const active = [...chronological].reverse().find((entry) => entry.startDate.toISOString().slice(0, 10) <= day);
  if (!active) return null;
  const next = chronological.find((entry) => entry.startDate > active.startDate);
  const daysSinceStart = Math.max(0, Math.floor((Date.parse(`${day}T00:00:00Z`) -
    Date.parse(`${active.startDate.toISOString().slice(0, 10)}T00:00:00Z`)) / 86_400_000));
  return {
    phase: active.phase,
    startDate: active.startDate.toISOString().slice(0, 10),
    endDateExclusive: next?.startDate.toISOString().slice(0, 10) ?? null,
    daysSinceStart,
    transitionCaution: daysSinceStart < 14,
    interpretation: daysSinceStart < 14
      ? "Recently selected phase. Bodyweight, waist, performance and recovery may lag; do not assume the new energy state is already visible or use a fixed adaptation deadline."
      : "Athlete-declared intent; verify the actual trend using measurements, training and recovery. Do not assume phase alone proves energy balance.",
  };
}
