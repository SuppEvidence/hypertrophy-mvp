"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/auth/server";
import { ensureProfile } from "@/lib/auth/profile";
import { prisma } from "@/lib/db/prisma";
import { defaultTemplateName } from "@/lib/templates/defaults";
import { templateExerciseSchema, templateRenameSchema } from "@/lib/validations/template";

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
  const selectedTemplate =
    templates.find((template) => template.id === params?.templateId) ?? templates[0] ?? null;

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
    prisma.setType.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const templateExercises = selectedTemplate
    ? await prisma.templateExercise.findMany({
        where: { templateId: selectedTemplate.id },
        orderBy: { sortOrder: "asc" },
        include: {
          defaultSetType: true,
          exercise: {
            include: {
              movementGroup: true,
              primaryMuscles: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
              secondaryMuscles: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
            },
          },
        },
      })
    : [];

  return { programs, selectedProgram, templates, selectedTemplate, templateExercises, exercises, setTypes };
}

async function getTemplateOwnedByUser(templateId: string, userId: string) {
  return prisma.workoutTemplate.findFirst({
    where: { id: templateId, userId, isArchived: false, program: { userId, isArchived: false } },
    include: { program: true },
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

function parseTemplateExerciseForm(formData: FormData) {
  return templateExerciseSchema.parse({
    exerciseId: formData.get("exerciseId"),
    plannedSets: formData.get("plannedSets"),
    minReps: numberOrNull(formData.get("minReps")),
    maxReps: numberOrNull(formData.get("maxReps")),
    rirTarget: numberOrNull(formData.get("rirTarget")),
    defaultSetTypeId: formData.get("defaultSetTypeId"),
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

  const setType = await prisma.setType.findUnique({ where: { id: input.defaultSetTypeId } });
  if (!setType) redirect(`/templates?programId=${template.programId}&templateId=${template.id}`);

  const last = await prisma.templateExercise.findFirst({
    where: { templateId: template.id },
    orderBy: { sortOrder: "desc" },
  });

  await prisma.templateExercise.create({
    data: {
      templateId: template.id,
      exerciseId: input.exerciseId,
      sortOrder: (last?.sortOrder ?? -1) + 1,
      plannedSets: input.plannedSets,
      minReps: input.minReps,
      maxReps: input.maxReps,
      rirTarget: input.rirTarget,
      defaultSetTypeId: input.defaultSetTypeId,
      notes: input.notes || null,
    },
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

  await prisma.templateExercise.update({
    where: { id: existing.id },
    data: {
      exerciseId: input.exerciseId,
      plannedSets: input.plannedSets,
      minReps: input.minReps,
      maxReps: input.maxReps,
      rirTarget: input.rirTarget,
      defaultSetTypeId: input.defaultSetTypeId,
      notes: input.notes || null,
    },
  });

  revalidatePath("/templates");
  redirect(`/templates?programId=${existing.template.programId}&templateId=${existing.templateId}`);
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
