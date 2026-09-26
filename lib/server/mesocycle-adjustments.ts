"use server";

import { secondaryContributionFor } from "@/lib/coaching/secondary-contribution";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";
import { parseMesocycleStructureOverrides } from "@/lib/planning/mesocycleStructure";
import { buildProgramPrescription } from "@/lib/server/prescriptions";

const QUICK_ADD_PREFIX = "quick-adjust:add:";
const QUICK_REMOVE_PREFIX = "quick-adjust:remove:";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function clampInteger(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function quickAddId(mesocycleId: string, templateExerciseId: string) {
  return `${QUICK_ADD_PREFIX}${mesocycleId}:${templateExerciseId}`;
}

function quickRemoveId(mesocycleId: string, templateExerciseId: string) {
  return `${QUICK_REMOVE_PREFIX}${mesocycleId}:${templateExerciseId}`;
}

function revalidateMesocycleAdjustmentViews(programId: string) {
  revalidatePath("/plan");
  revalidatePath("/plan/mesocycle");
  revalidatePath(`/programs/${programId}`);
  revalidatePath("/templates");
  revalidatePath("/log");
  revalidatePath("/dashboard");
  revalidatePath("/progress");
  revalidatePath("/ai-analysis");
}

async function getActiveProgramAndMesocycle(userId: string) {
  const program = await prisma.program.findFirst({
    where: { userId, isActive: true, isArchived: false },
    include: {
      templates: {
        where: { isActive: true, isArchived: false },
        orderBy: { sequenceIndex: "asc" },
        include: {
          exercises: {
            orderBy: { sortOrder: "asc" },
            include: {
              exercise: {
                include: {
                  movementGroup: true,
                  primaryMuscles: true,
                  secondaryMuscles: true,
                },
              },
              movementGroup: true,
              defaultSetType: true,
              setPlans: { orderBy: { setNumber: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!program) return { program: null, mesocycle: null };

  const now = new Date();
  const candidates = await prisma.programMesocycle.findMany({
    where: {
      userId,
      programId: program.id,
      isArchived: false,
      actualEndDate: null,
      startDate: { lte: now },
    },
    orderBy: { startDate: "desc" },
    take: 12,
  });

  const mesocycle =
    candidates.find(
      (item) => addDays(item.startDate, item.lengthWeeks * 7) > now,
    ) ?? null;

  return { program, mesocycle };
}

async function movementGroupsForUser(userId: string) {
  const exercises = await prisma.exercise.findMany({
    where: {
      isArchived: false,
      isActive: true,
      OR: [{ isSeed: true, userId: null }, { userId }],
    },
    orderBy: [{ isSeed: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      movementGroupId: true,
      movementGroup: {
        select: { id: true, name: true, sortOrder: true },
      },
      primaryMuscles: { select: { muscleId: true } },
      secondaryMuscles: { select: { muscleId: true, contributionEstimate: true } },
    },
  });

  const groups = new Map<
    string,
    {
      id: string;
      name: string;
      sortOrder: number;
      exercises: typeof exercises;
      muscleIds: Set<string>;
    }
  >();

  for (const exercise of exercises) {
    let current = groups.get(exercise.movementGroupId);
    if (!current) {
      current = {
        id: exercise.movementGroup.id,
        name: exercise.movementGroup.name,
        sortOrder: exercise.movementGroup.sortOrder,
        exercises: [],
        muscleIds: new Set<string>(),
      };
      groups.set(exercise.movementGroupId, current);
    }
    current.exercises.push(exercise);
    for (const link of exercise.primaryMuscles)
      current.muscleIds.add(link.muscleId);
    for (const link of exercise.secondaryMuscles)
      if (secondaryContributionFor(link) > 0) current.muscleIds.add(link.muscleId);
  }

  return Array.from(groups.values()).sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
}

function manualStateForTemplateExercise(
  mesocycleId: string,
  templateExerciseId: string,
  structureOverrides: unknown,
) {
  const state = parseMesocycleStructureOverrides(structureOverrides);
  const addId = quickAddId(mesocycleId, templateExerciseId);
  const removeId = quickRemoveId(mesocycleId, templateExerciseId);
  const add =
    state.actions.find(
      (action) => action.type === "ADD_SLOT" && action.id === addId,
    ) ?? null;
  const remove =
    state.actions.find(
      (action) => action.type === "REMOVE_SLOT" && action.id === removeId,
    ) ?? null;
  return { add, remove };
}

export async function getCurrentMesocycleAdjustmentData() {
  const userId = await requireUserId();
  const { program, mesocycle } =
    await getActiveProgramAndMesocycle(userId);

  if (!program) {
    return {
      program: null,
      mesocycle: null,
      movementGroups: [],
      templates: [],
    };
  }

  if (!mesocycle) {
    return {
      program: { id: program.id, name: program.name },
      mesocycle: null,
      movementGroups: [],
      templates: [],
    };
  }

  const [prescription, movementGroups] = await Promise.all([
    buildProgramPrescription(program.id, userId, {
      mesocycleId: mesocycle.id,
      includeWeeklyPlan: false,
    }),
    movementGroupsForUser(userId),
  ]);

  const generatedById = new Map(
    (prescription?.generated.items ?? []).map((item) => [item.id, item]),
  );

  const movementGroupRows = movementGroups.map((group) => ({
    id: group.id,
    name: group.name,
    sortOrder: group.sortOrder,
  }));

  const templates = program.templates.map((template) => ({
    id: template.id,
    name: template.name,
    sequenceIndex: template.sequenceIndex,
    slots: template.exercises.map((slot) => {
      const baseMovementGroup =
        slot.movementGroup ?? slot.exercise.movementGroup;
      const generated = generatedById.get(slot.id);
      const manual = manualStateForTemplateExercise(
        mesocycle.id,
        slot.id,
        mesocycle.structureOverrides,
      );
      const manualAdd =
        manual.add?.type === "ADD_SLOT" ? manual.add : null;
      const isHidden = Boolean(manual.remove && !manualAdd);
      const currentMovementGroupId =
        manualAdd?.movementGroupId ??
        generated?.movementGroupId ??
        baseMovementGroup.id;
      const currentMovementGroupName =
        movementGroups.find((group) => group.id === currentMovementGroupId)
          ?.name ??
        generated?.movementGroupName ??
        baseMovementGroup.name;
      const currentSets = isHidden
        ? 0
        : (manualAdd?.plannedSets ??
          generated?.adjustedPlannedSets ??
          slot.plannedSets);
      const allowedMaxSets = Math.max(
        slot.plannedSets,
        slot.maxSets ?? slot.plannedSets,
      );

      const sourceMuscleIds = new Set([
        ...slot.exercise.primaryMuscles.map((link) => link.muscleId),
        ...slot.exercise.secondaryMuscles.filter((link) => secondaryContributionFor(link) > 0).map((link) => link.muscleId),
      ]);
      const relatedMovementGroupIds = movementGroups
        .filter((group) =>
          Array.from(group.muscleIds).some((muscleId) =>
            sourceMuscleIds.has(muscleId),
          ),
        )
        .map((group) => group.id);

      return {
        id: slot.id,
        templateId: template.id,
        baseMovementGroupId: baseMovementGroup.id,
        baseMovementGroupName: baseMovementGroup.name,
        currentMovementGroupId,
        currentMovementGroupName,
        baseSets: slot.plannedSets,
        currentSets,
        minSets: 0,
        maxSets: allowedMaxSets,
        prescribedMinReps: generated?.prescribedMinReps ?? slot.minReps,
        prescribedMaxReps: generated?.prescribedMaxReps ?? slot.maxReps,
        manualOverride: Boolean(manual.add || manual.remove),
        hidden: isHidden,
        relatedMovementGroupIds,
      };
    }),
  }));

  const start = new Date(mesocycle.startDate);
  const daysElapsed = Math.max(
    0,
    Math.floor((Date.now() - start.getTime()) / 86_400_000),
  );
  const currentWeek = Math.min(
    mesocycle.lengthWeeks,
    Math.max(1, Math.floor(daysElapsed / 7) + 1),
  );

  return {
    program: { id: program.id, name: program.name },
    mesocycle: {
      id: mesocycle.id,
      name: mesocycle.name,
      phase: mesocycle.phase,
      currentWeek,
      lengthWeeks: mesocycle.lengthWeeks,
    },
    movementGroups: movementGroupRows,
    templates,
  };
}

async function preferredExerciseForMovement(
  userId: string,
  movementGroupId: string,
  currentExerciseId?: string | null,
) {
  if (currentExerciseId) {
    const current = await prisma.exercise.findFirst({
      where: {
        id: currentExerciseId,
        movementGroupId,
        isActive: true,
        isArchived: false,
        OR: [{ isSeed: true, userId: null }, { userId }],
      },
      select: { id: true },
    });
    if (current) return current.id;
  }

  const recent = await prisma.workoutSessionExercise.findFirst({
    where: {
      session: { userId, status: "COMPLETED" },
      exercise: {
        movementGroupId,
        isActive: true,
        isArchived: false,
      },
    },
    orderBy: [
      { session: { performedAt: "desc" } },
      { session: { createdAt: "desc" } },
    ],
    select: { exerciseId: true },
  });
  if (recent) return recent.exerciseId;

  const fallback = await prisma.exercise.findFirst({
    where: {
      movementGroupId,
      isActive: true,
      isArchived: false,
      OR: [{ userId }, { isSeed: true, userId: null }],
    },
    orderBy: [{ userId: "desc" }, { isSeed: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  return fallback?.id ?? null;
}

export async function saveMesocycleSlotAdjustment(formData: FormData) {
  const userId = await requireUserId();
  const mesocycleId = String(formData.get("mesocycleId") ?? "");
  const templateExerciseId = String(
    formData.get("templateExerciseId") ?? "",
  );
  const movementGroupId = String(
    formData.get("movementGroupId") ?? "",
  );

  const mesocycle = await prisma.programMesocycle.findFirst({
    where: {
      id: mesocycleId,
      userId,
      isArchived: false,
      actualEndDate: null,
    },
  });
  if (!mesocycle) redirect("/plan/mesocycle");

  const slot = await prisma.templateExercise.findFirst({
    where: {
      id: templateExerciseId,
      template: {
        programId: mesocycle.programId,
        userId,
        isActive: true,
        isArchived: false,
      },
    },
    include: {
      template: true,
      exercise: true,
      movementGroup: true,
      setPlans: { orderBy: { setNumber: "asc" } },
    },
  });
  if (!slot) redirect("/plan/mesocycle");

  const maxSets = Math.max(
    slot.plannedSets,
    slot.maxSets ?? slot.plannedSets,
  );
  const plannedSets = clampInteger(
    formData.get("plannedSets"),
    0,
    maxSets,
  );

  const targetMovementGroup = await prisma.movementGroup.findFirst({
    where: {
      id: movementGroupId,
      exercises: {
        some: {
          isActive: true,
          isArchived: false,
          OR: [{ isSeed: true, userId: null }, { userId }],
        },
      },
    },
    select: { id: true },
  });
  if (!targetMovementGroup) redirect("/plan/mesocycle?invalid=movement");

  const currentExerciseId =
    (slot.movementGroupId ?? slot.exercise.movementGroupId) ===
    movementGroupId
      ? slot.exerciseId
      : null;
  const exerciseId = await preferredExerciseForMovement(
    userId,
    movementGroupId,
    currentExerciseId,
  );
  if (!exerciseId) redirect("/plan/mesocycle?invalid=exercise");

  const state = parseMesocycleStructureOverrides(
    mesocycle.structureOverrides,
  );
  const addId = quickAddId(mesocycle.id, slot.id);
  const removeId = quickRemoveId(mesocycle.id, slot.id);
  const actions = state.actions.filter(
    (action) => action.id !== addId && action.id !== removeId,
  );

  const baseMovementGroupId =
    slot.movementGroupId ?? slot.exercise.movementGroupId;

  if (plannedSets === 0) {
    actions.push({
      id: removeId,
      type: "REMOVE_SLOT",
      templateId: slot.templateId,
      movementGroupId: baseMovementGroupId,
      templateExerciseId: slot.id,
    });
  } else {
    actions.push(
      {
        id: removeId,
        type: "REMOVE_SLOT",
        templateId: slot.templateId,
        movementGroupId: baseMovementGroupId,
        templateExerciseId: slot.id,
      },
      {
        id: addId,
        type: "ADD_SLOT",
        templateId: slot.templateId,
        movementGroupId,
        sourceTemplateExerciseId: slot.id,
        exerciseId,
        defaultSetTypeId: slot.defaultSetTypeId,
        plannedSets,
        maxSets: plannedSets,
        setPlans: slot.setPlans
          .filter((plan) => plan.setNumber <= plannedSets)
          .map((plan) => ({
            setNumber: plan.setNumber,
            setTypeId: plan.setTypeId,
          })),
      },
    );
  }

  await prisma.programMesocycle.update({
    where: { id: mesocycle.id },
    data: {
      structureOverrides: {
        version: 1,
        actions,
      } as Prisma.InputJsonValue,
    },
  });

  revalidateMesocycleAdjustmentViews(mesocycle.programId);
  redirect(`/plan/mesocycle?open=${encodeURIComponent(slot.templateId)}&saved=1`);
}

export async function resetMesocycleSlotAdjustment(formData: FormData) {
  const userId = await requireUserId();
  const mesocycleId = String(formData.get("mesocycleId") ?? "");
  const templateExerciseId = String(
    formData.get("templateExerciseId") ?? "",
  );
  const templateId = String(formData.get("templateId") ?? "");

  const mesocycle = await prisma.programMesocycle.findFirst({
    where: { id: mesocycleId, userId, isArchived: false },
  });
  if (!mesocycle) redirect("/plan/mesocycle");

  const state = parseMesocycleStructureOverrides(
    mesocycle.structureOverrides,
  );
  const addId = quickAddId(mesocycle.id, templateExerciseId);
  const removeId = quickRemoveId(mesocycle.id, templateExerciseId);
  const actions = state.actions.filter(
    (action) => action.id !== addId && action.id !== removeId,
  );

  await prisma.programMesocycle.update({
    where: { id: mesocycle.id },
    data: {
      structureOverrides: {
        version: 1,
        actions,
      } as Prisma.InputJsonValue,
    },
  });

  revalidateMesocycleAdjustmentViews(mesocycle.programId);
  redirect(`/plan/mesocycle?open=${encodeURIComponent(templateId)}&reset=1`);
}

export async function resetAllMesocycleSlotAdjustments(formData: FormData) {
  const userId = await requireUserId();
  const mesocycleId = String(formData.get("mesocycleId") ?? "");

  const mesocycle = await prisma.programMesocycle.findFirst({
    where: { id: mesocycleId, userId, isArchived: false },
  });
  if (!mesocycle) redirect("/plan/mesocycle");

  const state = parseMesocycleStructureOverrides(
    mesocycle.structureOverrides,
  );
  const actions = state.actions.filter(
    (action) =>
      !action.id.startsWith(QUICK_ADD_PREFIX) &&
      !action.id.startsWith(QUICK_REMOVE_PREFIX),
  );

  await prisma.programMesocycle.update({
    where: { id: mesocycle.id },
    data: {
      structureOverrides: {
        version: 1,
        actions,
      } as Prisma.InputJsonValue,
    },
  });

  revalidateMesocycleAdjustmentViews(mesocycle.programId);
  redirect("/plan/mesocycle?resetAll=1");
}
