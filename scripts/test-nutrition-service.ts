/* eslint-disable @typescript-eslint/no-explicit-any -- Mock model transport and captured request envelopes in this disposable-database test. */
import assert from "node:assert/strict";
import { prisma } from "../lib/db/prisma";
import { getOpenAIClient } from "../lib/ai/openai";
import {
  runNutritionAction,
  getNutritionView,
} from "../lib/server/nutrition-coach";
import { getNutritionTrainingContext } from "../lib/server/nutrition-context";
import { emptyBaseline } from "../lib/nutrition/schema";
async function main() {
  if (process.env.NUTRITION_TEST_DATABASE !== "disposable")
    throw new Error(
      "Use only a disposable test database; set NUTRITION_TEST_DATABASE=disposable explicitly.",
    );
  const userId = "11111111-1111-4111-8111-111111111111",
    other = "22222222-2222-4222-8222-222222222222",
    mealId = "33333333-3333-4333-8333-333333333333";
  await prisma.profile.createMany({ data: [{ id: userId }, { id: other }] });
  const baseline = {
    ...emptyBaseline,
    goal: "Gain slowly; keep meals practical",
    dailyMacros: { protein: 170, carbs: 300, fat: 80 },
    meals: [
      {
        id: mealId,
        name: "Lunch",
        foods: "Normal lunch",
        macros: { protein: 40, carbs: 70, fat: 20 },
      },
    ],
  };
  const proposal = {
    assessment: "Try one adjustment",
    evidence: [],
    uncertainties: ["Sparse history"],
    changes: [
      {
        mealId,
        instruction: "Add 25g carbs to lunch",
        rationale: "Trial",
        proteinDelta: 0,
        carbsDelta: 25,
        fatDelta: 0,
      },
    ],
    phase: "GAINING",
    phaseReason: "Matches goal",
    suggestedPhaseWeeks: 8,
    reviewAfterDays: 14,
    reviewCriteria: "Review response",
    trainingHandoff: "Do not change training automatically",
    questions: [],
  };
  const calls: any[] = [];
  let nextOutput: any = proposal;
  let hold: Promise<void> | null = null;
  (getOpenAIClient().responses as any).parse = async (request: any) => {
    calls.push(request);
    if (hold) await hold;
    if (nextOutput instanceof Error) throw nextOutput;
    return { output_parsed: nextOutput, status: "completed" };
  };
  let view = await getNutritionView(userId);
  assert.equal(calls.length, 0);
  assert.equal(view.saved, false);
  view = await runNutritionAction(userId, {
    operation: "SAVE_BASELINE",
    revision: 0,
    baseline,
  });
  assert.equal(view.revision, 1);
  assert.equal(calls.length, 0);
  await assert.rejects(
    runNutritionAction(other, { operation: "ACCEPT", revision: view.revision }),
    /save your baseline/,
  );
  assert.equal((await getNutritionView(other)).saved, false);
  view = await runNutritionAction(userId, {
    operation: "CHECK_IN",
    revision: view.revision,
    report: {
      adherence: "MOSTLY",
      hunger: 3,
      energy: 4,
      digestion: "Fine",
      notes: "Followed for two weeks",
    },
  });
  assert.equal(calls.length, 0);
  view = await runNutritionAction(userId, {
    operation: "REVIEW",
    revision: view.revision,
  });
  assert.equal(calls.length, 1);
  assert.equal(view.evidenceChanged, false);
  const reviewPayload = JSON.parse(calls[0].input[1].content);
  assert.ok(reviewPayload.evidence.weekly);
  assert.ok(!JSON.stringify(reviewPayload).includes("input_image"));
  nextOutput = {
    reply: "Keep lunch placement; review in three weeks.",
    proposalPatch: {
      ...Object.fromEntries(Object.keys(proposal).map((k) => [k, null])),
      reviewAfterDays: 21,
    },
    clearPhase: false,
  };
  view = await runNutritionAction(userId, {
    operation: "DISCUSS",
    revision: view.revision,
    message: "Can I review in three weeks?",
  });
  assert.equal(calls.length, 2);
  assert.equal(view.draft!.proposal.reviewAfterDays, 21);
  assert.equal(view.draft!.proposal.changes[0].carbsDelta, 25);
  const followup = JSON.parse(calls[1].input[1].content);
  assert.equal(followup.evidence, undefined);
  assert.equal(followup.mode, "DISCUSSION");
  assert.ok(followup.recentMessages.length <= 6);
  const acceptRevision = view.revision;
  view = await runNutritionAction(userId, {
    operation: "ACCEPT",
    revision: acceptRevision,
    applyPhase: false,
  });
  assert.equal(view.baseline.dailyMacros.carbs, 325);
  assert.equal(view.baseline.meals[0].macros.carbs, 95);
  assert.equal(view.phase, null);
  assert.equal(calls.length, 2);
  await assert.rejects(
    runNutritionAction(userId, {
      operation: "ACCEPT",
      revision: acceptRevision,
    }),
    /changed/,
  );
  assert.equal(
    (await getNutritionView(userId)).baseline.dailyMacros.carbs,
    325,
  );
  const handoff = await getNutritionTrainingContext(userId);
  assert.ok(handoff?.acceptedChange);
  assert.equal((handoff as any).meals, undefined);
  assert.equal(await getNutritionTrainingContext(other), null);
  assert.equal(
    await getNutritionTrainingContext(userId, new Date("2000-01-01")),
    null,
  );
  nextOutput = { ...proposal, changes: [] };
  view = await runNutritionAction(userId, {
    operation: "REVIEW",
    revision: view.revision,
  });
  await prisma.metricLog.create({ data: { userId, bodyweight: 80 } });
  await assert.rejects(
    runNutritionAction(userId, {
      operation: "ACCEPT",
      revision: view.revision,
      applyPhase: true,
    }),
    /evidence changed/,
  );
  assert.equal(await prisma.energyPhase.count({ where: { userId } }), 0);
  view = await runNutritionAction(userId, {
    operation: "REVIEW",
    revision: view.revision,
  });
  view = await runNutritionAction(userId, {
    operation: "ACCEPT",
    revision: view.revision,
    applyPhase: true,
  });
  assert.equal(view.phase!.phase, "GAINING");
  assert.equal(view.baseline.dailyMacros.carbs, 325);
  nextOutput = new Error("mock model failure");
  await assert.rejects(
    runNutritionAction(userId, {
      operation: "REVIEW",
      revision: view.revision,
    }),
    /mock model failure/,
  );
  assert.equal((await getNutritionView(userId)).busy, false);
  assert.equal((await getNutritionView(userId)).revision, view.revision);
  nextOutput = {
    ...proposal,
    changes: [{ ...proposal.changes[0], mealId: other }],
  };
  await assert.rejects(
    runNutritionAction(userId, {
      operation: "REVIEW",
      revision: view.revision,
    }),
    /meal no longer/,
  );
  assert.equal((await getNutritionView(userId)).draft, null);
  nextOutput = { ...proposal, changes: [] };
  let release!: () => void;
  hold = new Promise<void>((r) => (release = r));
  const running = runNutritionAction(userId, {
    operation: "REVIEW",
    revision: view.revision,
  });
  while (!(await getNutritionView(userId)).busy)
    await new Promise((r) => setTimeout(r, 10));
  await assert.rejects(
    runNutritionAction(userId, {
      operation: "REVIEW",
      revision: view.revision,
    }),
    /already running/,
  );
  await assert.rejects(
    runNutritionAction(userId, {
      operation: "SAVE_BASELINE",
      revision: view.revision,
      baseline,
    }),
    /already running/,
  );
  release();
  await running;
  hold = null;
  view = await getNutritionView(userId);
  view = await runNutritionAction(userId, {
    operation: "SAVE_BASELINE",
    revision: view.revision,
    baseline,
  });
  assert.equal(view.draft, null);
  assert.equal(
    await prisma.nutritionEvent.count({ where: { userId, kind: "ACCEPTED" } }),
    2,
  );
  assert.equal((await getNutritionView(other)).events.length, 0);
  console.log(
    "Service integration passed: ownership, no-AI saves/check-ins/approval, compact discussion, exact-once acceptance, phase opt-in, stale evidence, failure cleanup, lease and baseline reset.",
  );
  console.log(
    "Representative prompt characters: review=" +
      JSON.stringify(reviewPayload).length +
      ", discussion=" +
      JSON.stringify(followup).length,
  );
  await prisma.$disconnect();
  await (globalThis as any).prismaPool?.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
