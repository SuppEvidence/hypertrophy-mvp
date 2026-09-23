import { config } from "dotenv";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { COACHING_WORKLOADS, getCoachingModelConfig, logCoachingModelUsage } from "../lib/ai/coaching-models";
import { getOpenAIClient } from "../lib/ai/openai";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

async function main() {
  const live = process.argv.includes("--live");
  const profiles = COACHING_WORKLOADS.map((workload) => getCoachingModelConfig(workload));
  console.table(profiles.map(({ workload, request, options }) => ({
    workload, model: request.model, effort: request.reasoning.effort,
    timeoutSeconds: options.timeout / 1000, maxOutputTokens: request.max_output_tokens,
  })));
  if (!live) {
    console.log("Configuration only; no API calls made. Use --live for a small billable structured-output check of each distinct model/effort pair.");
    return;
  }
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured.");
  const seen = new Set<string>();
  for (const profile of profiles) {
    const key = `${profile.request.model}/${profile.request.reasoning.effort}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const startedAt = Date.now();
    try {
      const response = await getOpenAIClient().responses.parse({
        ...profile.request,
        input: "This is a connection check. Return ok as true.",
        text: { format: zodTextFormat(z.object({ ok: z.boolean() }), "coaching_connection_check") },
      }, profile.options);
      logCoachingModelUsage(profile, response, startedAt);
      if (response.output_parsed?.ok !== true) throw new Error("No valid structured result");
      console.log(`PASS ${key}`);
    } catch (error) {
      const failure = error as { status?: number; code?: string; name?: string };
      console.error(`FAIL ${key}`, { status: failure.status, code: failure.code, error: failure.name });
      process.exitCode = 1;
    }
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Model configuration check failed.");
  process.exitCode = 1;
});
