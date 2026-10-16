import entries from "./catalog.json";

export const MUSCLE_MODEL_VERSION = 1;
export type MuscleDefinition = typeof entries[number];
export const muscleCatalog: readonly MuscleDefinition[] = entries;
export type MuscleReference = { id: string; name: string; slug?: string; accountingSlug?: string | null; bodyRegion?: string; aliases?: string[]; visualAssessable?: boolean };
export const normalizeMuscleName = (value: string) => value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const definitions = new Map(entries.map(m => [m.slug, m]));
const byName = new Map(entries.map(m => [normalizeMuscleName(m.name), m]));
export function muscleDefinition(m: Pick<MuscleReference, "name" | "slug">) {
  return (m.slug ? definitions.get(m.slug) : undefined) ?? byName.get(normalizeMuscleName(m.name));
}
/** Exact aliases only. Ambiguous labels deliberately remain unresolved. */
export function resolveMuscleReference(label: string, muscles: MuscleReference[]) {
  const key = normalizeMuscleName(label);
  if (!key) return null;
  const exact = muscles.filter(m => normalizeMuscleName(m.name) === key || normalizeMuscleName(m.slug ?? "") === key);
  if (exact.length === 1) return exact[0];
  const aliases = muscles.filter(m => [...(m.aliases ?? []), ...(muscleDefinition(m)?.aliases ?? [])].some(a => normalizeMuscleName(a) === key));
  return aliases.length === 1 ? aliases[0] : null;
}
export function accountingMuscle(m: MuscleReference, muscles: MuscleReference[]) {
  const slug = m.accountingSlug ?? muscleDefinition(m)?.accountingSlug;
  return slug ? muscles.find(row => row.slug === slug || muscleDefinition(row)?.slug === slug) ?? null : m;
}
export function muscleCatalogContext(muscles: MuscleReference[]) {
  return muscles.map(m => {
    const d = muscleDefinition(m);
    return { id: m.id, name: m.name, kind: d?.anatomyKind ?? "GROUP", bodyRegion: m.bodyRegion ?? d?.bodyRegion ?? "Other",
      accountingMuscleId: accountingMuscle(m, muscles)?.id ?? null,
      visualAssessable: m.visualAssessable ?? d?.visualAssessable ?? false };
  });
}
export const SHARED_MUSCLE_POLICY = `SHARED MUSCLE MODEL v${MUSCLE_MODEL_VERSION}
- Catalogue IDs are authoritative. Names/aliases identify the same reference, not additional muscles. Copy supplied IDs; do not invent them. Anatomical muscles, regions and broad accounting groups are distinct.
- Detailed targets describe exercise emphasis. accountingMuscleId is an administrative set-accounting group, not proof of anatomical containment or identical recruitment. Do not add detailed targets on top of their group, distribute old sets among newly available muscles, or invent regional volume/history.
- Existing exercise links remain the recorded workload mapping, including legacy broad glutes/upper-back/arm groups. Newly available detail does not invalidate saved analyses. Legacy broad glutes and newer hip-abductor work can overlap: do not treat them as independent recovery budgets. Chest regions also overlap and share recovery demands.
- General major-muscle set ranges must not be automatically applied to small, deep, neck, facial, pelvic-floor or respiratory targets.
- A newly listed muscle has unknown history, not evidence of undertraining, zero stimulus, or a requirement to add work. Apply the athlete's approved priorities; do not assume every listed muscle needs direct bodybuilding work.
- Regional emphasis is a qualified inference, not isolation, activation measurement or proven regional growth. Use broad targets when evidence cannot support detail. An anatomical entry does not guarantee that it is visible in photos. Deep muscles and individual heads usually cannot be assessed independently from physique photos.
- Unresolved targets retain their supplied label with muscleId=null for review. Never silently substitute a different muscle, change workload accounting or trigger another AI call to repair a reference.`;
