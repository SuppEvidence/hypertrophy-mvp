/** EDT is a cluster-style set, even when the catalog intentionally labels it a base set. */
export function isEdtSetType(type: { slug?: string | null; name?: string | null } | null | undefined) {
  const label = `${type?.slug ?? ""} ${type?.name ?? ""}`;
  return /(?:^|[^a-z])edt(?:$|[^a-z])|extended[\s_-]*density/i.test(label);
}
