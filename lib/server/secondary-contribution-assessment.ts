import "server-only";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { prisma } from "@/lib/db/prisma";
import { getOpenAIClient } from "@/lib/ai/openai";
import { getCoachingModelConfig, logCoachingModelUsage } from "@/lib/ai/coaching-models";

const Assessment = z.object({
  estimates: z.array(z.object({
    muscleId: z.string().uuid(),
    fraction: z.number().min(0).max(1),
    rationale: z.string().min(12).max(350),
  })).max(20),
});

/** One assessment per stored exercise × secondary-muscle link. Unrated links count zero. */
export async function assessExerciseSecondaryContributions(exerciseId: string) {
  const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId }, include: {
    movementGroup: { select: { name: true } },
    primaryMuscles: { include: { muscle: { select: { name: true } } } },
    secondaryMuscles: { include: { muscle: { select: { name: true } } } },
  } });
  if (!exercise) return 0;
  const pending = exercise.secondaryMuscles.filter((link) => link.contributionEstimate === null);
  if (!pending.length) return 0;
  const config = getCoachingModelConfig("T2");
  const startedAt = Date.now();
  const response = await getOpenAIClient().responses.parse({
    ...config.request,
    max_output_tokens: 4096,
    input: [
      { role: "system", content: "Estimate the likely indirect training stimulus to each listed SECONDARY muscle from one standard hard set of this exercise. This is a rough accounting fraction of a direct set, never a measurement of muscle growth or an instruction to add sets. Use the movement pattern and mechanics, primary muscle targets and setup notes. Return 0 when the muscle is unlikely to get meaningful tension. Use only 0, 0.25, 0.5, 0.75, or 1; avoid assigning 1 except near-equivalent work. Output precisely one estimate per requested muscle ID and no others. Do not infer individual hypertrophy from circumference alone." },
      { role: "user", content: JSON.stringify({ exercise: exercise.name, movement: exercise.movementGroup.name,
        setup: exercise.setupNotes, primary: exercise.primaryMuscles.map((link) => link.muscle.name),
        secondary: pending.map((link) => ({ id: link.muscleId, name: link.muscle.name })) }) },
    ],
    text: { format: zodTextFormat(Assessment, "secondary_muscle_stimulus") },
  }, config.options);
  logCoachingModelUsage(config, response, startedAt);
  const output = response.output_parsed;
  if (!output || output.estimates.length !== pending.length) throw new Error("Secondary contribution assessment incomplete.");
  const expected = new Set(pending.map((link) => link.muscleId));
  if (new Set(output.estimates.map((row) => row.muscleId)).size !== expected.size ||
    output.estimates.some((row) => !expected.has(row.muscleId) || ![0, 0.25, 0.5, 0.75, 1].includes(row.fraction))) {
    throw new Error("Secondary contribution assessment failed deterministic validation.");
  }
  let written = 0;
  for (const row of output.estimates) {
    const result = await prisma.exerciseSecondaryMuscle.updateMany({ where: {
      exerciseId, muscleId: row.muscleId, contributionEstimate: null,
    }, data: { contributionEstimate: row.fraction, assessmentRationale: row.rationale,
      assessedAt: new Date(), assessmentModel: config.request.model, assessmentVersion: { increment: 1 } } });
    written += result.count;
  }
  return written;
}

/** Called after exercise catalog reads to assess older links gradually without delaying the UI. */
export async function assessPendingSecondaryContributions(userId: string) {
  const pending = await prisma.exerciseSecondaryMuscle.findMany({
    where: { contributionEstimate: null, exercise: { OR: [{ userId }, { userId: null, isSeed: true }] } },
    select: { exerciseId: true }, distinct: ["exerciseId"], take: 2,
  });
  for (const row of pending) {
    try { await assessExerciseSecondaryContributions(row.exerciseId); }
    catch (error) { console.error("Secondary contribution backfill failed", error); break; }
  }
}
