"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";
import { chestRegionForMovement, classifyChestPrimary } from "@/lib/coaching/chest-regions";
import { slugify } from "@/lib/data/seedCatalog";
import { exerciseSchema } from "@/lib/validations/exercise";
import { z } from "zod";
import { isEdtSetType } from "@/lib/coaching/set-type-classification";

export async function getExerciseReferenceData() {
  const userId = await requireUserId();
  const [muscles, movementGroups, setTypes] = await Promise.all([
    prisma.muscle.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.movementGroup.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.setType.findMany({ where: { isActive: true, OR: [{ userId: null }, { userId }] }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, slug: true, isIntensifier: true } }),
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

  after(async () => {
    try {
      const { assessPendingSecondaryContributions } = await import("@/lib/server/secondary-contribution-assessment");
      await assessPendingSecondaryContributions(userId);
    } catch (error) { console.error("Secondary contribution backfill failed", error); }
  });

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
    where: { id: { in: requested }, isActive: true, OR: [{ userId: null }, { userId }] },
    select: { id: true, name: true, slug: true, isIntensifier: true },
  });
  if (available.length !== requested.length || available.some((type) => !type.isIntensifier && !isEdtSetType(type))) {
    throw new Error("Select active intensifiers or EDT set types from your catalog.");
  }
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

  return { input, tags: parseTags(input.tags), primaryMuscleIds, secondaryMuscleIds };
}

async function resolveChestMuscles(movementGroupId: string, primaryMuscleIds: string[], secondaryMuscleIds: string[]) {
  const movement = await prisma.movementGroup.findUnique({ where: { id: movementGroupId }, select: { name: true } });
  if (!movement) throw new Error("Movement group not found.");
  const regionName = chestRegionForMovement[movement.name];
  const matches = regionName ? await prisma.muscle.findMany({
    where: { slug: { in: ["chest", "upper-chest", "mid-chest", "lower-chest"] } },
    select: { id: true, name: true, slug: true },
  }) : [];
  const chestId = matches.find((row) => row.slug === "chest")?.id;
  const primary = classifyChestPrimary({ movementName: movement.name, primaryIds: primaryMuscleIds,
    chestId,
    regionId: matches.find((row) => row.name === regionName)?.id,
    chestRegionIds: matches.filter((row) => row.slug !== "chest").map((row) => row.id) });
  if (primary.length === 0) throw new Error("At least one primary muscle is required.");
  return { primary, secondary: secondaryMuscleIds.filter((id) => !primary.includes(id) && (!regionName || id !== chestId)) };
}

function userCatalogKey(userId: string, name: string) {
  return `user:${userId}:${slugify(name)}:${Date.now().toString(36)}`;
}

async function replaceMuscleLinks(
  exerciseId: string,
  primaryMuscleIds: string[],
  secondaryMuscleIds: string[],
  tx: Prisma.TransactionClient,
  reassessExisting = false,
) {
  await tx.exercisePrimaryMuscle.deleteMany({ where: { exerciseId } });
  await tx.exerciseSecondaryMuscle.deleteMany({ where: { exerciseId, muscleId: { notIn: secondaryMuscleIds } } });

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
    if (reassessExisting) {
      await tx.exerciseSecondaryMuscle.updateMany({ where: { exerciseId, muscleId: { in: secondaryMuscleIds } }, data: {
        contributionEstimate: null, assessmentRationale: null, assessedAt: null, assessmentModel: null, assessmentVersion: { increment: 1 },
      } });
    }
  }
}

function scheduleContributionAssessment(exerciseId: string) {
  after(async () => {
    try {
      const { assessExerciseSecondaryContributions } = await import("@/lib/server/secondary-contribution-assessment");
      await assessExerciseSecondaryContributions(exerciseId);
    } catch (error) {
      console.error("Exercise secondary contribution assessment failed", error);
    }
  });
}

export async function createExercise(formData: FormData) {
  const userId = await requireUserId();
  const { input, tags, primaryMuscleIds, secondaryMuscleIds } = parseExerciseForm(formData);
  const muscles = await resolveChestMuscles(input.movementGroupId, primaryMuscleIds, secondaryMuscleIds);

  const created = await prisma.$transaction(async (tx) => {
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

    await replaceMuscleLinks(created.id, muscles.primary, muscles.secondary, tx);
    return created;
  });

  scheduleContributionAssessment(created.id);
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
  const muscles = await resolveChestMuscles(input.movementGroupId, primaryMuscleIds, secondaryMuscleIds);

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
      await replaceMuscleLinks(copy.id, muscles.primary, muscles.secondary, tx);
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
    await replaceMuscleLinks(updated.id, muscles.primary, muscles.secondary, tx,
      existing.name !== input.name || existing.movementGroupId !== input.movementGroupId ||
      (existing.setupNotes ?? "") !== (input.setupNotes ?? "") ||
      existing.primaryMuscles.map((link) => link.muscleId).sort().join(",") !== [...muscles.primary].sort().join(","));
    return updated;
  });

  scheduleContributionAssessment(saved.id);
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
