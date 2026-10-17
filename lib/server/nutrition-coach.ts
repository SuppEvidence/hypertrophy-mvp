import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { prisma } from "@/lib/db/prisma";
import { getOpenAIClient } from "@/lib/ai/openai";
import {
  getCoachingModelConfig,
  logCoachingModelUsage,
} from "@/lib/ai/coaching-models";
import {
  actionSchema,
  baselineSchema,
  draftSchema,
  emptyBaseline,
  proposalSchema,
  applyChanges,
  discussionBaseline,
  type Draft,
} from "@/lib/nutrition/schema";
import { NUTRITION_POLICY } from "@/lib/nutrition/policy";
import {
  buildNutritionEvidence,
  nutritionEvidenceStamp,
} from "./nutrition-context";
import { interpretEnergyPhase } from "@/lib/coaching/energy-phase";
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const leaseMs = 300000;
const patchSchema = z.object(
  Object.fromEntries(
    Object.entries(proposalSchema.shape).map(([key, value]) => [
      key,
      value.nullable(),
    ]),
  ),
);
// Explicit nullable fields produce a strict Structured Outputs schema. Null preserves the previous field.
const discussionSchema = z.object({
  reply: z.string().min(1).max(3000),
  proposalPatch: patchSchema.nullable(),
  clearPhase: z.boolean(),
});

export async function getNutritionView(userId: string) {
  const [row, events, phases, stamp] = await Promise.all([
    prisma.nutritionState.findUnique({ where: { userId } }),
    prisma.nutritionEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, kind: true, createdAt: true, details: true },
    }),
    prisma.energyPhase.findMany({
      where: { userId },
      orderBy: { startDate: "desc" },
      take: 24,
    }),
    nutritionEvidenceStamp(userId),
  ]);
  const draft = draftSchema.safeParse(row?.draft);
  return {
    revision: row?.revision ?? 0,
    saved: Boolean(row),
    baseline: row ? baselineSchema.parse(row.baseline) : emptyBaseline,
    draft: draft.success ? draft.data : null,
    evidenceChanged:
      draft.success &&
      (draft.data.evidenceStamp !== stamp ||
        Date.now() - Date.parse(draft.data.reviewedAt) > 14 * 86400000),
    busy: Boolean(
      row?.requestToken &&
      row.requestStartedAt &&
      Date.now() - row.requestStartedAt.getTime() < leaseMs,
    ),
    phase: interpretEnergyPhase(phases),
    scheduledPhases: phases
      .filter((p) => p.startDate > new Date())
      .map((p) => ({
        phase: p.phase,
        startDate: p.startDate.toISOString().slice(0, 10),
      })),
    events: events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
  };
}

