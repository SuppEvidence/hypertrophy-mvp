/** A null estimate is unassessed and contributes zero until the coach evaluates the link.
 * Never coerce null with Number(null): doing so hides unassessed relationships. */
export function secondaryContributionFor(link: { contributionEstimate?: unknown } | null | undefined): number {
  const raw = link?.contributionEstimate;
  if (raw === null || raw === undefined || raw === "") return 0;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0;
}
