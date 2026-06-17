"use server";

import type { ProgramPhase, ProgramType, RotationStyle, VolumeWindowType } from "@/lib/types/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/auth/server";
import { ensureProfile } from "@/lib/auth/profile";
import { prisma } from "@/lib/db/prisma";
import { defaultProgramValues, isProgramType } from "@/lib/programs/options";
import { programSchema } from "@/lib/validations/program";

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await ensureProfile(user);
  return user.id;
}

function toNumber(value: unknown, fallback: number) {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function getDefaultSecondaryContribution(userId: string) {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { defaultSecondaryContribution: true },
  });
  return toNumber(settings?.defaultSecondaryContribution, 0.5);
}

export async function listUserPrograms() {
  const userId = await requireUserId();
  return prisma.program.findMany({
    where: { userId, isArchived: false },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    include: {
      priorityMuscles: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
      volumeTargets: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
    },
  });
}

export async function getProgramForEdit(programId: string) {
  const userId = await requireUserId();
  return prisma.program.findFirst({
    where: { id: programId, userId, isArchived: false },
    include: {
      priorityMuscles: { include: { muscle: true } },
      volumeTargets: { include: { muscle: true } },
    },
  });
}

export async function getProgramFormReferenceData() {
  const userId = await requireUserId();
  const [muscles, defaultSecondaryContribution] = await Promise.all([
    prisma.muscle.findMany({ orderBy: { sortOrder: "asc" } }),
    getDefaultSecondaryContribution(userId),
  ]);
  return { muscles, defaultSecondaryContribution };
}

export async function createProgramFromPreset(formData: FormData) {
  const userId = await requireUserId();
  const rawProgramType = String(formData.get("programType") ?? "CUSTOM");
  const programType: ProgramType = isProgramType(rawProgramType) ? rawProgramType : "CUSTOM";
  const defaults = defaultProgramValues(programType);
  const [muscles, existingActive, defaultSecondaryContribution] = await Promise.all([
    prisma.muscle.findMany({ where: { name: { in: defaults.priorityMuscles } } }),
    prisma.program.findFirst({ where: { userId, isActive: true, isArchived: false } }),
    getDefaultSecondaryContribution(userId),
  ]);

  const program = await prisma.$transaction(async (tx) => {
    if (!existingActive) {
      await tx.program.updateMany({ where: { userId }, data: { isActive: false } });
    }

    const created = await tx.program.create({
      data: {
        userId,
        name: defaults.name,
        programType,
        templateCount: defaults.templateCount,
        rotationStyle: defaults.rotationStyle,
        volumeWindowType: defaults.volumeWindowType,
        customWindowDays: defaults.customWindowDays,
        secondaryContribution: defaultSecondaryContribution,
        activePhase: "PUSH",
        advancedMuscleMode: false,
        isActive: !existingActive,
        priorityMuscles: {
          create: muscles.map((muscle: any) => ({ muscleId: muscle.id })),
        },
        volumeTargets: {
          create: muscles.map((muscle: any) => ({ muscleId: muscle.id, weeklyTargetSets: 10 })),
        },
      },
    });
    return created;
  });

  revalidatePath("/programs");
  redirect(`/programs/${program.id}`);
}

