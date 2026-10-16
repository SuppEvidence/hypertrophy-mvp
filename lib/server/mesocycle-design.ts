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
  briefSchema,
  designSchema,
  designSchemaForCatalogue,
} from "@/lib/mesocycle-design/schema";
import {
  applyDesignRevision,
  revisionCatalogue,
  revisionSchemaForCatalogue,
  DESIGN_REVISION_POLICY,
} from "@/lib/mesocycle-design/revision";
import { validateDesign } from "@/lib/mesocycle-design/validation";
import { DESIGN_POLICY } from "@/lib/mesocycle-design/policy";
import {
  buildDesignEvidence,
  getDesignReferences,
} from "./mesocycle-design-context";
import { initialT3Range } from "@/lib/coaching/t3-volume-policy";
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const messageSchema = z
  .array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().max(4000),
    }),
  )
  .max(40);
export const designActionSchema = z.object({
  operation: z.enum(["CREATE", "SAVE", "GENERATE", "APPROVE", "ARCHIVE"]),
  id: z.string().uuid().optional(),
  revision: z.number().int().min(0).optional(),
  brief: briefSchema.optional(),
  proposal: designSchema.nullable().optional(),
  message: z.string().trim().max(2000).optional(),
  acknowledgeWarnings: z.boolean().optional(),
  activate: z.boolean().optional(),
});
const leaseMs = 300_000;
function unlocked(row: {
  requestToken: string | null;
  requestStartedAt: Date | null;
}) {
  return (
    !row.requestToken ||
    !row.requestStartedAt ||
    row.requestStartedAt.getTime() < Date.now() - leaseMs
  );
}
export async function getDesignView(userId: string, id: string) {
  const row = await prisma.mesocycleDesign.findFirst({ where: { id, userId } });
  if (!row) throw new Error("Design not found.");
  const refs = await getDesignReferences(userId);
  const brief = briefSchema.parse(row.brief);
  const p = designSchema.safeParse(row.proposal);
  return {
    id: row.id,
    revision: row.revision,
    status: row.status,
    userEdited: row.userEdited,
    brief,
    proposal: p.success ? p.data : null,
    messages: messageSchema.parse(row.messages),
    approvedProgramId: row.approvedProgramId,
    approvedMesocycleId: row.approvedMesocycleId,
    busy: !unlocked(row),
    checks: p.success ? validateDesign(p.data, brief, refs) : null,
  };
}
export async function runDesignAction(userId: string, raw: unknown) {
  const input = designActionSchema.parse(raw);
  if (input.operation === "CREATE") {
    const brief = briefSchema.parse(input.brief);
    const row = await prisma.mesocycleDesign.create({
      data: { userId, brief: json(brief), messages: [] },
    });
    return getDesignView(userId, row.id);
  }
  if (!input.id || input.revision === undefined)
    throw new Error("Design not found. Select a saved draft and revision.");
  const row = await prisma.mesocycleDesign.findFirst({
    where: { id: input.id, userId },
  });
  if (!row) throw new Error("Design not found.");
  // Repeated approval is safe, but can never create a second program.
  if (row.status === "APPROVED" && input.operation === "APPROVE")
    return getDesignView(userId, row.id);
  if (row.status !== "DRAFT")
    throw new Error(
      "This design is already closed. Start a new draft to change the next block.",
    );
  if (row.revision !== input.revision)
    throw new Error(
      "Draft changed in another request. Reload before continuing.",
    );
  if (!unlocked(row))
    throw new Error(
      "A coach request is running. Wait for it to finish; an interrupted request expires after five minutes.",
    );
  const where = {
    id: row.id,
    userId,
    revision: row.revision,
    status: "DRAFT",
    OR: [
      { requestToken: null },
      { requestStartedAt: { lt: new Date(Date.now() - leaseMs) } },
    ],
  };
  if (input.operation === "SAVE" || input.operation === "ARCHIVE") {
    const data =
      input.operation === "ARCHIVE"
        ? { status: "ARCHIVED" }
        : {
            brief: json(briefSchema.parse(input.brief ?? row.brief)),
            userEdited:
              row.userEdited ||
              (input.proposal !== undefined &&
                JSON.stringify(input.proposal) !==
                  JSON.stringify(row.proposal)) ||
              (input.brief !== undefined &&
                JSON.stringify(input.brief) !== JSON.stringify(row.brief)),
            ...(input.proposal !== undefined
              ? {
                  proposal: input.proposal
                    ? json(input.proposal)
                    : Prisma.DbNull,
                }
              : {}),
          };
    const saved = await prisma.mesocycleDesign.updateMany({
      where,
      data: {
        ...data,
        revision: { increment: 1 },
        requestToken: null,
        requestStartedAt: null,
      },
    });
    if (!saved.count)
      throw new Error("Draft changed. Reload before continuing.");
    return getDesignView(userId, row.id);
  }
  const brief = briefSchema.parse(row.brief);
  const refs = await getDesignReferences(userId);
  const previous = designSchema.safeParse(row.proposal);
  if (input.operation === "GENERATE") {
    const token = randomUUID();
    const claim = await prisma.mesocycleDesign.updateMany({
      where,
      data: { requestToken: token, requestStartedAt: new Date() },
    });
    if (!claim.count)
      throw new Error("Another coach request has already started.");
    try {
      const evidence = await buildDesignEvidence(userId, previous.success);
      const messages = messageSchema.parse(row.messages);
      if (messages.length >= 38)
        throw new Error(
          "Discussion is full. Approve or start a new draft with the agreed brief.",
        );
      const question =
        input.message ||
        (previous.success
          ? "Review the current draft against my updated brief; change only what is necessary."
          : "Build a complete mesocycle proposal from my brief.");
      const aiConfig = getCoachingModelConfig("MESOCYCLE_DESIGN");
      const start = Date.now();
      const response = await getOpenAIClient().responses.parse(
        {
          ...aiConfig.request,
          input: [
            {
              role: "system",
              content:
                DESIGN_POLICY +
                (previous.success ? "\n" + DESIGN_REVISION_POLICY : ""),
            },
            {
              role: "user",
              content: JSON.stringify({
                brief,
                evidence,
                catalogue: previous.success
                  ? revisionCatalogue(
                      refs,
                      previous.data,
                      brief.priorities.map((p) => p.muscleId),
                    )
                  : refs,
                previousDraft: previous.success ? previous.data : null,
                recentDiscussion: previous.success
                  ? messages.slice(-6)
                  : messages,
                request: question,
              }),
            },
          ],
          text: {
            format: zodTextFormat(
              previous.success
                ? revisionSchemaForCatalogue(refs)
                : designSchemaForCatalogue(refs),
              previous.success
                ? "mesocycle_design_revision"
                : "mesocycle_design",
            ),
          },
        },
        aiConfig.options,
      );
      logCoachingModelUsage(aiConfig, response, start);
      if (!response.output_parsed)
        throw new Error(
          "Coach response was incomplete. Your previous draft is retained.",
        );
      const proposal = previous.success
        ? applyDesignRevision(
            previous.data,
            revisionSchemaForCatalogue(refs).parse(response.output_parsed),
          )
        : designSchemaForCatalogue(refs).parse(response.output_parsed);
      const locks = validateDesign(
        proposal,
        brief,
        refs,
        previous.success ? previous.data : null,
      ).errors.filter((e) => e.startsWith("Locked item"));
      if (locks.length) throw new Error(locks.join(" "));
      const saved = await prisma.mesocycleDesign.updateMany({
        where: {
          id: row.id,
          userId,
          revision: row.revision,
          requestToken: token,
          status: "DRAFT",
        },
        data: {
          userEdited: false,
          proposal: json(proposal),
          evidence: json(evidence),
          model: aiConfig.request.model,
          messages: json([
            ...messages,
            { role: "user", content: question },
            { role: "assistant", content: proposal.summary },
          ]),
          revision: { increment: 1 },
          requestToken: null,
          requestStartedAt: null,
        },
      });
      if (!saved.count)
        throw new Error(
          "Draft changed while the coach was working. Reload; no newer edits were overwritten.",
        );
    } finally {
      await prisma.mesocycleDesign.updateMany({
        where: { id: row.id, userId, requestToken: token },
        data: { requestToken: null, requestStartedAt: null },
      });
    }
    return getDesignView(userId, row.id);
  }
  if (!previous.success)
    throw new Error("Generate or save a complete proposal first.");
  const plan = previous.data;
  const checks = validateDesign(plan, brief, refs);
  if (checks.errors.length) throw new Error(checks.errors.join(" "));
  if (checks.warnings.length && !input.acknowledgeWarnings)
    throw new Error(
      "Review feasibility warnings and acknowledge the tradeoffs before approval.",
    );
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  if (brief.startDate < today)
    throw new Error(
      "Choose today or a future start date before approving a new block.",
    );
  if (input.activate && brief.startDate > today)
    throw new Error(
      "A future program can be saved now and activated on its start date from Programs.",
    );
  const programId = randomUUID(),
    mesocycleId = randomUUID();
  await prisma.$transaction(
    async (tx) => {
      const claimed = await tx.mesocycleDesign.updateMany({
        where,
        data: {
          status: "APPROVED",
          revision: { increment: 1 },
          approvedProgramId: programId,
          approvedMesocycleId: mesocycleId,
          requestToken: null,
          requestStartedAt: null,
        },
      });
      if (!claimed.count)
        throw new Error(
          "Draft changed or was already approved. Reload before continuing.",
        );
      const freshRefs = await getDesignReferences(userId, tx);
      if (JSON.stringify(freshRefs) !== JSON.stringify(refs))
        throw new Error(
          "Draft changed: exercise data or preferences changed during approval. Reload and review again.",
        );
      // Recheck availability and preferences inside the approval transaction.
      const ids = plan.sessions.flatMap((s) =>
        s.items.map((i) => i.exerciseId!),
      );
      const available = await tx.exercise.findMany({
        where: {
          id: { in: ids },
          isActive: true,
          isArchived: false,
          OR: [{ userId }, { userId: null, isSeed: true }],
          coachingProfiles: {
            none: {
              userId,
              OR: [{ isArchived: true }, { preference: "AVOID" }],
            },
          },
        },
        select: { id: true },
      });
      if (new Set(available.map((e) => e.id)).size !== new Set(ids).size)
        throw new Error(
          "An exercise became unavailable. Reload and review the draft.",
        );
      if (
        input.activate &&
        (await tx.workoutSession.count({ where: { userId, status: "DRAFT" } }))
      )
        throw new Error(
          "Review feasibility: finish or discard your open workout before activating a new program.",
        );
      if (input.activate)
        await tx.program.updateMany({
          where: { userId, isActive: true },
          data: { isActive: false },
        });
      await tx.program.create({
        data: {
          id: programId,
          userId,
          name: plan.name,
          programType: "CUSTOM",
          templateCount: plan.sessions.length,
          rotationStyle: "WEEKDAY_BASED",
          volumeWindowType: "WEEKLY",
          secondaryContribution: 0,
          activePhase: plan.phase,
          isActive: !!input.activate,
          priorityMuscles: {
            create: plan.priorities
              .filter(
                (p) => p.priority === "SPECIALIZE" || p.priority === "GROW",
              )
              .map((p) => ({ muscleId: p.muscleId })),
          },
        },
      });
      for (const [sequenceIndex, day] of [...plan.sessions]
        .sort((a, b) => a.weekday - b.weekday)
        .entries()) {
        await tx.workoutTemplate.create({
          data: {
            userId,
            programId,
            name: day.name,
            sequenceIndex,
            weekday: (day.weekday + 1) % 7,
            expectedOccurrences: 1,
            exercises: {
              create: day.items.map((item, sortOrder) => ({
                exerciseId: item.exerciseId!,
                movementGroupId: refs.exercises.find(
                  (e) => e.id === item.exerciseId,
                )!.movementGroupId,
                sortOrder,
                plannedSets: item.sets,
                minSets: 1,
                maxSets: Math.min(12, item.sets + 3),
                minReps: item.minReps,
                maxReps: item.maxReps,
                rirTarget: item.rir,
                defaultSetTypeId: item.setTypeId!,
                slotRole:
                  item.slotRole === "SECONDARY_COMPOUND"
                    ? "SECONDARY"
                    : item.slotRole,
                repBucket:
                  item.slotRole === "PRIMARY_COMPOUND"
                    ? "HEAVY_COMPOUND"
                    : item.slotRole,
                slotPriority: refs.exercises
                  .find((e) => e.id === item.exerciseId)!
                  .primaryMuscleIds.some((id) =>
                    plan.priorities.some(
                      (p) => p.muscleId === id && p.priority === "SPECIALIZE",
                    ),
                  )
                  ? "PRIORITY"
                  : "STANDARD",
                autoAdjustable: true,
                notes: `${item.purpose}. Rest guideline: ${item.restSeconds}s. ${item.rationale}`,
                setPlans: {
                  create: Array.from({ length: item.sets }, (_, i) => ({
                    setNumber: i + 1,
                    setTypeId: item.setTypeId!,
                  })),
                },
              })),
            },
          },
        });
      }
      const now = new Date();
      await tx.programMesocycle.create({
        data: {
          id: mesocycleId,
          userId,
          programId,
          name: plan.name,
          phase: plan.phase,
          startDate: new Date(`${brief.startDate}T00:00:00Z`),
          lengthWeeks: plan.lengthWeeks,
          t3ActivatedAt: now,
          t3EvaluationStatus: "BASELINE",
          notes: plan.summary,
          approvedDesign: json({
            version: 1,
            designId: row.id,
            approvedAt: now.toISOString(),
            userEdited: row.userEdited,
            brief,
            plan,
            feasibility: checks,
            evidenceGeneratedAt:
              (row.evidence as Record<string, unknown> | null)?.generatedAt ??
              null,
          }),
          musclePriorities: {
            create: refs.muscles
              .filter((m) => !m.accountingSlug && m.slug !== "chest")
              .map((m) => {
                const p = plan.priorities.find((p) => p.muscleId === m.id);
                const priority = p?.priority ?? "INDIRECT_ONLY";
                const baseline = checks.dose[m.id] ?? 0;
                const range = initialT3Range(priority, baseline);
                return {
                  muscleId: m.id,
                  priority,
                  baselineWeeklySets: baseline,
                  coachTargetWeeklySets: baseline,
                  rangeMinimumSets: range.minimum,
                  rangeMaximumSets: range.maximum,
                  coachingStatus: "BASELINE",
                  rationale:
                    p?.rationale ??
                    "No direct focus selected in approved design.",
                  activatedAt: now,
                };
              }),
          },
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 30_000,
    },
  );
  return getDesignView(userId, row.id);
}
