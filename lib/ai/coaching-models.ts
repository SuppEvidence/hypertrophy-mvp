/** Model routing is independent of the deterministic coaching/approval policy. */
export type CoachingWorkload = "T1" | "T2" | "WORKOUT_ANALYSIS" | "T3_VOLUME" | "T3_MESOCYCLE" | "WEEKLY_PLAN" | "EXERCISE_PROFILE" | "PHYSIQUE_CHECKIN" | "MESOCYCLE_DESIGN";
type Effort = "low" | "medium" | "high" | "xhigh";
type Environment = Record<string, string | undefined>;

// Volume can follow the 60-second workout analysis in a 300-second request.
// Leave 30 seconds for context, validation and persistence; manual meso leaves 45.
const PROFILES = {
  MESOCYCLE_DESIGN: { tier: "T3", model: "gpt-5.6-sol", effort: "high", timeout: 240_000, maxOutputTokens: 24576 },
  PHYSIQUE_CHECKIN: { tier: "T3", model: "gpt-5.6-sol", effort: "high", timeout: 210_000, maxOutputTokens: 12288 },
  EXERCISE_PROFILE: { tier: "T2", model: "gpt-5.6-terra", effort: "medium", timeout: 120_000, maxOutputTokens: 8192 },
  T1: { tier: "T1", model: "gpt-5.6-luna", effort: "low", timeout: 20_000, maxOutputTokens: 2048 },
  T2: { tier: "T2", model: "gpt-5.6-terra", effort: "medium", timeout: 45_000, maxOutputTokens: 8192 },
  WORKOUT_ANALYSIS: { tier: "T2", model: "gpt-5.6-terra", effort: "medium", timeout: 60_000, maxOutputTokens: 16384 },
  T3_VOLUME: { tier: "T3", model: "gpt-5.6-sol", effort: "high", timeout: 210_000, maxOutputTokens: 24576 },
  T3_MESOCYCLE: { tier: "T3", model: "gpt-5.6-sol", effort: "xhigh", timeout: 255_000, maxOutputTokens: 32768 },
  WEEKLY_PLAN: { tier: "T3", model: "gpt-5.6-sol", effort: "high", timeout: 255_000, maxOutputTokens: 24576 },
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
  const effortKey = workload === "T3_MESOCYCLE" ? "OPENAI_T3_MESO_REASONING_EFFORT" : workload === "WEEKLY_PLAN" ? "OPENAI_WEEKLY_REASONING_EFFORT" : `OPENAI_${profile.tier}_REASONING_EFFORT`;
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

/** Keep weekly request deadlines below the planner route's 300-second limit. */
export function getWeeklyPlanningModelConfig(carried: boolean, env: Environment = process.env) {
  const base = getCoachingModelConfig("WEEKLY_PLAN", env);
  if (!carried) return base;
  return { ...base, request: { ...base.request,
    reasoning: { effort: env.OPENAI_WEEKLY_REASONING_EFFORT ? base.request.reasoning.effort : "medium" as Effort },
    max_output_tokens: 16384 }, options: { ...base.options, timeout: 210_000 } };
}

type ResponseSummary = {
  status?: string;
  usage?: { input_tokens: number; output_tokens: number; total_tokens: number;
    output_tokens_details?: { reasoning_tokens?: number }; input_tokens_details?: { cached_tokens?: number };
  } | null;
};

/** Operational metadata only: never log prompts, workout content, credentials or user IDs. */
export function logCoachingModelUsage(config: { workload: CoachingWorkload; request: { model: string; reasoning: { effort: Effort } } }, response: ResponseSummary, startedAt: number) {
  console.info("COACHING_AI", JSON.stringify({
    workload: config.workload, model: config.request.model, reasoningEffort: config.request.reasoning.effort,
    status: response.status ?? "unknown", durationMs: Date.now() - startedAt,
    inputTokens: response.usage?.input_tokens ?? null, outputTokens: response.usage?.output_tokens ?? null,
    reasoningTokens: response.usage?.output_tokens_details?.reasoning_tokens ?? null,
    cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null,
  }));
}
