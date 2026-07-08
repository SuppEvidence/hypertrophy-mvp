"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/auth/server";
import { ensureProfile } from "@/lib/auth/profile";
import { prisma } from "@/lib/db/prisma";
import { buildProgramPrescription } from "@/lib/server/prescriptions";
import { defaultTemplateName } from "@/lib/templates/defaults";
import {
  templateExerciseSchema,
  templateExerciseSetPlanSchema,
  templateOccurrenceSchema,
  templateRenameSchema,
} from "@/lib/validations/template";

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

export async function ensureProgramTemplates(programId: string, userId: string) {
  const program = await prisma.program.findFirst({ where: { id: programId, userId, isArchived: false } });
  if (!program) return [];

  const allTemplates = await prisma.workoutTemplate.findMany({
    where: { programId, userId },
    orderBy: { sequenceIndex: "asc" },
  });
  const byIndex = new Map(allTemplates.map((template) => [template.sequenceIndex, template]));

  await prisma.$transaction(async (tx) => {
    for (let index = 0; index < program.templateCount; index += 1) {
      const existing = byIndex.get(index);
      if (existing) {
        if (existing.isArchived || !existing.isActive) {
          await tx.workoutTemplate.update({ where: { id: existing.id }, data: { isArchived: false, isActive: true } });
        }
      } else {
        await tx.workoutTemplate.create({
          data: {
            userId,
            programId,
            name: defaultTemplateName(program.programType, index),
            sequenceIndex: index,
            expectedOccurrences: 1,
          },
        });
      }
    }

    await tx.workoutTemplate.updateMany({
      where: { programId, userId, sequenceIndex: { gte: program.templateCount } },
      data: { isArchived: true, isActive: false },
    });
  });

  return prisma.workoutTemplate.findMany({
    where: { programId, userId, isArchived: false },
    orderBy: { sequenceIndex: "asc" },
  });
}

const templateExerciseInclude = {
  defaultSetType: true,
  setPlans: { orderBy: { setNumber: "asc" }, include: { setType: true } },
  exercise: {
    include: {
      movementGroup: true,
      primaryMuscles: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
      secondaryMuscles: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
    },
  },
} as const;

