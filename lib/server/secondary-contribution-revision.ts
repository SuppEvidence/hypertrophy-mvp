import "server-only";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getCoachingModelConfig, logCoachingModelUsage } from "@/lib/ai/coaching-models";
import { getOpenAIClient } from "@/lib/ai/openai";
import { selectMesocycleCheckins } from "@/lib/coaching/mesocycle-checkins";

const DAY_MS = 86_400_000;
const fieldForMuscle: Record<string, "chest" | "shoulders" | "arms" | "thighs" | "glutes" | "calves"> = {
  "upper-chest": "chest", "mid-chest": "chest", "lower-chest": "chest",
  "side-delts": "shoulders", "rear-delts": "shoulders", "biceps": "arms",
  "triceps": "arms", "brachialis-brachioradialis": "arms", "quads": "thighs",
  "hamstrings": "thighs", "glutes": "glutes", "calves": "calves",
};
const Review = z.object({
  change: z.boolean(),
  proposedFraction: z.number().min(0).max(1),
  rationale: z.string().min(15).max(450),
});

type Block = { id: string; startDate: Date; lengthWeeks: number; actualEndDate: Date | null };
function blockEnd(block: Block) {
  return block.actualEndDate ?? new Date(block.startDate.getTime() + block.lengthWeeks * 7 * DAY_MS - DAY_MS);
}

/** Reconsider only after two measured blocks with repeated exposure and no direct target work.
 * This is a prompt for biomechanical reassessment, never proof of a causal growth response. */
