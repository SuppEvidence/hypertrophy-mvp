export type LiveCoachSkipReason =
  | "SESSION_NOT_DRAFT"
  | "SET_NOT_COMPLETED"
  | "INVALID_SET_DATA"
  | "NO_REMAINING_SET"
  | "SINGLE_SET_EXERCISE"
  | "FIRST_SET_WITHOUT_ACTIONABLE_SIGNAL"
  | "CHECK_ALREADY_RECORDED";

export type LiveCoachEligibilityInput = {
  sessionStatus: string;
  plannedSetCount: number;
  completedSetCount: number;
  triggerSetCompleted: boolean;
  triggerSetHasUsablePerformance: boolean;
  triggerSetPain: boolean;
  triggerSetExecutionCompromised: boolean;
  historicalPerformanceExposureCount: number;
  existingActionForTriggerSet: boolean;
};

export type LiveCoachEligibility =
  | { shouldCheck: true; trigger: "PAIN" | "EXECUTION" | "PERFORMANCE" }
  | { shouldCheck: false; reason: LiveCoachSkipReason };

/**
 * Cheap deterministic gate that must run before any live-coach AI request.
 * It deliberately prefers missing a low-value check over interrupting the
 * athlete or spending an API call when no remaining prescription can change.
 */
export function evaluateLiveCoachEligibility(
  input: LiveCoachEligibilityInput,
): LiveCoachEligibility {
  if (input.sessionStatus !== "DRAFT") {
    return { shouldCheck: false, reason: "SESSION_NOT_DRAFT" };
  }
  if (!input.triggerSetCompleted) {
    return { shouldCheck: false, reason: "SET_NOT_COMPLETED" };
  }
  if (input.existingActionForTriggerSet) {
    return { shouldCheck: false, reason: "CHECK_ALREADY_RECORDED" };
  }
  if (input.plannedSetCount <= 1) {
    return { shouldCheck: false, reason: "SINGLE_SET_EXERCISE" };
  }
  if (input.completedSetCount >= input.plannedSetCount) {
    return { shouldCheck: false, reason: "NO_REMAINING_SET" };
  }
  if (input.triggerSetPain) return { shouldCheck: true, trigger: "PAIN" };
  if (input.triggerSetExecutionCompromised) {
    return { shouldCheck: true, trigger: "EXECUTION" };
  }
  if (!input.triggerSetHasUsablePerformance) {
    return { shouldCheck: false, reason: "INVALID_SET_DATA" };
  }

  // A normal first set is not enough to justify a check unless an established
  // exercise baseline exists. From set two onward, within-exercise decay is
  // itself actionable evidence while another set remains.
  if (
    input.completedSetCount === 1 &&
    input.historicalPerformanceExposureCount < 3
  ) {
    return {
      shouldCheck: false,
      reason: "FIRST_SET_WITHOUT_ACTIONABLE_SIGNAL",
    };
  }

  return { shouldCheck: true, trigger: "PERFORMANCE" };
}

