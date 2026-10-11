import assert from "node:assert/strict";
import { getCoachingModelConfig, getWeeklyPlanningModelConfig } from "../lib/ai/coaching-models";

const full = getWeeklyPlanningModelConfig(false, {});
const carried = getWeeklyPlanningModelConfig(true, {});
assert.equal(full.request.max_output_tokens, 24576);
assert.equal(full.options.timeout, 255000);
assert.equal(full.request.reasoning.effort, "high");
assert.equal(carried.request.max_output_tokens, 16384);
assert.equal(carried.options.timeout, 210000);
assert.equal(carried.request.reasoning.effort, "medium");
for (const config of [full, carried]) {
  assert.ok(config.options.timeout <= 300000 - 45000, "Leave time for persistence and action redirect");
  assert.equal(config.options.maxRetries, 0, "No hidden duplicate calls or timeout multiplication");
  assert.equal(config.request.store, false);
}
for (const carried of [false, true]) {
  const explicit = getWeeklyPlanningModelConfig(carried, {
    OPENAI_T3_MODEL: "gpt-5.6-terra", OPENAI_WEEKLY_REASONING_EFFORT: "xhigh",
  });
  assert.equal(explicit.request.model, "gpt-5.6-terra");
  assert.equal(explicit.request.reasoning.effort, "xhigh");
  assert.throws(() => getWeeklyPlanningModelConfig(carried, { OPENAI_WEEKLY_REASONING_EFFORT: "" }));
}
assert.equal(getCoachingModelConfig("T1", {}).options.timeout, 20000);
assert.equal(getCoachingModelConfig("T2", {}).options.timeout, 45000);
assert.equal(getCoachingModelConfig("T3_VOLUME", {}).options.timeout, 90000);
assert.equal(getCoachingModelConfig("T3_MESOCYCLE", {}).options.timeout, 110000);
console.log("Weekly full/carry budgets, deployment margin, explicit overrides and other tiers passed.");