function numberOrNull(value: FormDataEntryValue | null) {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseProgramForm(formData: FormData) {
  return programSchema.parse({
    name: formData.get("name"),
    programType: formData.get("programType"),
    templateCount: formData.get("templateCount"),
    rotationStyle: formData.get("rotationStyle"),
    volumeWindowType: formData.get("volumeWindowType"),
    customWindowDays: numberOrNull(formData.get("customWindowDays")),
    secondaryContribution: formData.get("secondaryContribution"),
    activePhase: formData.get("activePhase"),
    advancedMuscleMode: formData.get("advancedMuscleMode") === "on",
  });
}

function parseMuscleConfig(formData: FormData) {
  const priorityMuscleIds = new Set(formData.getAll("priorityMuscleIds").map(String));
  const targetRows = Array.from(formData.entries())
    .filter(([key]) => key.startsWith("target:"))
    .map(([key, value]) => {
      const muscleId = key.replace("target:", "");
      const target = Number(value);
      return { muscleId, target: Number.isFinite(target) && target > 0 ? target : 0 };
    })
    .filter((row: any) => row.target > 0 || priorityMuscleIds.has(row.muscleId));

  return { priorityMuscleIds: Array.from(priorityMuscleIds), targetRows };
}

export async function createProgram(formData: FormData) {
  const userId = await requireUserId();
  const input = parseProgramForm(formData);
  const { priorityMuscleIds, targetRows } = parseMuscleConfig(formData);
  const existingActive = await prisma.program.findFirst({ where: { userId, isActive: true, isArchived: false } });

  const program = await prisma.$transaction(async (tx) => {
    if (!existingActive) {
      await tx.program.updateMany({ where: { userId }, data: { isActive: false } });
    }

    return tx.program.create({
      data: {
        userId,
        name: input.name,
        programType: input.programType as ProgramType,
        templateCount: input.templateCount,
        rotationStyle: input.rotationStyle as RotationStyle,
        volumeWindowType: input.volumeWindowType as VolumeWindowType,
        customWindowDays: input.volumeWindowType === "CUSTOM" ? input.customWindowDays : null,
        secondaryContribution: input.secondaryContribution,
        activePhase: input.activePhase as ProgramPhase,
        advancedMuscleMode: input.advancedMuscleMode,
        isActive: !existingActive,
        priorityMuscles: { create: priorityMuscleIds.map((muscleId: any) => ({ muscleId })) },
        volumeTargets: { create: targetRows.map((row: any) => ({ muscleId: row.muscleId, weeklyTargetSets: row.target })) },
      },
    });
  });

  revalidatePath("/programs");
  redirect(`/programs/${program.id}`);
}

export async function updateProgram(programId: string, formData: FormData) {
  const userId = await requireUserId();
  const existing = await prisma.program.findFirst({ where: { id: programId, userId, isArchived: false } });
  if (!existing) redirect("/programs");

  const input = parseProgramForm(formData);
  const { priorityMuscleIds, targetRows } = parseMuscleConfig(formData);

  await prisma.$transaction(async (tx) => {
    await tx.program.update({
      where: { id: programId },
      data: {
        name: input.name,
        programType: input.programType as ProgramType,
        templateCount: input.templateCount,
        rotationStyle: input.rotationStyle as RotationStyle,
        volumeWindowType: input.volumeWindowType as VolumeWindowType,
        customWindowDays: input.volumeWindowType === "CUSTOM" ? input.customWindowDays : null,
        secondaryContribution: input.secondaryContribution,
        activePhase: input.activePhase as ProgramPhase,
        advancedMuscleMode: input.advancedMuscleMode,
      },
    });

    await tx.programPriorityMuscle.deleteMany({ where: { programId } });
    if (priorityMuscleIds.length > 0) {
      await tx.programPriorityMuscle.createMany({
        data: priorityMuscleIds.map((muscleId: any) => ({ programId, muscleId })),
        skipDuplicates: true,
      });
    }

    await tx.muscleVolumeTarget.deleteMany({ where: { programId } });
    if (targetRows.length > 0) {
      await tx.muscleVolumeTarget.createMany({
        data: targetRows.map((row: any) => ({ programId, muscleId: row.muscleId, weeklyTargetSets: row.target })),
        skipDuplicates: true,
      });
    }
  });

  revalidatePath("/programs");
  revalidatePath(`/programs/${programId}`);
  redirect("/programs");
}

export async function switchActiveProgram(formData: FormData) {
  const userId = await requireUserId();
  const programId = String(formData.get("programId") ?? "");
  const program = await prisma.program.findFirst({ where: { id: programId, userId, isArchived: false } });
  if (!program) redirect("/programs");

  await prisma.$transaction([
    prisma.program.updateMany({ where: { userId }, data: { isActive: false } }),
    prisma.program.update({ where: { id: programId }, data: { isActive: true } }),
  ]);

  revalidatePath("/programs");
  revalidatePath("/dashboard");
}

export async function archiveProgram(formData: FormData) {
  const userId = await requireUserId();
  const programId = String(formData.get("programId") ?? "");
  const program = await prisma.program.findFirst({ where: { id: programId, userId, isArchived: false } });
  if (!program) redirect("/programs");

  await prisma.program.update({ where: { id: programId }, data: { isArchived: true, isActive: false } });
  const replacement = await prisma.program.findFirst({ where: { userId, isArchived: false }, orderBy: { createdAt: "asc" } });
  if (replacement) await prisma.program.update({ where: { id: replacement.id }, data: { isActive: true } });

  revalidatePath("/programs");
  redirect("/programs");
}
