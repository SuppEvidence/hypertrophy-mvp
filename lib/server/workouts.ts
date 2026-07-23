"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/auth/server";
import { ensureProfile } from "@/lib/auth/profile";
import { prisma } from "@/lib/db/prisma";
import { ensureProgramTemplates } from "@/lib/server/templates";
import { getTemplatePrescription } from "@/lib/server/prescriptions";
import { getNextTemplateFromRotation } from "@/lib/templates/rotationSequence";
import { parseStoredWeeklyPlan } from "@/lib/templates/weeklyPlan";
import { finishWorkoutSchema, startWorkoutSchema, stimulusSessionExerciseSchema, workoutSetSchema } from "@/lib/validations/workout";

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await ensureProfile(user);
  return user.id;
}

function numberOrNull(value: FormDataEntryValue | null) {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function editableSessionStatusWhere() {
  const statuses: ("DRAFT" | "COMPLETED")[] = ["DRAFT", "COMPLETED"];
  return { in: statuses };
}

function revalidateWorkoutViews() {
  revalidatePath("/log");
  revalidatePath("/log/history");
  revalidatePath("/dashboard");
  revalidatePath("/performance");
}

function parseNullableNumberInput(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function estimateE1rm(weight: number, reps: number) {
  return weight * (1 + reps / 30);
}

function roundToNearestHalf(value: number) {
  return Math.round(value * 2) / 2;
}

type WeightSuggestion = {
  suggestedWeight: number | null;
  targetReps: number | null;
  sourceE1rm: number | null;
  sourceSet: string | null;
};

async function buildWeightSuggestionsForSession(
  activeSession: Awaited<ReturnType<typeof getSessionForUser>>,
  userId: string,
): Promise<Record<string, WeightSuggestion>> {
  if (!activeSession) return {};

  const exerciseIds = Array.from(new Set(activeSession.exercises.map((item) => item.exerciseId)));
  if (exerciseIds.length === 0) return {};

  const completedSets = await prisma.workoutSet.findMany({
    where: {
      isCompleted: true,
      weight: { not: null },
      reps: { not: null },
      sessionExercise: {
        exerciseId: { in: exerciseIds },
        session: { userId, status: "COMPLETED", id: { not: activeSession.id } },
      },
    },
    include: {
      sessionExercise: {
        select: {
          exerciseId: true,
          session: { select: { performedAt: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const bestByExercise = new Map<string, { e1rm: number; weight: number; reps: number }>();

  for (const set of completedSets) {
    const weight = Number(set.weight);
    const reps = set.reps;
    if (!Number.isFinite(weight) || !reps || reps <= 0) continue;

    const e1rm = estimateE1rm(weight, reps);
    const exerciseId = set.sessionExercise.exerciseId;
    const current = bestByExercise.get(exerciseId);
    if (!current || e1rm > current.e1rm) {
      bestByExercise.set(exerciseId, { e1rm, weight, reps });
    }
  }

  const suggestions: Record<string, WeightSuggestion> = {};

  for (const item of activeSession.exercises) {
    const minReps = item.prescribedMinReps ?? item.templateExercise?.minReps ?? null;
    const maxReps = item.prescribedMaxReps ?? item.templateExercise?.maxReps ?? null;
    const targetReps = minReps && maxReps ? Math.round((minReps + maxReps) / 2) : maxReps ?? minReps ?? null;
    const best = bestByExercise.get(item.exerciseId);

    if (!best || !targetReps) {
      suggestions[item.id] = {
        suggestedWeight: null,
        targetReps,
        sourceE1rm: best?.e1rm ?? null,
        sourceSet: best ? `${best.weight} × ${best.reps}` : null,
      };
      continue;
    }

    const estimatedWeight = best.e1rm / (1 + targetReps / 30);
    suggestions[item.id] = {
      suggestedWeight: roundToNearestHalf(estimatedWeight),
      targetReps,
      sourceE1rm: Number(best.e1rm.toFixed(1)),
      sourceSet: `${best.weight} × ${best.reps}`,
    };
  }

  return suggestions;
}

export async function getWorkoutLoggerData(params?: { programId?: string; templateId?: string; sessionId?: string }) {
  const userId = await requireUserId();

  const programs = await prisma.program.findMany({
    where: { userId, isArchived: false },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
  });

  const selectedProgram =
    programs.find((program) => program.id === params?.programId) ?? programs.find((program) => program.isActive) ?? programs[0] ?? null;

  const templates = selectedProgram ? await ensureProgramTemplates(selectedProgram.id, userId) : [];
  const suggestedTemplate = selectedProgram ? await getSuggestedTemplate(selectedProgram.id, userId, templates) : null;
  const selectedTemplate =
    templates.find((template) => template.id === params?.templateId) ?? suggestedTemplate ?? templates[0] ?? null;

  const [exercises, setTypes, draftSessions] = await Promise.all([
    prisma.exercise.findMany({
      where: { isArchived: false, isActive: true, OR: [{ isSeed: true, userId: null }, { userId }] },
      orderBy: [{ isSeed: "desc" }, { name: "asc" }],
      include: {
        movementGroup: true,
        primaryMuscles: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
        secondaryMuscles: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
      },
    }),
    prisma.setType.findMany({
      where: { isActive: true, OR: [{ userId: null }, { userId }] },
      orderBy: [{ userId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.workoutSession.findMany({
      where: { userId, status: "DRAFT" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { program: true, template: true },
    }),
  ]);

  const requestedSession = params?.sessionId ? await getSessionForUser(params.sessionId, userId) : null;
  const activeSession = requestedSession?.status === "DRAFT" || requestedSession?.status === "COMPLETED" ? requestedSession : null;
  const hasUnfinishedSession = draftSessions.length > 0;
  const weightSuggestions = await buildWeightSuggestionsForSession(activeSession, userId);
  const selectedTemplatePrescription =
    selectedProgram && selectedTemplate && !activeSession ? await getTemplatePrescription(selectedProgram.id, selectedTemplate.id, userId) : null;

  return {
    programs,
    selectedProgram,
    templates,
    suggestedTemplate,
    selectedTemplate,
    exercises,
    setTypes,
    draftSessions,
    activeSession,
    hasUnfinishedSession,
    weightSuggestions,
    selectedTemplatePrescription: selectedTemplatePrescription
      ? {
          mesocycleName: selectedTemplatePrescription.activeMesocycle?.name ?? null,
          weekStart: selectedTemplatePrescription.generated.weeklyPlan.weekStart,
          items: selectedTemplatePrescription.templateItems.map((item) => ({
            id: item.id,
            exerciseName: item.exerciseName,
            movementGroupName: item.movementGroupName,
            basePlannedSets: item.basePlannedSets,
            adjustedPlannedSets: item.adjustedPlannedSets,
            weeklyAdjustedPlannedSets: item.weeklyAdjustedPlannedSets,
            isMissedThisWeek: item.isMissedThisWeek,
            prescribedMinReps: item.prescribedMinReps,
            prescribedMaxReps: item.prescribedMaxReps,
            adjustmentReason: item.adjustmentReason,
            weeklyAdjustmentReason: item.weeklyAdjustmentReason,
          })),
        }
      : null,
  };
}

async function getSuggestedTemplate(
  programId: string,
  userId: string,
  templates: Array<{ id: string; name: string; sequenceIndex: number; weekday: number | null }>,
) {
  if (templates.length === 0) return null;
  const program = await prisma.program.findFirst({ where: { id: programId, userId } });
  if (!program) return templates[0] ?? null;

  const weeklyPlan = parseStoredWeeklyPlan(program.weeklyPlan);
  const availableTemplates = templates.filter((template) => !weeklyPlan.missedTemplateIds.includes(template.id));
  const planningTemplates = availableTemplates.length > 0 ? availableTemplates : templates;

  if (program.rotationStyle === "WEEKDAY_BASED") {
    const day = new Date().getDay();
    return planningTemplates.find((template) => template.weekday === day) ?? planningTemplates[0] ?? null;
  }

  const orderedTemplates = [...planningTemplates].sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  const recentCompleted = await prisma.workoutSession.findMany({
    where: { userId, programId, status: "COMPLETED", templateId: { not: null } },
    orderBy: { performedAt: "desc" },
    take: 20,
    select: { templateId: true },
  });

  return getNextTemplateFromRotation({
    templates: orderedTemplates,
    rotationSequence: program.rotationSequence,
    completedTemplateHistory: recentCompleted
      .map((session) => session.templateId)
      .filter((templateId): templateId is string => Boolean(templateId))
      .reverse(),
  });
}

async function getTemplateWithExercises(templateId: string, userId: string) {
  return prisma.workoutTemplate.findFirst({
    where: { id: templateId, userId, isArchived: false, program: { userId, isArchived: false } },
    include: {
      program: true,
      exercises: {
        orderBy: { sortOrder: "asc" },
        include: {
          exercise: { include: { movementGroup: true } },
          movementGroup: true,
          defaultSetType: true,
          setPlans: { orderBy: { setNumber: "asc" }, include: { setType: true } },
        },
      },
    },
  });
}

async function getSessionForUser(sessionId: string, userId: string) {
  return prisma.workoutSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      program: true,
      template: true,
      exercises: {
        orderBy: { sortOrder: "asc" },
        include: {
          templateExercise: { include: { movementGroup: true, exercise: { include: { movementGroup: true } } } },
          stimulusSetType: true,
          exercise: {
            include: {
              movementGroup: true,
              primaryMuscles: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
              secondaryMuscles: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
            },
          },
          substitutedFromExercise: true,
          sets: { orderBy: { setNumber: "asc" }, include: { setType: true } },
        },
      },
    },
  });
}


export async function getWorkoutHistory(take = 30) {
  const userId = await requireUserId();
  return prisma.workoutSession.findMany({
    where: { userId },
    orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
    take,
    include: {
      program: true,
      template: true,
      exercises: {
        include: {
          exercise: true,
          sets: true,
        },
      },
    },
  });
}

export async function deleteWorkoutSession(sessionId: string, _formData?: FormData) {
  const userId = await requireUserId();
  const session = await prisma.workoutSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) redirect("/log/history");

  await prisma.workoutSession.delete({ where: { id: session.id } });
  revalidateWorkoutViews();
  redirect("/log/history");
}

export async function startWorkout(formData: FormData) {
  const userId = await requireUserId();
  const input = startWorkoutSchema.parse({ programId: formData.get("programId"), templateId: formData.get("templateId") });
  const prescription = await getTemplatePrescription(input.programId, input.templateId, userId);
  const template = prescription?.program.templates.find((item: any) => item.id === input.templateId) ?? null;
  if (!prescription || !template || prescription.program.id !== input.programId) redirect("/log");

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.workoutSession.create({
      data: {
        userId,
        programId: prescription.program.id,
        templateId: template.id,
        name: template.name,
        status: "DRAFT",
        mesocycleId: prescription.activeMesocycle?.id ?? null,
        prescriptionSummary: {
          mesocycleId: prescription.activeMesocycle?.id ?? null,
          mesocycleName: prescription.activeMesocycle?.name ?? null,
          generatedAt: new Date().toISOString(),
          weekStart: prescription.generated.weeklyPlan.weekStart,
          missedTemplateIds: prescription.generated.weeklyPlan.missedTemplateIds,
          weeklyReallocatedSets: prescription.generated.weeklyPlan.reallocatedSets,
          weeklyUnallocatedSets: prescription.generated.weeklyPlan.unallocatedSets,
        },
      },
    });

    for (const [index, item] of prescription.templateItems.entries()) {
      const prescribedSets = item.isMissedThisWeek ? item.adjustedPlannedSets : item.weeklyAdjustedPlannedSets;
      const prescriptionNotes = [item.adjustmentReason, item.isMissedThisWeek ? "Template was marked missed this week; base prescription used because it was started manually" : item.weeklyAdjustmentReason].filter(Boolean);
      const sessionExercise = await tx.workoutSessionExercise.create({
        data: {
          sessionId: created.id,
          exerciseId: item.exerciseId,
          templateExerciseId: item.id,
          sortOrder: index,
          isSubstitution: false,
          basePlannedSets: item.basePlannedSets,
          prescribedPlannedSets: prescribedSets,
          prescribedMinReps: item.prescribedMinReps,
          prescribedMaxReps: item.prescribedMaxReps,
          prescribedRepBucket: item.repBucket,
          prescriptionNote: prescriptionNotes.length > 0 ? prescriptionNotes.join("; ") : null,
          completedSets: 0,
          stimulusSetTypeId: item.defaultSetTypeId,
          repRangeStatus: "IN_RANGE",
          effortStatus: "PRODUCTIVE",
        },
      });

      const plannedSetRows = Array.from({ length: prescribedSets }, (_, setIndex) => {
        const setNumber = setIndex + 1;
        const planned = item.setPlans.find((plan) => plan.setNumber === setNumber);
        return { setNumber, setTypeId: planned?.setTypeId ?? item.defaultSetTypeId };
      });

      for (const plan of plannedSetRows) {
        await tx.workoutSet.create({
          data: {
            sessionExerciseId: sessionExercise.id,
            setNumber: plan.setNumber,
            setTypeId: plan.setTypeId,
            rir: item.rirTarget === null || item.rirTarget === undefined ? null : Number(item.rirTarget),
            isCompleted: false,
            repRangeStatus: "IN_RANGE",
            effortStatus: "PRODUCTIVE",
            painFlag: false,
          },
        });
      }
    }

    return created;
  });

  revalidateWorkoutViews();
  redirect(`/log?sessionId=${session.id}`);
}

export async function autosaveWorkoutSet(
  setId: string,
  payload: { weight?: string; reps?: string; rir?: string; setTypeId?: string; isCompleted?: boolean; repRangeStatus?: string; effortStatus?: string; painFlag?: boolean; painNote?: string },
) {
  const userId = await requireUserId();
  const existing = await prisma.workoutSet.findFirst({
    where: { id: setId, sessionExercise: { session: { userId, status: editableSessionStatusWhere() } } },
    include: { sessionExercise: true },
  });
  if (!existing) return { ok: false, error: "Set not found or session is not editable." };

  const input = workoutSetSchema.safeParse({
    weight: parseNullableNumberInput(payload.weight),
    reps: parseNullableNumberInput(payload.reps),
    rir: parseNullableNumberInput(payload.rir),
    setTypeId: payload.setTypeId,
    isCompleted: Boolean(payload.isCompleted),
    repRangeStatus: payload.repRangeStatus ?? "IN_RANGE",
    effortStatus: payload.effortStatus ?? "PRODUCTIVE",
    painFlag: Boolean(payload.painFlag),
    painNote: payload.painNote ?? "",
  });
  if (!input.success) return { ok: false, error: "Invalid set values." };

  await prisma.$transaction(async (tx) => {
    await tx.workoutSet.update({
      where: { id: existing.id },
      data: {
        weight: input.data.weight,
        reps: input.data.reps,
        rir: input.data.rir,
        setTypeId: input.data.setTypeId,
        isCompleted: input.data.isCompleted,
        repRangeStatus: input.data.repRangeStatus,
        effortStatus: input.data.effortStatus,
        painFlag: input.data.painFlag,
        painNote: input.data.painNote || null,
      },
    });

    const completedCount = await tx.workoutSet.count({ where: { sessionExerciseId: existing.sessionExerciseId, isCompleted: true } });
    await tx.workoutSessionExercise.update({ where: { id: existing.sessionExerciseId }, data: { completedSets: completedCount } });
  });

  revalidateWorkoutViews();
  return { ok: true };
}

export async function updateWorkoutSet(setId: string, formData: FormData) {
  const userId = await requireUserId();
  const existing = await prisma.workoutSet.findFirst({
    where: { id: setId, sessionExercise: { session: { userId, status: editableSessionStatusWhere() } } },
    include: { sessionExercise: { include: { session: true } } },
  });
  if (!existing) redirect("/log");

  const input = workoutSetSchema.parse({
    weight: numberOrNull(formData.get("weight")),
    reps: numberOrNull(formData.get("reps")),
    rir: numberOrNull(formData.get("rir")),
    setTypeId: formData.get("setTypeId"),
    isCompleted: formData.get("isCompleted") === "on",
    repRangeStatus: formData.get("repRangeStatus") || "IN_RANGE",
    effortStatus: formData.get("effortStatus") || "PRODUCTIVE",
    painFlag: formData.get("painFlag") === "on",
    painNote: formData.get("painNote") ?? "",
  });

  await prisma.$transaction(async (tx) => {
    await tx.workoutSet.update({
      where: { id: existing.id },
      data: {
        weight: input.weight,
        reps: input.reps,
        rir: input.rir,
        setTypeId: input.setTypeId,
        isCompleted: input.isCompleted,
        repRangeStatus: input.repRangeStatus,
        effortStatus: input.effortStatus,
        painFlag: input.painFlag,
        painNote: input.painNote || null,
      },
    });
    const completedCount = await tx.workoutSet.count({ where: { sessionExerciseId: existing.sessionExerciseId, isCompleted: true } });
    await tx.workoutSessionExercise.update({ where: { id: existing.sessionExerciseId }, data: { completedSets: completedCount } });
  });

  revalidateWorkoutViews();
  redirect(`/log?sessionId=${existing.sessionExercise.sessionId}`);
}

export async function addWorkoutSet(formData: FormData) {
  const userId = await requireUserId();
  const sessionExerciseId = String(formData.get("sessionExerciseId") ?? "");
  const existing = await prisma.workoutSessionExercise.findFirst({
    where: { id: sessionExerciseId, session: { userId, status: editableSessionStatusWhere() } },
    include: {
      session: true,
      sets: { orderBy: { setNumber: "desc" }, take: 1 },
      templateExercise: { include: { setPlans: { orderBy: { setNumber: "asc" } } } },
    },
  });
  if (!existing) redirect("/log");

  const fallbackSetType = await prisma.setType.findFirst({
    where: { isActive: true, OR: [{ userId: null }, { userId }] },
    orderBy: [{ userId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  const nextSetNumber = (existing.sets[0]?.setNumber ?? 0) + 1;
  const plannedSetTypeId = existing.templateExercise?.setPlans.find((plan) => plan.setNumber === nextSetNumber)?.setTypeId;
  const setTypeId = plannedSetTypeId ?? existing.templateExercise?.defaultSetTypeId ?? fallbackSetType?.id;
  if (!setTypeId) redirect(`/log?sessionId=${existing.sessionId}`);

  await prisma.$transaction(async (tx) => {
    await tx.workoutSet.create({
      data: {
        sessionExerciseId: existing.id,
        setNumber: nextSetNumber,
        setTypeId,
        isCompleted: false,
        repRangeStatus: "IN_RANGE",
        effortStatus: "PRODUCTIVE",
        painFlag: false,
      },
    });
    const completedCount = await tx.workoutSet.count({ where: { sessionExerciseId: existing.id, isCompleted: true } });
    await tx.workoutSessionExercise.update({ where: { id: existing.id }, data: { completedSets: completedCount } });
  });

  revalidateWorkoutViews();
  redirect(`/log?sessionId=${existing.sessionId}`);
}

export async function removeWorkoutSet(formData: FormData) {
  const userId = await requireUserId();
  const setId = String(formData.get("setId") ?? "");
  const existing = await prisma.workoutSet.findFirst({
    where: { id: setId, sessionExercise: { session: { userId, status: editableSessionStatusWhere() } } },
    include: { sessionExercise: true },
  });
  if (!existing) redirect("/log");

  await prisma.$transaction(async (tx) => {
    await tx.workoutSet.delete({ where: { id: existing.id } });
    const completedCount = await tx.workoutSet.count({ where: { sessionExerciseId: existing.sessionExerciseId, isCompleted: true } });
    await tx.workoutSessionExercise.update({ where: { id: existing.sessionExerciseId }, data: { completedSets: completedCount } });
  });
  revalidateWorkoutViews();
  redirect(`/log?sessionId=${existing.sessionExercise.sessionId}`);
}

export async function updateSessionExercise(sessionExerciseId: string, formData: FormData) {
  const userId = await requireUserId();
  const existing = await prisma.workoutSessionExercise.findFirst({
    where: { id: sessionExerciseId, session: { userId, status: editableSessionStatusWhere() } },
    include: { session: true, exercise: true, templateExercise: { include: { movementGroup: true, exercise: { include: { movementGroup: true } } } } },
  });
  if (!existing) redirect("/log");

  const input = stimulusSessionExerciseSchema.parse({
    exerciseId: formData.get("exerciseId"),
    notes: formData.get("notes") ?? "",
  });

  const exercise = await prisma.exercise.findFirst({
    where: { id: input.exerciseId, isArchived: false, isActive: true, OR: [{ isSeed: true, userId: null }, { userId }] },
  });
  if (!exercise) redirect(`/log?sessionId=${existing.sessionId}`);

  const slotMovementGroupId = existing.templateExercise?.movementGroupId ?? existing.templateExercise?.exercise.movementGroupId ?? existing.exercise.movementGroupId;
  if (slotMovementGroupId && exercise.movementGroupId !== slotMovementGroupId) {
    redirect(`/log?sessionId=${existing.sessionId}`);
  }

  await prisma.workoutSessionExercise.update({
    where: { id: existing.id },
    data: {
      exerciseId: input.exerciseId,
      isSubstitution: input.exerciseId !== existing.exerciseId || existing.isSubstitution,
      substitutedFromExerciseId: input.exerciseId !== existing.exerciseId ? existing.exerciseId : existing.substitutedFromExerciseId,
      notes: input.notes || null,
    },
  });

  revalidateWorkoutViews();
  redirect(`/log?sessionId=${existing.sessionId}`);
}

export async function addSessionExercise(formData: FormData) {
  const userId = await requireUserId();
  const sessionId = String(formData.get("sessionId") ?? "");
  const exerciseId = String(formData.get("exerciseId") ?? "");
  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId, status: editableSessionStatusWhere() },
    include: { exercises: { orderBy: { sortOrder: "desc" }, take: 1 } },
  });
  if (!session) redirect("/log");

  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, isArchived: false, isActive: true, OR: [{ isSeed: true, userId: null }, { userId }] },
  });
  if (!exercise) redirect(`/log?sessionId=${session.id}`);

  const normalSetType =
    (await prisma.setType.findFirst({ where: { slug: "normal", userId: null, isActive: true } })) ??
    (await prisma.setType.findFirst({
      where: { isActive: true, OR: [{ userId: null }, { userId }] },
      orderBy: [{ userId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }));
  if (!normalSetType) redirect(`/log?sessionId=${session.id}`);

  await prisma.$transaction(async (tx) => {
    const created = await tx.workoutSessionExercise.create({
      data: {
        sessionId: session.id,
        exerciseId,
        sortOrder: (session.exercises[0]?.sortOrder ?? -1) + 1,
        isSubstitution: false,
        completedSets: 0,
        stimulusSetTypeId: normalSetType.id,
        repRangeStatus: "IN_RANGE",
        effortStatus: "PRODUCTIVE",
      },
    });
    await tx.workoutSet.create({
      data: {
        sessionExerciseId: created.id,
        setNumber: 1,
        setTypeId: normalSetType.id,
        isCompleted: false,
        repRangeStatus: "IN_RANGE",
        effortStatus: "PRODUCTIVE",
        painFlag: false,
      },
    });
  });

  revalidateWorkoutViews();
  redirect(`/log?sessionId=${session.id}`);
}

export async function finishWorkout(sessionId: string, formData: FormData) {
  const userId = await requireUserId();
  const session = await prisma.workoutSession.findFirst({ where: { id: sessionId, userId, status: "DRAFT" } });
  if (!session) redirect("/log");
  const input = finishWorkoutSchema.parse({ notes: formData.get("notes") ?? "" });

  await prisma.workoutSession.update({
    where: { id: session.id },
    data: { status: "COMPLETED", completedAt: new Date(), notes: input.notes || null },
  });

  revalidateWorkoutViews();
  redirect(`/log?sessionId=${session.id}`);
}
