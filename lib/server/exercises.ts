"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";
import { slugify } from "@/lib/data/seedCatalog";
import { exerciseSchema } from "@/lib/validations/exercise";
import { z } from "zod";

export async function getExerciseReferenceData() {
  const userId = await requireUserId();
  const [muscles, movementGroups, setTypes] = await Promise.all([
    prisma.muscle.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.movementGroup.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.setType.findMany({ where: { isActive: true, OR: [{ userId: null }, { userId }] }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, isIntensifier: true } }),
  ]);

  return { muscles, movementGroups, setTypes };
}

export async function listExercises(searchParams?: {
  q?: string;
  movementGroupId?: string;
  muscleId?: string;
  source?: string;
  status?: string;
}) {
  const userId = await requireUserId();
  const q = searchParams?.q?.trim();
  const movementGroupId = searchParams?.movementGroupId || undefined;
  const muscleId = searchParams?.muscleId || undefined;
  const source = searchParams?.source ?? "all";
  const status = searchParams?.status ?? "active";

  const sourceWhere =
    source === "seed"
      ? { isSeed: true, userId: null }
      : source === "custom"
        ? { userId }
        : { OR: [{ isSeed: true, userId: null }, { userId }] };

  const statusWhere =
    status === "archived"
      ? { isArchived: true }
      : status === "all"
        ? {}
        : { isArchived: false, isActive: true };

  const andFilters: Prisma.ExerciseWhereInput[] = [sourceWhere, statusWhere];
  if (q) {
    andFilters.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { tags: { has: q } },
        { movementGroup: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (movementGroupId) andFilters.push({ movementGroupId });
  if (muscleId) {
    andFilters.push({
      OR: [
        { primaryMuscles: { some: { muscleId } } },
        { secondaryMuscles: { some: { muscleId } } },
      ],
    });
  }

  return prisma.exercise.findMany({
    where: { AND: andFilters },
    orderBy: [{ isSeed: "desc" }, { name: "asc" }],
    include: {
      movementGroup: true,
      primaryMuscles: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
      secondaryMuscles: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
    },
  });
}

export async function getExerciseForEdit(exerciseId: string) {
  const userId = await requireUserId();

  return prisma.exercise.findFirst({
    where: {
      id: exerciseId,
      OR: [{ isSeed: true, userId: null }, { userId }],
    },
    include: {
      movementGroup: true,
      primaryMuscles: { include: { muscle: true } },
      secondaryMuscles: { include: { muscle: true } },
      coachingProfiles: { where: { userId }, take: 1 },
    },
  });
}

const coachingProfileInput = z.object({
  preference: z.enum(["NEUTRAL", "PREFERRED", "AVOID"]),
  intensifierPreference: z.enum(["DEFAULT", "NONE", "ONLY_SELECTED"]),
  notes: z.string().trim().max(800),
});

export async function saveExerciseCoachingProfile(exerciseId: string, formData: FormData) {
  const userId = await requireUserId();
  const exercise = await prisma.exercise.findFirst({ where: { id: exerciseId, OR: [{ isSeed: true, userId: null }, { userId }] } });
  if (!exercise) throw new Error("Exercise not found.");
  const input = coachingProfileInput.parse({
    preference: formData.get("preference"),
    intensifierPreference: formData.get("intensifierPreference"),
    notes: String(formData.get("notes") ?? ""),
  });
  const requested = [...new Set(formData.getAll("allowedIntensifierIds").map(String))];
  const available = await prisma.setType.findMany({
    where: { id: { in: requested }, isActive: true, isIntensifier: true, OR: [{ userId: null }, { userId }] },
    select: { id: true },
  });
  if (available.length !== requested.length) throw new Error("Select active set types from your catalog.");
  if (input.intensifierPreference === "ONLY_SELECTED" && !requested.length) throw new Error("Select at least one permitted intensifier.");
  const data = {
    preference: input.preference,
    intensifierPreference: input.intensifierPreference,
    allowedIntensifierIds: input.intensifierPreference === "ONLY_SELECTED" ? requested : [],
    notes: input.notes || null,
    lastConfirmedAt: new Date(),
  };
  await prisma.exerciseCoachingProfile.upsert({
    where: { userId_exerciseId: { userId, exerciseId } },
    create: { userId, exerciseId, ...data },
    update: data,
  });
  revalidatePath(`/exercises/${exerciseId}`);
  revalidatePath("/exercises");
}

function parseTags(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function parseExerciseForm(formData: FormData) {
  const input = exerciseSchema.parse({
    name: formData.get("name"),
    movementGroupId: formData.get("movementGroupId"),
    tags: formData.get("tags") ?? "",
    setupNotes: formData.get("setupNotes") ?? "",
    minimumWeightIncrement: formData.get("minimumWeightIncrement") ?? "",
    isActive: formData.get("isActive") === "on",
    isArchived: formData.get("isArchived") === "on",
  });

  const primaryMuscleIds = Array.from(new Set(formData.getAll("primaryMuscleIds").map(String)));
  const secondaryMuscleIds = Array.from(new Set(formData.getAll("secondaryMuscleIds").map(String))).filter(
    (muscleId) => !primaryMuscleIds.includes(muscleId),
  );

  if (primaryMuscleIds.length === 0) {
    throw new Error("At least one primary muscle is required.");
  }

  return { input, tags: parseTags(input.tags), primaryMuscleIds, secondaryMuscleIds };
}

function userCatalogKey(userId: string, name: string) {
  return `user:${userId}:${slugify(name)}:${Date.now().toString(36)}`;
}

async function replaceMuscleLinks(
  exerciseId: string,
  primaryMuscleIds: string[],
  secondaryMuscleIds: string[],
  tx: Prisma.TransactionClient,
) {
  await tx.exercisePrimaryMuscle.deleteMany({ where: { exerciseId } });
  await tx.exerciseSecondaryMuscle.deleteMany({ where: { exerciseId } });

  if (primaryMuscleIds.length > 0) {
    await tx.exercisePrimaryMuscle.createMany({
      data: primaryMuscleIds.map((muscleId) => ({ exerciseId, muscleId })),
      skipDuplicates: true,
    });
  }

  if (secondaryMuscleIds.length > 0) {
    await tx.exerciseSecondaryMuscle.createMany({
      data: secondaryMuscleIds.map((muscleId) => ({ exerciseId, muscleId })),
      skipDuplicates: true,
    });
  }
}

export async function createExercise(formData: FormData) {
  const userId = await requireUserId();
  const { input, tags, primaryMuscleIds, secondaryMuscleIds } = parseExerciseForm(formData);

  await prisma.$transaction(async (tx) => {
    const created = await tx.exercise.create({
      data: {
        userId,
        name: input.name,
        slug: slugify(input.name),
        catalogKey: userCatalogKey(userId, input.name),
        movementGroupId: input.movementGroupId,
        defaultMinReps: null,
        defaultMaxReps: null,
        tags,
        setupNotes: input.setupNotes || null,
        minimumWeightIncrement: input.minimumWeightIncrement,
        isSeed: false,
        isActive: input.isActive,
        isArchived: input.isArchived,
      },
    });

    await replaceMuscleLinks(created.id, primaryMuscleIds, secondaryMuscleIds, tx);
    return created;
  });

  revalidatePath("/exercises");
  redirect("/exercises");
}

export async function saveExercise(exerciseId: string, formData: FormData) {
  const userId = await requireUserId();
  const existing = await prisma.exercise.findFirst({
    where: { id: exerciseId, OR: [{ isSeed: true, userId: null }, { userId }] },
    include: { primaryMuscles: true, secondaryMuscles: true },
  });

  if (!existing) redirect("/exercises");

  const { input, tags, primaryMuscleIds, secondaryMuscleIds } = parseExerciseForm(formData);

  const saved = await prisma.$transaction(async (tx) => {
    if (existing.isSeed) {
      const copy = await tx.exercise.create({
        data: {
          userId,
          name: input.name,
          slug: slugify(input.name),
          catalogKey: userCatalogKey(userId, input.name),
          movementGroupId: input.movementGroupId,
          defaultMinReps: null,
          defaultMaxReps: null,
          tags,
          setupNotes: input.setupNotes || null,
          minimumWeightIncrement: input.minimumWeightIncrement,
          isSeed: false,
          isActive: input.isActive,
          isArchived: input.isArchived,
        },
      });
      await replaceMuscleLinks(copy.id, primaryMuscleIds, secondaryMuscleIds, tx);
      const coachingProfile = await tx.exerciseCoachingProfile.findUnique({
        where: { userId_exerciseId: { userId, exerciseId: existing.id } },
      });
      if (coachingProfile) {
        await tx.exerciseCoachingProfile.create({ data: {
          userId, exerciseId: copy.id,
          preference: coachingProfile.preference,
          intensifierPreference: coachingProfile.intensifierPreference,
          allowedIntensifierIds: coachingProfile.allowedIntensifierIds,
          notes: coachingProfile.notes,
          lastConfirmedAt: coachingProfile.lastConfirmedAt,
        } });
      }
      return copy;
    }

    const updated = await tx.exercise.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        slug: slugify(input.name),
        movementGroupId: input.movementGroupId,
        defaultMinReps: null,
        defaultMaxReps: null,
        tags,
        setupNotes: input.setupNotes || null,
        minimumWeightIncrement: input.minimumWeightIncrement,
        isActive: input.isActive,
        isArchived: input.isArchived,
      },
    });
    await replaceMuscleLinks(updated.id, primaryMuscleIds, secondaryMuscleIds, tx);
    return updated;
  });

  revalidatePath("/exercises");
  revalidatePath(`/exercises/${exerciseId}`);
  redirect(`/exercises/${saved.id}`);
}

export async function archiveExercise(formData: FormData) {
  const userId = await requireUserId();
  const exerciseId = String(formData.get("exerciseId") ?? "");
  const exercise = await prisma.exercise.findFirst({ where: { id: exerciseId, userId, isSeed: false } });
  if (!exercise) redirect("/exercises");

  await prisma.exercise.update({ where: { id: exercise.id }, data: { isArchived: true, isActive: false } });
  revalidatePath("/exercises");
}

export async function restoreExercise(formData: FormData) {
  const userId = await requireUserId();
  const exerciseId = String(formData.get("exerciseId") ?? "");
  const exercise = await prisma.exercise.findFirst({ where: { id: exerciseId, userId, isSeed: false } });
  if (!exercise) redirect("/exercises");

  await prisma.exercise.update({ where: { id: exercise.id }, data: { isArchived: false, isActive: true } });
  revalidatePath("/exercises");
}