export async function runNutritionAction(userId: string, raw: unknown) {
  const input = actionSchema.parse(raw);
  const row = await prisma.nutritionState.findUnique({ where: { userId } });
  if (!row) {
    if (
      input.operation !== "SAVE_BASELINE" ||
      input.revision !== 0 ||
      !input.baseline
    )
      throw new Error("Nutrition: save your baseline first.");
    await prisma.$transaction(async (tx) => {
      await tx.nutritionState.create({
        data: { userId, baseline: json(input.baseline), revision: 1 },
      });
      await tx.nutritionEvent.create({
        data: {
          userId,
          kind: "BASELINE",
          baseline: json(input.baseline),
          details: { summary: "Initial diet baseline saved." },
        },
      });
    });
    return getNutritionView(userId);
  }
  if (row.revision !== input.revision)
    throw new Error(
      "Nutrition: this plan changed in another window. Reload before continuing.",
    );
  if (
    row.requestToken &&
    row.requestStartedAt &&
    Date.now() - row.requestStartedAt.getTime() < leaseMs
  )
    throw new Error(
      "Nutrition: a coach request is already running. Wait for it to finish.",
    );
  const baseline = baselineSchema.parse(row.baseline);
  const parsedDraft = draftSchema.safeParse(row.draft);
  const draft = parsedDraft.success ? parsedDraft.data : null;
  const aiOperation =
    input.operation === "REVIEW" || input.operation === "DISCUSS";
  if (aiOperation) {
    if (input.operation === "DISCUSS" && (!draft || !input.message))
      throw new Error(
        "Nutrition: run an outcome review before discussing a proposal.",
      );
    const token = randomUUID();
    const lease = await prisma.nutritionState.updateMany({
      where: {
        userId,
        revision: row.revision,
        OR: [
          { requestToken: null },
          { requestStartedAt: { lt: new Date(Date.now() - leaseMs) } },
        ],
      },
      data: { requestToken: token, requestStartedAt: new Date() },
    });
    if (!lease.count)
      throw new Error(
        "Nutrition: another request already started. Reload after it finishes.",
      );
    try {
      const stamp = await nutritionEvidenceStamp(userId);
      const aiConfig =
        input.operation === "REVIEW"
          ? getCoachingModelConfig("NUTRITION_REVIEW")
          : getCoachingModelConfig("NUTRITION_DISCUSSION");
      const payload =
        input.operation === "REVIEW"
          ? {
              mode: "OUTCOME_REVIEW",
              baseline,
              evidence: await buildNutritionEvidence(userId),
              question: input.message ?? null,
            }
          : {
              mode: "DISCUSSION",
              baseline: discussionBaseline(baseline, input.message!),
              reviewedAt: draft!.reviewedAt,
              savedProposal: draft!.proposal,
              evidenceChanged:
                stamp !== draft!.evidenceStamp ||
                Date.now() - Date.parse(draft!.reviewedAt) > 14 * 86400000,
              recentMessages: draft!.messages.slice(-6),
              message: input.message,
            };
      const started = Date.now();
      const response = await getOpenAIClient().responses.parse(
        {
          ...aiConfig.request,
          input: [
            { role: "system", content: NUTRITION_POLICY },
            { role: "user", content: JSON.stringify(payload) },
          ],
          text: {
            format:
              input.operation === "REVIEW"
                ? zodTextFormat(proposalSchema, "nutrition_review")
                : zodTextFormat(discussionSchema, "nutrition_discussion"),
          },
        },
        aiConfig.options,
      );
      logCoachingModelUsage(aiConfig, response, started);
      if (!response.output_parsed)
        throw new Error(
          "Nutrition: the coach did not return a complete response. Your saved plan is unchanged.",
        );
      let next: Draft;
      if (input.operation === "REVIEW") {
        const proposal = proposalSchema.parse(response.output_parsed);
        next = {
          reviewedAt: new Date().toISOString(),
          evidenceStamp: stamp,
          proposal,
          messages: [{ role: "assistant", content: proposal.assessment }],
        };
      } else {
        const answer = discussionSchema.parse(response.output_parsed);
        const patch = Object.fromEntries(
          Object.entries(answer.proposalPatch ?? {}).filter(
            ([, value]) => value !== null,
          ),
        );
        const proposal = proposalSchema.parse({
          ...draft!.proposal,
          ...patch,
          ...(answer.clearPhase
            ? { phase: null, phaseReason: "", suggestedPhaseWeeks: null }
            : {}),
        });
        next = {
          ...draft!,
          proposal,
          messages: [
            ...draft!.messages,
            { role: "user" as const, content: input.message! },
            { role: "assistant" as const, content: answer.reply },
          ].slice(-12),
        };
      }
      applyChanges(baseline, next.proposal); // Reject hallucinated meal references and impossible estimates before persistence.
      const saved = await prisma.nutritionState.updateMany({
        where: { userId, revision: row.revision, requestToken: token },
        data: {
          draft: json(next),
          revision: { increment: 1 },
          requestToken: null,
          requestStartedAt: null,
        },
      });
      if (!saved.count)
        throw new Error(
          "Nutrition: the plan changed while the coach was working. Reload.",
        );
    } finally {
      await prisma.nutritionState.updateMany({
        where: { userId, requestToken: token },
        data: { requestToken: null, requestStartedAt: null },
      });
    }
    return getNutritionView(userId);
  }
  await prisma.$transaction(
    async (tx) => {
      // Claim the revision first; concurrent saves/acceptances cannot apply a delta twice.
      const claimed = await tx.nutritionState.updateMany({
        where: {
          userId,
          revision: input.revision,
          OR: [
            { requestToken: null },
            { requestStartedAt: { lt: new Date(Date.now() - leaseMs) } },
          ],
        },
        data: {
          revision: { increment: 1 },
          requestToken: null,
          requestStartedAt: null,
        },
      });
      if (!claimed.count)
        throw new Error(
          "Nutrition: this plan changed. Reload before continuing.",
        );
      if (input.operation === "SAVE_BASELINE") {
        if (!input.baseline) throw new Error("Nutrition: provide a baseline.");
        await tx.nutritionState.update({
          where: { userId },
          data: { baseline: json(input.baseline), draft: Prisma.DbNull },
        });
        await tx.nutritionEvent.create({
          data: {
            userId,
            kind: "BASELINE",
            baseline: json(input.baseline),
            details: {
              summary:
                "Diet baseline manually updated; previous versions remain in history.",
            },
          },
        });
      } else if (input.operation === "CHECK_IN") {
        if (!input.report) throw new Error("Nutrition: provide a check-in.");
        await tx.nutritionEvent.create({
          data: { userId, kind: "CHECK_IN", details: json(input.report) },
        });
      } else if (input.operation === "DISMISS") {
        await tx.nutritionState.update({
          where: { userId },
          data: { draft: Prisma.DbNull },
        });
      } else if (input.operation === "ACCEPT") {
        if (!draft) throw new Error("Nutrition: generate a proposal first.");
        if (
          Date.now() - Date.parse(draft.reviewedAt) > 14 * 86400000 ||
          draft.evidenceStamp !== (await nutritionEvidenceStamp(userId, tx))
        )
          throw new Error(
            "Nutrition: evidence changed since the review. Run a new outcome review before accepting.",
          );
        const next = applyChanges(baseline, draft.proposal);
        const now = new Date();
        const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
        let phaseApplied = false;
        if (input.applyPhase && draft.proposal.phase) {
          await tx.energyPhase.upsert({
            where: { userId_startDate: { userId, startDate: today } },
            create: { userId, startDate: today, phase: draft.proposal.phase },
            update: { phase: draft.proposal.phase },
          });
          phaseApplied = true;
        }
        await tx.nutritionState.update({
          where: { userId },
          data: { baseline: json(next), draft: Prisma.DbNull },
        });
        await tx.nutritionEvent.create({
          data: {
            userId,
            kind: "ACCEPTED",
            baseline: json(next),
            details: json({
              summary:
                draft.proposal.changes.map((c) => c.instruction).join("; ") ||
                "Keep current diet structure.",
              proposal: draft.proposal,
              phaseApplied,
              phaseEffectiveOn: phaseApplied
                ? today.toISOString().slice(0, 10)
                : null,
              trainingHandoff: `${draft.proposal.phase && !phaseApplied ? "Proposed phase was not accepted; retain the declared phase. " : ""}${draft.proposal.trainingHandoff}`,
              reviewDueOn: new Date(
                now.getTime() + draft.proposal.reviewAfterDays * 86400000,
              )
                .toISOString()
                .slice(0, 10),
              reviewedAt: draft.reviewedAt,
              reviewCriteria: draft.proposal.reviewCriteria,
            }),
          },
        });
      }
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 15000,
    },
  );
  return getNutritionView(userId);
}
