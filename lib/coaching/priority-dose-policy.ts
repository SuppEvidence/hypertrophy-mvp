import { z } from "zod";

export const PRIORITY_DOSE_POLICY = `MESOCYCLE OUTCOME PRIORITIES
- SPECIALIZE gets first claim on discretionary time and productive stimulus; GROW seeks growth; MAINTAIN seeks an economical dose that preserves the result. Different muscles need different doses: never force numerical ordering or fixed category caps.
- A saved target or productive growth history is not proof of a maintenance requirement. Separate primary work from secondary overlap. Retain overlap needed by priority exercises; assess additional maintenance-focused work separately. Do not trim useful priority work merely to lower an overlapping maintenance total.
- For maintenance, compare lower-dose periods and their subsequent comparable performance and phase-aware measurements. A growth plateau is not loss of the maintained result. If no lower-dose history exists, identify the target as unreviewed; a small monitored reduction can test efficiency when repeated stable execution/performance supports it. Missing history alone does not prove excess or mandate a cut.
- INDIRECT_ONLY has no target-filling obligation. Incidental work is permitted; do not add targeted work to repay an incidental shortfall.
- Reconcile the whole week after completed work and set-type multipliers. Before leaving SPECIALIZE/GROW below prescription, assess avoidable maintenance-focused surplus and meaningful growth-dose increases elsewhere. Explain unavoidable overlap, supported outcome differences, symptoms or real constraints. No just-in-case fatigue cuts. Never silently change persistent targets to make the table balance.`;

export const MaintenanceBasisSchema = z.enum([
  "LOWER_DOSE_HISTORY", "PRESERVATION_CONCERN", "PRIORITY_OVERLAP",
  "REDUCTION_TRIAL", "UNREVIEWED_BASELINE", "NOT_MAINTENANCE",
]);
export const PriorityReviewSchema = z.object({ maintenanceBasis: MaintenanceBasisSchema });

/** Historical dose-basis metadata stays useful even when acute conclusions need refresh. */
export function readMaintenanceBases(value: unknown): Record<string, string> {
  const parsed = z.object({ assessments: z.array(z.object({ muscleId: z.string(), priority: z.string(),
    priorityReview: PriorityReviewSchema.optional() })) }).safeParse(value);
  return parsed.success ? Object.fromEntries(parsed.data.assessments.filter((row) => row.priority === "MAINTAIN")
    .map((row) => [row.muscleId, row.priorityReview?.maintenanceBasis ?? "UNREVIEWED_BASELINE"])) : {};
}

export type PriorityDoseRow = {
  id: string; name: string; priority: string; target: number; weekly: number;
  directRemaining: number; secondaryRemaining: number; maintenanceBasis?: string; doseReason?: string | null;
};
export type PriorityCheck = { muscleId: string; code: string; message: string };

/** Reviewable allocation checks, not physiological caps or automatic dose changes. */
export function auditWeeklyPriorities(rows: PriorityDoseRow[]): PriorityCheck[] {
  const checks: PriorityCheck[] = [];
  const growth = rows.filter((row) => row.priority === "SPECIALIZE" || row.priority === "GROW");
  const short = growth.filter((row) => row.weekly < row.target - .1);
  for (const row of short) {
    if (!row.doseReason?.trim()) checks.push({ muscleId: row.id, code: "UNEXPLAINED_PRIORITY_SHORTFALL",
      message: `${row.name} is ${(row.target - row.weekly).toFixed(1)} effective sets below prescription without an allocation explanation.` });
  }
  for (const row of rows) {
    if (row.priority === "INDIRECT_ONLY" && row.directRemaining > .1) checks.push({ muscleId: row.id,
      code: "INDIRECT_PRIMARY_WORK", message: `${row.name} has ${row.directRemaining.toFixed(1)} remaining primary-muscle sets despite indirect-only priority. Check whether these exercises are needed for another muscle; this is not automatically removable work.` });
    if (row.priority === "MAINTAIN" && row.directRemaining > .1 && short.length &&
        (!row.maintenanceBasis || row.maintenanceBasis === "UNREVIEWED_BASELINE" || row.maintenanceBasis === "NOT_MAINTENANCE")) {
      checks.push({ muscleId: row.id, code: "UNREVIEWED_MAINTENANCE_BUDGET",
        message: `${row.name}'s maintenance prescription has not been established as a necessary dose. With growth work underfilled, review whether its additional primary work can be reduced in a monitored trial; do not remove useful shared priority work.` });
    }
    if (row.priority === "MAINTAIN" && row.weekly > row.target + .1 && row.directRemaining > .1 && short.length) {
      checks.push({ muscleId: row.id, code: "MAINTENANCE_SURPLUS_WITH_PRIORITY_GAP",
        message: `${row.name} is ${(row.weekly - row.target).toFixed(1)} sets above its maintenance prescription while ${short.map((muscle) => muscle.name).join(", ")} remain below prescription. Review its ${row.directRemaining.toFixed(1)} primary / ${row.secondaryRemaining.toFixed(1)} secondary remaining sets before accepting the tradeoff; shared priority work may be necessary.` });
    }
    if ((row.priority === "SPECIALIZE" || row.priority === "GROW") && row.weekly > row.target + .1 &&
        short.some((muscle) => muscle.id !== row.id) && !row.doseReason?.trim()) {
      checks.push({ muscleId: row.id, code: "UNEXPLAINED_GROWTH_TRADEOFF",
        message: `${row.name} exceeds prescription while another growth priority is underfilled. Explain why this extra allocation is more useful or unavoidable.` });
    }
  }
  return checks;
}