export async function reconsiderSecondaryContributionsAtT3(userId: string, mesocycleId: string) {
  const current = await prisma.programMesocycle.findFirst({ where: { id: mesocycleId, userId },
    select: { id: true, programId: true, startDate: true, lengthWeeks: true, actualEndDate: true } });
  if (!current) return 0;
  const prior = await prisma.programMesocycle.findFirst({ where: { userId, programId: current.programId, isArchived: false,
    startDate: { lt: current.startDate } }, orderBy: { startDate: "desc" },
    select: { id: true, startDate: true, lengthWeeks: true, actualEndDate: true } });
  if (!prior || blockEnd(prior).getTime() > current.startDate.getTime()) return 0;
  const blocks = [prior, current];
  const [metrics, sessions, links] = await Promise.all([
    prisma.metricLog.findMany({ where: { userId, isDraft: false, loggedAt: { gte: new Date(prior.startDate.getTime() - 7 * DAY_MS),
      lte: new Date(blockEnd(current).getTime() + 7 * DAY_MS) },
      logType: { in: ["MESOCYCLE_START", "MESOCYCLE_END", "MESOCYCLE_CHECKIN"] } },
      select: { loggedAt: true, updatedAt: true, logType: true, chest: true, shoulders: true, arms: true, thighs: true, glutes: true, calves: true } }),
    prisma.workoutSession.findMany({ where: { userId, programId: current.programId, status: "COMPLETED", mesocycleId: { in: blocks.map((row) => row.id) } },
      select: { mesocycleId: true, exercises: { select: { exerciseId: true,
        exercise: { select: { primaryMuscles: { select: { muscleId: true } }, secondaryMuscles: { select: { muscleId: true } } } },
        sets: { where: { isCompleted: true }, select: { id: true } } } } } }),
    prisma.exerciseSecondaryMuscle.findMany({ where: { contributionEstimate: { not: null },
      exercise: { OR: [{ userId }, { userId: null, isSeed: true }] } },
      include: { muscle: { select: { name: true, slug: true } }, exercise: { select: {
        name: true, setupNotes: true, movementGroup: { select: { name: true } }, primaryMuscles: { include: { muscle: { select: { name: true } } } },
      } } }, take: 150 }),
  ]);
  const measured = blocks.map((block, i) => selectMesocycleCheckins({ logs: metrics, startDate: block.startDate,
    endDate: blockEnd(block), priorEndDate: i ? blockEnd(blocks[i - 1]) : undefined, now: new Date() }));
  if (measured.some((row) => !row.ready)) return 0;
  let revised = 0;
  let reviewed = 0;
  for (const link of links) {
    const field = fieldForMuscle[link.muscle.slug];
    if (!field || measured.some((row) => !row.sharedFields.includes(field))) continue;
    const observed = measured.map((row) => Number(row.end![field]) - Number(row.start![field]));
    // Two increases can motivate review. They do not establish exercise causality.
    if (observed.some((change) => !Number.isFinite(change) || change <= 0)) continue;
    const counts = blocks.map((block) => {
      let secondary = 0;
      let direct = 0;
      let other = 0;
      for (const session of sessions.filter((row) => row.mesocycleId === block.id)) for (const entry of session.exercises) {
        if (!entry.sets.length) continue;
        if (entry.exercise.primaryMuscles.some((muscle) => muscle.muscleId === link.muscleId)) direct += entry.sets.length;
        else if (entry.exercise.secondaryMuscles.some((muscle) => muscle.muscleId === link.muscleId)) {
          if (entry.exerciseId === link.exerciseId) secondary += entry.sets.length;
          else other += entry.sets.length;
        }
      }
      return { secondary, direct, other };
    });
    if (counts.some((row) => row.secondary < 6 || row.direct !== 0 || row.other !== 0)) continue;
    const already = await prisma.exerciseSecondaryContributionReview.findUnique({ where: {
      exerciseId_muscleId_mesocycleId: { exerciseId: link.exerciseId, muscleId: link.muscleId, mesocycleId } }, select: { id: true } });
    if (already) continue;
    if (reviewed >= 1) break; // Keep the asynchronous T3 follow-up bounded.
    reviewed += 1;
    const config = getCoachingModelConfig("T3_VOLUME");
    const startedAt = Date.now();
    const response = await getOpenAIClient().responses.parse({ ...config.request, max_output_tokens: 8192,
      input: [
        { role: "system", content: "At T3, reconsider an existing biomechanical indirect-set coefficient. Two blocks showed a circumference increase with one repeated indirect exercise and no other recorded target-muscle work. Circumference is noisy, may include fat or water and several muscles, and does NOT prove causality. Default to no change unless the exercise mechanics independently support that the initial estimate is materially wrong. Choose change=false and repeat the old coefficient when evidence is ambiguous. If changing, move by at most 0.25 using one of 0, .25, .5, .75, 1. Respond with short concrete rationale. Never infer precision or identify muscle growth from circumference alone." },
        { role: "user", content: JSON.stringify({ exercise: link.exercise.name, movement: link.exercise.movementGroup.name,
          setupNotes: link.exercise.setupNotes, primaryMuscles: link.exercise.primaryMuscles.map((row) => row.muscle.name),
          secondaryMuscle: link.muscle.name, currentEstimate: Number(link.contributionEstimate),
          completedSetsPerBlock: counts.map((row) => row.secondary),
          circumferenceField: field, changesAcrossTwoBlocks: observed,
          caution: "Measurement is an observation with confounders; revise only if mechanics support it." }) },
      ], text: { format: zodTextFormat(Review, "secondary_contribution_t3_review") },
    }, config.options);
    logCoachingModelUsage(config, response, startedAt);
    const result = response.output_parsed;
    if (!result || ![0, 0.25, 0.5, 0.75, 1].includes(result.proposedFraction) ||
        Math.abs(result.proposedFraction - Number(link.contributionEstimate)) > 0.25 ||
        (!result.change && result.proposedFraction !== Number(link.contributionEstimate))) continue;
    await prisma.$transaction(async (tx) => {
      if (result.change && result.proposedFraction !== Number(link.contributionEstimate)) {
        const update = await tx.exerciseSecondaryMuscle.updateMany({ where: { exerciseId: link.exerciseId, muscleId: link.muscleId,
          assessmentVersion: link.assessmentVersion, contributionEstimate: link.contributionEstimate }, data: {
          contributionEstimate: result.proposedFraction, assessmentRationale: result.rationale,
          assessmentVersion: { increment: 1 }, assessedAt: new Date(), assessmentModel: config.request.model,
        } });
        if (!update.count) return;
        revised += 1;
      }
      await tx.exerciseSecondaryContributionReview.create({ data: { exerciseId: link.exerciseId,
        muscleId: link.muscleId, mesocycleId, previousEstimate: link.contributionEstimate!,
        newEstimate: result.proposedFraction, rationale: result.rationale,
        evidence: { scope: "TWO_BLOCKS_OBSERVATIONAL", blocks: blocks.map((block) => block.id),
          indirectPhysicalSets: counts.map((row) => row.secondary), circumferenceField: field,
          circumferenceChanges: observed, causalGrowthEstablished: false } as Prisma.InputJsonValue,
        model: config.request.model } });
    });
  }
  return revised;
}
