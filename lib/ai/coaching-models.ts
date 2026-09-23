/** Model routing is independent of the deterministic coaching/approval policy. */
export type CoachingWorkload = "T1" | "T2" | "WORKOUT_ANALYSIS" | "T3_VOLUME" | "T3_MESOCYCLE";
type Effort = "low" | "medium" | "high" | "xhigh";
type Environment = Record<string, string | undefined>;

const PROFILES = {
  T1: { tier: "T1", model: "gpt-5.6-luna", effort: "low", timeout: 20_000, maxOutputTokens: 2048 },
  T2: { tier: "T2", model: "gpt-5.6-terra", effort: "medium", timeout: 45_000, maxOutputTokens: 8192 },
  WORKOUT_ANALYSIS: { tier: "T2", model: "gpt-5.6-terra", effort: "medium", timeout: 60_000, maxOutputTokens: 16384 },
  T3_VOLUME: { tier: "T3", model: "gpt-5.6-sol", effort: "high", timeout: 90_000, maxOutputTokens: 24576 },
  T3_MESOCYCLE: { tier: "T3", model: "gpt-5.6-sol", effort: "xhigh", timeout: 110_000, maxOutputTokens: 32768 },
} as const;

export const COACHING_WORKLOADS = Object.keys(PROFILES) as CoachingWorkload[];
const MODELS = new Set(["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol", "gpt-5.6"]);
const EFFORTS = new Set<string>(["low", "medium", "high", "xhigh"]);

function configured(env: Environment, name: string, fallback: string) {
  if (env[name] === undefined) return fallback;
  const value = env[name]!.trim();
  if (!value) throw new Error(`${name} must not be empty. Remove it to use the default.`);
  return value;
}

export function getCoachingModelConfig(workload: CoachingWorkload, env: Environment = process.env) {
  const profile = PROFILES[workload];
  const modelKey = `OPENAI_${profile.tier}_MODEL`;
  const effortKey = workload === "T3_MESOCYCLE" ? "OPENAI_T3_MESO_REASONING_EFFORT" : `OPENAI_${profile.tier}_REASONING_EFFORT`;
  // The old global OPENAI_MODEL intentionally cannot collapse the tier routing.
  const model = configured(env, modelKey, profile.model);
  const effort = configured(env, effortKey, profile.effort);
  if (!MODELS.has(model)) throw new Error(`${modelKey} must name a supported GPT-5.6 model: gpt-5.6-luna, gpt-5.6-terra, gpt-5.6-sol, or gpt-5.6.`);
  if (!EFFORTS.has(effort)) throw new Error(`${effortKey} must be low, medium, high, or xhigh.`);
  return {
    workload,
    request: { model, reasoning: { effort: effort as Effort }, store: false as const, max_output_tokens: profile.maxOutputTokens },
    options: { timeout: profile.timeout, maxRetries: 0 },
  };
}

type ResponseSummary = {
  status?: string;
  usage?: { input_tokens: number; output_tokens: number; total_tokens: number;
    output_tokens_details?: { reasoning_tokens?: number }; input_tokens_details?: { cached_tokens?: number };
  } | null;
};

/** Operational metadata only: never log prompts, workout content, credentials or user IDs. */
export function logCoachingModelUsage(config: ReturnType<typeof getCoachingModelConfig>, response: ResponseSummary, startedAt: number) {
  console.info("COACHING_AI", JSON.stringify({
    workload: config.workload, model: config.request.model, reasoningEffort: config.request.reasoning.effort,
    status: response.status ?? "unknown", durationMs: Date.now() - startedAt,
    inputTokens: response.usage?.input_tokens ?? null, outputTokens: response.usage?.output_tokens ?? null,
    reasoningTokens: response.usage?.output_tokens_details?.reasoning_tokens ?? null,
    cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null,
  }));
}