export async function getTemplateBuilderData(params?: { programId?: string; templateId?: string }) {
  const userId = await requireUserId();

  const programs = await prisma.program.findMany({
    where: { userId, isArchived: false },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    include: {
      priorityMuscles: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
      volumeTargets: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
    },
  });

  const selectedProgram =
    programs.find((program) => program.id === params?.programId) ?? programs.find((program) => program.isActive) ?? programs[0] ?? null;

  const templates = selectedProgram ? await ensureProgramTemplates(selectedProgram.id, userId) : [];
  const selectedTemplate = templates.find((template) => template.id === params?.templateId) ?? templates[0] ?? null;

  const [exercises, setTypes] = await Promise.all([
    prisma.exercise.findMany({
      where: {
        isArchived: false,
        isActive: true,
        OR: [{ isSeed: true, userId: null }, { userId }],
      },
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
  ]);

  const templateExercises = selectedTemplate
    ? await prisma.templateExercise.findMany({
        where: { templateId: selectedTemplate.id },
        orderBy: { sortOrder: "asc" },
        include: templateExerciseInclude,
      })
    : [];

  const allTemplateExercises = selectedProgram
    ? await prisma.templateExercise.findMany({
        where: {
          template: {
            programId: selectedProgram.id,
            userId,
            isArchived: false,
            isActive: true,
          },
        },
        orderBy: [{ template: { sequenceIndex: "asc" } }, { sortOrder: "asc" }],
        include: {
          ...templateExerciseInclude,
          template: {
            select: {
              id: true,
              name: true,
              sequenceIndex: true,
              expectedOccurrences: true,
            },
          },
        },
      })
    : [];

  const prescription = selectedProgram ? await buildProgramPrescription(selectedProgram.id, userId) : null;
  const generatedTemplateItems = selectedTemplate
    ? prescription?.generated.items.filter((item) => item.templateId === selectedTemplate.id).sort((a, b) => a.sortOrder - b.sortOrder) ?? []
    : [];

  return { programs, selectedProgram, templates, selectedTemplate, templateExercises, allTemplateExercises, exercises, setTypes, prescription, generatedTemplateItems };
}

async function getTemplateOwnedByUser(templateId: string, userId: string) {
  return prisma.workoutTemplate.findFirst({
    where: { id: templateId, userId, isArchived: false, program: { userId, isArchived: false } },
    include: { program: true },
  });
}

async function syncTemplateExerciseSetPlans(
  tx: Prisma.TransactionClient,
  templateExerciseId: string,
  plannedSets: number,
  defaultSetTypeId: string,
) {
  const existingPlans = await tx.templateExerciseSetPlan.findMany({
    where: { templateExerciseId },
    orderBy: { setNumber: "asc" },
  });
  const existingByNumber = new Map(existingPlans.map((plan) => [plan.setNumber, plan]));

  for (let setNumber = 1; setNumber <= plannedSets; setNumber += 1) {
    if (!existingByNumber.has(setNumber)) {
      await tx.templateExerciseSetPlan.create({
        data: {
          templateExerciseId,
          setNumber,
          setTypeId: defaultSetTypeId,
        },
      });
    }
  }

  await tx.templateExerciseSetPlan.deleteMany({
    where: { templateExerciseId, setNumber: { gt: plannedSets } },
  });
}

export async function renameTemplate(templateId: string, formData: FormData) {
  const userId = await requireUserId();
  const template = await getTemplateOwnedByUser(templateId, userId);
  if (!template) redirect("/templates");
  const input = templateRenameSchema.parse({ name: formData.get("name") });

  await prisma.workoutTemplate.update({ where: { id: template.id }, data: { name: input.name } });
  revalidatePath("/templates");
  redirect(`/templates?programId=${template.programId}&templateId=${template.id}`);
}

async function reorderProgramTemplates(params: {
  tx: Prisma.TransactionClient;
  userId: string;
  programId: string;
  templateId: string;
  requestedPosition: number;
}) {
  const templates = await params.tx.workoutTemplate.findMany({
    where: { userId: params.userId, programId: params.programId, isArchived: false },
    orderBy: [{ sequenceIndex: "asc" }, { createdAt: "asc" }],
  });

  const current = templates.find((template) => template.id === params.templateId);
  if (!current) return;

  const withoutCurrent = templates.filter((template) => template.id !== params.templateId);
  const safeIndex = Math.min(Math.max(params.requestedPosition - 1, 0), withoutCurrent.length);
  const reordered = [...withoutCurrent.slice(0, safeIndex), current, ...withoutCurrent.slice(safeIndex)];

  for (let index = 0; index < reordered.length; index += 1) {
    const template = reordered[index];
    if (template && template.sequenceIndex !== index) {
      await params.tx.workoutTemplate.update({ where: { id: template.id }, data: { sequenceIndex: index } });
    }
  }
}

export async function updateTemplateExpectedOccurrences(templateId: string, formData: FormData) {
  const userId = await requireUserId();
  const template = await getTemplateOwnedByUser(templateId, userId);
  if (!template) redirect("/templates");

  const rawSelectedTemplateId = formData.get("selectedTemplateId");
  const input = templateOccurrenceSchema.parse({
    expectedOccurrences: formData.get("expectedOccurrences"),
    sequencePosition: formData.get("sequencePosition"),
    selectedTemplateId: rawSelectedTemplateId ? String(rawSelectedTemplateId) : null,
  });

  await prisma.$transaction(async (tx) => {
    await tx.workoutTemplate.update({
      where: { id: template.id },
      data: { expectedOccurrences: input.expectedOccurrences },
    });

    if (input.sequencePosition !== undefined) {
      await reorderProgramTemplates({
        tx,
        userId,
        programId: template.programId,
        templateId: template.id,
        requestedPosition: input.sequencePosition,
      });
    }
  });

  revalidatePath("/templates");
  revalidatePath("/dashboard");
  redirect(`/templates?programId=${template.programId}&templateId=${input.selectedTemplateId ?? template.id}`);
}

function parseTemplateExerciseForm(formData: FormData) {
  return templateExerciseSchema.parse({
    exerciseId: formData.get("exerciseId"),
    plannedSets: formData.get("plannedSets"),
    minSets: numberOrNull(formData.get("minSets")),
    maxSets: numberOrNull(formData.get("maxSets")),
    minReps: numberOrNull(formData.get("minReps")),
    maxReps: numberOrNull(formData.get("maxReps")),
    rirTarget: numberOrNull(formData.get("rirTarget")),
    defaultSetTypeId: formData.get("defaultSetTypeId"),
    slotPriority: formData.get("slotPriority") ?? "STANDARD",
    slotRole: formData.get("slotRole") ?? "ISOLATION",
    repBucket: formData.get("repBucket") ?? "ISOLATION",
    autoAdjustable: formData.get("autoAdjustable") === "on",
    notes: String(formData.get("notes") ?? ""),
  });
}

export async function addTemplateExercise(templateId: string, formData: FormData) {
  const userId = await requireUserId();
  const template = await getTemplateOwnedByUser(templateId, userId);
  if (!template) redirect("/templates");
  const input = parseTemplateExerciseForm(formData);

  const exercise = await prisma.exercise.findFirst({
    where: { id: input.exerciseId, isArchived: false, isActive: true, OR: [{ isSeed: true, userId: null }, { userId }] },
  });
  if (!exercise) redirect(`/templates?programId=${template.programId}&templateId=${template.id}`);

  const setType = await prisma.setType.findFirst({
    where: { id: input.defaultSetTypeId, isActive: true, OR: [{ userId: null }, { userId }] },
  });
  if (!setType) redirect(`/templates?programId=${template.programId}&templateId=${template.id}`);

  const last = await prisma.templateExercise.findFirst({
    where: { templateId: template.id },
    orderBy: { sortOrder: "desc" },
  });

  await prisma.$transaction(async (tx) => {
    const created = await tx.templateExercise.create({
      data: {
        templateId: template.id,
        exerciseId: input.exerciseId,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        plannedSets: input.plannedSets,
        minSets: input.minSets,
        maxSets: input.maxSets,
        minReps: input.minReps,
        maxReps: input.maxReps,
        rirTarget: input.rirTarget,
        defaultSetTypeId: input.defaultSetTypeId,
        slotPriority: input.slotPriority,
        slotRole: input.slotRole,
        repBucket: input.repBucket,
        autoAdjustable: input.autoAdjustable,
        notes: input.notes || null,
      },
    });
    await syncTemplateExerciseSetPlans(tx, created.id, input.plannedSets, input.defaultSetTypeId);
  });

  revalidatePath("/templates");
  redirect(`/templates?programId=${template.programId}&templateId=${template.id}`);
}

export async function updateTemplateExercise(templateExerciseId: string, formData: FormData) {
  const userId = await requireUserId();
  const existing = await prisma.templateExercise.findFirst({
    where: { id: templateExerciseId, template: { userId, isArchived: false, program: { userId, isArchived: false } } },
    include: { template: true },
  });
  if (!existing) redirect("/templates");
  const input = parseTemplateExerciseForm(formData);

  const exercise = await prisma.exercise.findFirst({
    where: { id: input.exerciseId, isArchived: false, isActive: true, OR: [{ isSeed: true, userId: null }, { userId }] },
  });
  if (!exercise) redirect(`/templates?programId=${existing.template.programId}&templateId=${existing.templateId}`);

  await prisma.$transaction(async (tx) => {
    await tx.templateExercise.update({
      where: { id: existing.id },
      data: {
        exerciseId: input.exerciseId,
        plannedSets: input.plannedSets,
        minSets: input.minSets,
        maxSets: input.maxSets,
        minReps: input.minReps,
        maxReps: input.maxReps,
        rirTarget: input.rirTarget,
        defaultSetTypeId: input.defaultSetTypeId,
        slotPriority: input.slotPriority,
        slotRole: input.slotRole,
        repBucket: input.repBucket,
        autoAdjustable: input.autoAdjustable,
        notes: input.notes || null,
      },
    });
    await syncTemplateExerciseSetPlans(tx, existing.id, input.plannedSets, input.defaultSetTypeId);
  });

  revalidatePath("/templates");
  redirect(`/templates?programId=${existing.template.programId}&templateId=${existing.templateId}`);
}

export async function updateTemplateExerciseSetPlan(setPlanId: string, formData: FormData) {
  const userId = await requireUserId();
  const existing = await prisma.templateExerciseSetPlan.findFirst({
    where: { id: setPlanId, templateExercise: { template: { userId, isArchived: false, program: { userId, isArchived: false } } } },
    include: { templateExercise: { include: { template: true } } },
  });
  if (!existing) redirect("/templates");

  const input = templateExerciseSetPlanSchema.parse({ setTypeId: formData.get("setTypeId") });
  const setType = await prisma.setType.findFirst({
    where: { id: input.setTypeId, isActive: true, OR: [{ userId: null }, { userId }] },
  });
  if (!setType) redirect(`/templates?programId=${existing.templateExercise.template.programId}&templateId=${existing.templateExercise.templateId}`);

  await prisma.templateExerciseSetPlan.update({
    where: { id: existing.id },
    data: { setTypeId: input.setTypeId },
  });

  revalidatePath("/templates");
  redirect(`/templates?programId=${existing.templateExercise.template.programId}&templateId=${existing.templateExercise.templateId}`);
}

export async function removeTemplateExercise(formData: FormData) {
  const userId = await requireUserId();
  const templateExerciseId = String(formData.get("templateExerciseId") ?? "");
  const existing = await prisma.templateExercise.findFirst({
    where: { id: templateExerciseId, template: { userId, isArchived: false, program: { userId, isArchived: false } } },
    include: { template: true },
  });
  if (!existing) redirect("/templates");

  await prisma.templateExercise.delete({ where: { id: existing.id } });
  revalidatePath("/templates");
  redirect(`/templates?programId=${existing.template.programId}&templateId=${existing.templateId}`);
}

export async function moveTemplateExercise(formData: FormData) {
  const userId = await requireUserId();
  const templateExerciseId = String(formData.get("templateExerciseId") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const existing = await prisma.templateExercise.findFirst({
    where: { id: templateExerciseId, template: { userId, isArchived: false, program: { userId, isArchived: false } } },
    include: { template: true },
  });
  if (!existing) redirect("/templates");

  const sibling = await prisma.templateExercise.findFirst({
    where: {
      templateId: existing.templateId,
      sortOrder: direction === "up" ? { lt: existing.sortOrder } : { gt: existing.sortOrder },
    },
    orderBy: { sortOrder: direction === "up" ? "desc" : "asc" },
  });

  if (sibling) {
    await prisma.$transaction([
      prisma.templateExercise.update({ where: { id: existing.id }, data: { sortOrder: sibling.sortOrder } }),
      prisma.templateExercise.update({ where: { id: sibling.id }, data: { sortOrder: existing.sortOrder } }),
    ]);
  }

  revalidatePath("/templates");
  redirect(`/templates?programId=${existing.template.programId}&templateId=${existing.templateId}`);
}
