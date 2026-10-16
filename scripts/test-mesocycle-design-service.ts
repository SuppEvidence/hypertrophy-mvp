// Run only on a disposable current-schema PostgreSQL database. Provider calls are mocked.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/db/prisma";
import { runDesignAction, getDesignView } from "../lib/server/mesocycle-design";
import { getOpenAIClient } from "../lib/ai/openai";
import {
  brief,
  proposal,
  muscleId,
  exerciseId,
  setTypeId,
  movementId,
} from "./mesocycle-design-fixture";
import { currentDesignIntent } from "../lib/server/mesocycle-design-intent";
import { loadCompletedWeekSessions } from "../lib/server/completed-week-evidence";
import { loadCoachingHistory } from "../lib/server/coaching-evidence";
import { completedWeekBaseline } from "../lib/coaching/weekly-coach-baseline";
import { buildProgramPrescription } from "../lib/server/prescriptions";
let calls = 0;
let output = structuredClone(proposal);
let fail = false;
let hold: (() => void) | null = null;
async function main() {
  if (process.env.MESOCYCLE_DESIGN_DISPOSABLE_DB !== "1")
    throw new Error(
      "Disposable database only: set MESOCYCLE_DESIGN_DISPOSABLE_DB=1.",
    );
  const userId = randomUUID(),
    other = randomUUID();
  await prisma.profile.createMany({ data: [{ id: userId }, { id: other }] });
  await prisma.muscle.create({
    data: { id: muscleId, name: "QA delts", slug: "qa-delts" },
  });
  await prisma.movementGroup.create({
    data: { id: movementId, name: "QA Abduction", slug: "qa-abduction" },
  });
  await prisma.setType.create({
    data: {
      id: setTypeId,
      name: "Straight",
      slug: "qa-straight",
      multiplier: 1,
    },
  });
  await prisma.exercise.create({
    data: {
      id: exerciseId,
      name: "QA raise",
      slug: "qa-raise",
      catalogKey: "qa-raise",
      isSeed: true,
      movementGroupId: movementId,
      primaryMuscles: { create: { muscleId } },
    },
  });
  const oldProgram = await prisma.program.create({
    data: {
      userId,
      name: "Old program",
      programType: "CUSTOM",
      rotationStyle: "MANUAL",
      volumeWindowType: "WEEKLY",
      isActive: true,
    },
  });
  const oldSession = await prisma.workoutSession.create({
    data: {
      userId,
      programId: oldProgram.id,
      name: "Earlier workout",
      status: "COMPLETED",
      exercises: {
        create: {
          exerciseId,
          sets: {
            create: {
              setNumber: 1,
              setTypeId,
              isCompleted: true,
              weight: 10,
              reps: 12,
              rir: 2,
            },
          },
        },
      },
    },
  });
  const client = getOpenAIClient();
  (
    client.responses as unknown as { parse: (v: unknown) => Promise<unknown> }
  ).parse = async (input) => {
    calls++;
    assert.ok(JSON.stringify(input).includes('"store":false'));
    if (fail) throw new Error("Mock provider failed");
    if (hold)
      await new Promise<void>((r) => {
        hold = r;
      });
    const payload = input as {
      text: { format: { name: string } };
      input: Array<{ content: string }>;
    };
    const isRevision = payload.text.format.name === "mesocycle_design_revision";
    const context = JSON.parse(payload.input[1].content);
    if (isRevision) {
      assert.match(context.evidence.detail, /REVISION_SUMMARIES/);
      assert.ok(
        context.evidence.exerciseHistory.every(
          (row: { recentExposures: Array<{ sets?: unknown }> }) =>
            row.recentExposures.every((r) => r.sets === undefined),
        ),
      );
      assert.ok(context.recentDiscussion.length <= 6);
    }
    return {
      output_parsed: isRevision
        ? {
            summary: output.summary,
            changes: output.changes,
            fields: Object.fromEntries(
              Object.keys(output)
                .filter(
                  (k) =>
                    !["version", "sessions", "summary", "changes"].includes(k),
                )
                .map((k) => [k, null]),
            ),
            changedSessions: output.sessions,
            removedSessionKeys: [],
          }
        : output,
      status: "completed",
    };
  };
  let view = await runDesignAction(userId, { operation: "CREATE", brief });
  assert.equal(calls, 0);
  await assert.rejects(
    runDesignAction(other, {
      operation: "SAVE",
      id: view.id,
      revision: view.revision,
      brief,
    }),
    /not found/,
  );
  await assert.rejects(
    runDesignAction(userId, {
      operation: "SAVE",
      revision: view.revision,
      brief,
    }),
    /not found/,
  );
  view = await runDesignAction(userId, {
    operation: "GENERATE",
    id: view.id,
    revision: view.revision,
  });
  assert.equal(calls, 1);
  assert.ok(view.proposal);
  assert.equal(view.messages.length, 2);
  const locked = structuredClone(view.proposal!);
  locked.sessions[0].items[0].locked = true;
  view = await runDesignAction(userId, {
    operation: "SAVE",
    id: view.id,
    revision: view.revision,
    proposal: locked,
  });
  assert.equal(calls, 1);
  await assert.rejects(
    runDesignAction(userId, {
      operation: "SAVE",
      id: view.id,
      revision: 0,
      proposal,
    }),
    /changed/,
  );
  await assert.rejects(
    runDesignAction(userId, {
      operation: "GENERATE",
      id: view.id,
      revision: view.revision,
      message: "Keep my locked choices.",
    }),
    /Locked item/,
  );
  assert.equal(
    (await getDesignView(userId, view.id)).proposal!.sessions[0].items[0]
      .locked,
    true,
  );
  fail = true;
  await assert.rejects(
    runDesignAction(userId, {
      operation: "GENERATE",
      id: view.id,
      revision: view.revision,
    }),
    /Mock provider/,
  );
  fail = false;
  assert.equal((await getDesignView(userId, view.id)).busy, false);
  output = locked;
  hold = () => {};
  const running = runDesignAction(userId, {
    operation: "GENERATE",
    id: view.id,
    revision: view.revision,
    message: "Preserve this.",
  });
  // Wait until the provider is entered, without making another provider request.
  while (calls < 4) await new Promise((r) => setTimeout(r, 10));
  await assert.rejects(
    runDesignAction(userId, {
      operation: "GENERATE",
      id: view.id,
      revision: view.revision,
    }),
    /request is running/,
  );
  hold!();
  hold = null;
  view = await running;
  assert.equal(calls, 4);
  const before = calls;
  view = await runDesignAction(userId, {
    operation: "APPROVE",
    id: view.id,
    revision: view.revision,
    acknowledgeWarnings: true,
    activate: true,
  });
  assert.equal(calls, before);
  assert.equal(view.status, "APPROVED");
  const program = await prisma.program.findUniqueOrThrow({
    where: { id: view.approvedProgramId! },
    include: {
      templates: { include: { exercises: { include: { setPlans: true } } } },
      mesocycles: { include: { musclePriorities: true } },
    },
  });
  assert.equal((await currentDesignIntent(userId))?.goals, brief.goals);
  assert.equal(await currentDesignIntent(other), null);
  assert.equal(program.templates.length, 2);
  assert.equal(program.isActive, true);
  assert.equal(program.templates[0].exercises[0].plannedSets, 3);
  assert.equal(program.templates[0].exercises[0].setPlans.length, 3);
  assert.equal(
    Number(program.mesocycles[0].musclePriorities[0].coachTargetWeeklySets),
    6,
  );
  const prescription = await buildProgramPrescription(program.id, userId, {
    includeWeeklyPlan: false,
    mesocycleId: view.approvedMesocycleId,
  });
  assert.equal(prescription?.generated.items.length, 2);
  assert.ok(
    prescription?.generated.items.every((i) => i.adjustedPlannedSets === 3),
  );
  const again = await runDesignAction(userId, {
    operation: "APPROVE",
    id: view.id,
    revision: 0,
  });
  assert.equal(again.approvedProgramId, program.id);
  assert.equal(await prisma.program.count({ where: { userId } }), 2);
  const since = new Date(Date.now() - 7 * 86400000),
    until = new Date(Date.now() + 86400000);
  const history = await loadCoachingHistory(userId, null, since);
  assert.equal(history.length, 1);
  assert.equal(history[0].session.programId, oldProgram.id);
  assert.equal((await loadCoachingHistory(other, null, since)).length, 0);
  const baseline = completedWeekBaseline(
    await loadCompletedWeekSessions(userId, since, until),
  );
  assert.equal(baseline.sessions[0].id, oldSession.id);
  assert.equal(baseline.sessions[0].muscles[muscleId], 1);
  assert.equal(
    (await loadCompletedWeekSessions(other, since, until)).length,
    0,
  );
  assert.equal(
    (await prisma.program.findUniqueOrThrow({ where: { id: oldProgram.id } }))
      .isActive,
    false,
  );
  const invalid = await runDesignAction(userId, { operation: "CREATE", brief });
  const broken = structuredClone(proposal);
  broken.sessions[0].items[0].exerciseId = null;
  const saved = await runDesignAction(userId, {
    operation: "SAVE",
    id: invalid.id,
    revision: invalid.revision,
    proposal: broken,
  });
  await assert.rejects(
    runDesignAction(userId, {
      operation: "APPROVE",
      id: saved.id,
      revision: saved.revision,
      acknowledgeWarnings: true,
    }),
    /active library/,
  );
  assert.equal(
    await prisma.program.count({ where: { userId } }),
    2,
    "Invalid approval creates nothing",
  );
  console.log(
    "PASS: real DB create/save, ownership, revision guards, one explicit AI request, failed/locked response preservation, concurrent request lease, atomic approval, repeat approval, saved priorities/set plans and existing prescription compatibility.",
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
