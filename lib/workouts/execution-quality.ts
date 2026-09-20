export const EXECUTION_COMPROMISE_REASONS = [
  "ROM",
  "STABILITY",
  "CONTROL_TEMPO",
  "SETUP",
  "TARGET_MUSCLE",
  "OTHER",
] as const;

export type ExecutionCompromiseReason =
  (typeof EXECUTION_COMPROMISE_REASONS)[number];

export const EXECUTION_COMPROMISE_LABELS: Record<
  ExecutionCompromiseReason,
  string
> = {
  ROM: "ROM",
  STABILITY: "Stability",
  CONTROL_TEMPO: "Control / tempo",
  SETUP: "Setup",
  TARGET_MUSCLE: "Target muscle",
  OTHER: "Other",
};
