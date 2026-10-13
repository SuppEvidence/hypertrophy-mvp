import type { ProgrammingRecommendations } from "../ai/programming-decision-schema";

/** Approval instructions come from validated options, never pre-validation prose. */
export function reconcileT3ApprovalSummary(review: ProgrammingRecommendations, optionsWithheld: boolean) {
  const actionable = review.decisions.flatMap((decision) => {
    const option = decision.options.find((row) => row.optionKey === decision.recommendedOptionKey);
    return option ? [`${decision.targetMuscleName}: ${option.title}${option.painOpportunity ? " (after supporting pain reductions)" : ""}`] : [];
  });
  if (actionable.length) return `For approval: ${actionable.join("; ")}. Compare the exact set and muscle-dose effects in the cards before choosing.`;
  if (review.decisions.length) return "No change is preferred over keeping the current setup. Optional alternatives remain available in the cards.";
  return optionsWithheld ? "No implementable changes are available for approval from this review. The proposed changes were withheld; see the specific reasons below. Approved training remains in place." : "";
}
