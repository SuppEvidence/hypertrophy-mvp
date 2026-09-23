import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COACHING_WORKLOADS, getCoachingModelConfig } from "../lib/ai/coaching-models";

const expected = {
  T1: ["gpt-5.6-luna", "low"], T2: ["gpt-5.6-terra", "medium"],
  WORKOUT_ANALYSIS: ["gpt-5.6-terra", "medium"], T3_VOLUME: ["gpt-5.6-sol", "high"],
  T3_MESOCYCLE: ["gpt-5.6-sol", "xhigh"],
};
for (const workload of COACHING_WORKLOADS) {
  const { request, options } = getCoachingModelConfig(workload, { OPENAI_MODEL: "legacy-global-model" });
  assert.deepEqual([request.model, request.reasoning.effort], expected[workload], "Global legacy configuration must not collapse the tier routing");
  assert.equal(request.store, false);
  assert.equal(options.maxRetries, 0);
}
assert.equal(getCoachingModelConfig("T3_VOLUME", { OPENAI_T3_REASONING_EFFORT: "xhigh" }).request.reasoning.effort, "xhigh");
assert.equal(getCoachingModelConfig("T3_MESOCYCLE", { OPENAI_T3_MESO_REASONING_EFFORT: "high" }).request.reasoning.effort, "high");
assert.equal(getCoachingModelConfig("T1", { OPENAI_T2_MODEL: "gpt-5.6-sol" }).request.model, "gpt-5.6-luna", "Tier overrides must remain isolated");
assert.throws(() => getCoachingModelConfig("T1", { OPENAI_T1_MODEL: " " }), /must not be empty/);
assert.throws(() => getCoachingModelConfig("T2", { OPENAI_T2_MODEL: "unverified-model" }), /supported GPT-5.6/);
assert.throws(() => getCoachingModelConfig("T3_VOLUME", { OPENAI_T3_REASONING_EFFORT: "HIGH\/XHIGH" }), /must be/);

// Regression: every model call must actually forward its tier request and budget.
const files = {
  T1: "lib/server/workout-coach-engine.ts", T2: "lib/server/pre-workout-coach.ts",
  WORKOUT_ANALYSIS: "lib/server/ai-workout-analysis.ts", T3_VOLUME: "lib/server/ai-programming-decisions.ts",
  T3_MESOCYCLE: "lib/server/ai-mesocycle-recommendations.ts",
} as const;
for (const workload of COACHING_WORKLOADS) {
  const source = readFileSync(files[workload], "utf8");
  assert.ok(source.includes(`getCoachingModelConfig("${workload}")`));
  assert.match(source, /responses\.parse\(\{\s*\.\.\.aiConfig\.request,/);
  assert.ok(source.includes("}, aiConfig.options)"));
  assert.ok(!source.includes("getOpenAIModel"));
}
const duration = (path: string) => Number(readFileSync(path, "utf8").match(/export const maxDuration = (\d+)/)?.[1]) * 1000;
const pipeline = ["WORKOUT_ANALYSIS", "T3_VOLUME", "T3_MESOCYCLE"] as const;
assert.ok(pipeline.reduce((sum, workload) => sum + getCoachingModelConfig(workload, {}).options.timeout, 0) + 30_000 <= duration("app/(protected)/log/page.tsx"));
assert.ok(getCoachingModelConfig("T2", {}).options.timeout + 20_000 <= duration("app/api/pre-workout-coach/route.ts"));
assert.ok(getCoachingModelConfig("T3_VOLUME", {}).options.timeout + 30_000 <= duration("app/(protected)/ai-analysis/volume/page.tsx"));
console.log("Tier routing, isolated overrides, invalid configuration and route-budget checks passed.");
