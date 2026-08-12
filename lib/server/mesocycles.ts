"use server";

import { Prisma, type ProgramPhase } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";
import { estimateE1RM } from "@/lib/calculations/performance";
import { parseMesocycleStructureOverrides } from "@/lib/planning/mesocycleStructure";
import { volumeWindowDays } from "@/lib/programs/options";
import { buildProgramPrescription } from "@/lib/server/prescriptions";
import { mesocycleSchema } from "@/lib/validations/mesocycle";
import { getStimulusContribution, usesStimulusEntry } from "@/lib/workouts/stimulus";

function toNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function plannedMesocycleEndDate(startDate: Date, lengthWeeks: number) {
  return addDays(startDate, lengthWeeks * 7 - 1);
}

function effectiveMesocycleEndDate(startDate: Date, lengthWeeks: number, actualEndDate?: Date | null) {
  const plannedEndDate = plannedMesocycleEndDate(startDate, lengthWeeks);
  if (!actualEndDate) return plannedEndDate;
  return actualEndDate < plannedEndDate ? actualEndDate : plannedEndDate;
}

function durationDaysInclusive(startDate: Date, endDate: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.max(Math.round((endDate.getTime() - startDate.getTime()) / millisecondsPerDay) + 1, 1);
}

function parseMesocycleForm(formData: FormData) {
  return mesocycleSchema.parse({
    name: formData.get("name"),
    phase: formData.get("phase"),
    startDate: formData.get("startDate"),
    lengthWeeks: formData.get("lengthWeeks"),
    notes: String(formData.get("notes") ?? ""),
  });
}

function decimalOrNull(value: FormDataEntryValue | null) {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export async function createMesocycle(programId: string, formData: FormData) {
  const userId = await requireUserId();
  const program = await prisma.program.findFirst({ where: { id: programId, userId, isArchived: false } });
  if (!program) redirect("/programs");
  const input = parseMesocycleForm(formData);

  await prisma.programMesocycle.create({
    data: {
      userId,
      programId,
      name: input.name,
      phase: input.phase as ProgramPhase,
      startDate: parseDateOnly(input.startDate),
      lengthWeeks: input.lengthWeeks,
      notes: input.notes || null,
    },
  });

  revalidatePath(`/programs/${programId}`);
  redirect(`/programs/${programId}?saved=1`);
}

export async function updateMesocycle(mesocycleId: string, formData: FormData) {
  const userId = await requireUserId();
  const mesocycle = await prisma.programMesocycle.findFirst({ where: { id: mesocycleId, userId, isArchived: false } });
  if (!mesocycle) redirect("/programs");
  const input = parseMesocycleForm(formData);
  const nextStartDate = parseDateOnly(input.startDate);
  const nextPlannedEndDate = plannedMesocycleEndDate(nextStartDate, input.lengthWeeks);

  if (mesocycle.actualEndDate && (mesocycle.actualEndDate < nextStartDate || mesocycle.actualEndDate > nextPlannedEndDate)) {
    redirect(`/programs/${mesocycle.programId}?mesocycleEndError=1`);
  }

  await prisma.programMesocycle.update({
    where: { id: mesocycle.id },
    data: {
      name: input.name,
      phase: input.phase as ProgramPhase,
      startDate: nextStartDate,
      lengthWeeks: input.lengthWeeks,
      notes: input.notes || null,
    },
  });

  revalidatePath(`/programs/${mesocycle.programId}`);
  redirect(`/programs/${mesocycle.programId}?saved=1`);
}

export async function endMesocycle(mesocycleId: string, formData: FormData) {
  const userId = await requireUserId();
  const mesocycle = await prisma.programMesocycle.findFirst({
    where: { id: mesocycleId, userId, isArchived: false, actualEndDate: null },
  });
  if (!mesocycle) redirect("/programs");

  const requestedDate = String(formData.get("actualEndDate") ?? toDateInputValue(new Date()));
  const actualEndDate = parseDateOnly(requestedDate);
  const today = parseDateOnly(toDateInputValue(new Date()));
  const plannedEndDate = plannedMesocycleEndDate(mesocycle.startDate, mesocycle.lengthWeeks);

  if (Number.isNaN(actualEndDate.getTime()) || actualEndDate < mesocycle.startDate || actualEndDate > plannedEndDate || actualEndDate > today) {
    redirect(`/programs/${mesocycle.programId}?mesocycleEndError=1`);
  }

  await prisma.programMesocycle.update({
    where: { id: mesocycle.id },
    data: { actualEndDate },
  });

  revalidatePath(`/programs/${mesocycle.programId}`);
  revalidatePath("/templates");
  revalidatePath("/log");
  revalidatePath("/dashboard");
  redirect(`/programs/${mesocycle.programId}?mesocycleEnded=1`);
}

export async function archiveMesocycle(formData: FormData) {
  const userId = await requireUserId();
  const mesocycleId = String(formData.get("mesocycleId") ?? "");
  const mesocycle = await prisma.programMesocycle.findFirst({ where: { id: mesocycleId, userId, isArchived: false } });
  if (!mesocycle) redirect("/programs");

  await prisma.programMesocycle.update({ where: { id: mesocycle.id }, data: { isArchived: true } });

  revalidatePath(`/programs/${mesocycle.programId}`);
  redirect(`/programs/${mesocycle.programId}`);
}

export async function updateMesocycleVolumeTargets(mesocycleId: string, formData: FormData) {
  const userId = await requireUserId();
  const mesocycle = await prisma.programMesocycle.findFirst({ where: { id: mesocycleId, userId, isArchived: false } });
  if (!mesocycle) redirect("/programs");

  const muscles = await prisma.muscle.findMany({ orderBy: { sortOrder: "asc" } });
  const rows = muscles
    .map((muscle) => {
      const targetSets = decimalOrNull(formData.get(`target:${muscle.id}`));
      const minimumSets = decimalOrNull(formData.get(`min:${muscle.id}`));
      const maximumSets = decimalOrNull(formData.get(`max:${muscle.id}`));
      const priorityLevel = formData.get(`priority:${muscle.id}`) === "on" ? 1 : 0;
      return {
        muscleId: muscle.id,
        targetSets,
        minimumSets,
        maximumSets,
        priorityLevel,
      };
    })
    .filter((row) => row.targetSets !== null || row.minimumSets !== null || row.maximumSets !== null || row.priorityLevel > 0);

  await prisma.$transaction(async (tx) => {
    await tx.mesocycleMuscleVolumeTarget.deleteMany({ where: { mesocycleId } });
    if (rows.length > 0) {
      await tx.mesocycleMuscleVolumeTarget.createMany({
        data: rows.map((row) => ({
          mesocycleId,
          muscleId: row.muscleId,
          targetSets: row.targetSets ?? 0,
          minimumSets: row.minimumSets,
          maximumSets: row.maximumSets,
          priorityLevel: row.priorityLevel,
        })),
      });
    }
  });

  revalidatePath(`/programs/${mesocycle.programId}`);
  revalidatePath("/templates");
  revalidatePath("/log");
  revalidatePath("/dashboard");
  redirect(`/programs/${mesocycle.programId}?saved=1`);
}

export async function updateMesocycleRepPolicies(mesocycleId: string, formData: FormData) {
  const userId = await requireUserId();
  const mesocycle = await prisma.programMesocycle.findFirst({ where: { id: mesocycleId, userId, isArchived: false } });
  if (!mesocycle) redirect("/programs");
  const buckets = ["HEAVY_COMPOUND", "SECONDARY_COMPOUND", "ISOLATION", "LENGTHENED_ISOLATION"];
  const rows = buckets
    .map((bucket) => {
      const minReps = Number(formData.get(`min:${bucket}`));
      const maxReps = Number(formData.get(`max:${bucket}`));
      return { bucket, minReps, maxReps };
    })
    .filter((row) => Number.isFinite(row.minReps) && Number.isFinite(row.maxReps) && row.minReps > 0 && row.maxReps >= row.minReps);

  await prisma.$transaction(async (tx) => {
    await tx.mesocycleRepPolicy.deleteMany({ where: { mesocycleId } });
    if (rows.length > 0) {
      await tx.mesocycleRepPolicy.createMany({
        data: rows.map((row) => ({ mesocycleId, repBucket: row.bucket, minReps: row.minReps, maxReps: row.maxReps })),
      });
    }
  });

  revalidatePath(`/programs/${mesocycle.programId}`);
  revalidatePath("/templates");
  revalidatePath("/log");
  redirect(`/programs/${mesocycle.programId}?saved=1`);
}

export async function updateMesocycleMovementRepPolicies(mesocycleId: string, formData: FormData) {
  const userId = await requireUserId();
  const mesocycle = await prisma.programMesocycle.findFirst({ where: { id: mesocycleId, userId, isArchived: false } });
  if (!mesocycle) redirect("/programs");

  const movementGroups = await prisma.movementGroup.findMany({ orderBy: { sortOrder: "asc" } });
  const rows = movementGroups
    .map((movementGroup) => {
      const minReps = Number(formData.get(`min:${movementGroup.id}`));
      const maxReps = Number(formData.get(`max:${movementGroup.id}`));
      return { movementGroupId: movementGroup.id, minReps, maxReps };
    })
    .filter((row) => Number.isFinite(row.minReps) && Number.isFinite(row.maxReps) && row.minReps > 0 && row.maxReps >= row.minReps);

  await prisma.$transaction(async (tx) => {
    await tx.mesocycleMovementRepPolicy.deleteMany({ where: { mesocycleId } });
    if (rows.length > 0) {
      await tx.mesocycleMovementRepPolicy.createMany({ data: rows.map((row) => ({ mesocycleId, ...row })) });
    }
  });

  revalidatePath(`/programs/${mesocycle.programId}`);
  revalidatePath("/templates");
  revalidatePath("/log");
  redirect(`/programs/${mesocycle.programId}?saved=1`);
}

export async function updateMesocycleMovementVolumeTargets(mesocycleId: string, formData: FormData) {
  const userId = await requireUserId();
  const mesocycle = await prisma.programMesocycle.findFirst({ where: { id: mesocycleId, userId, isArchived: false } });
  if (!mesocycle) redirect("/programs");

  const movementGroups = await prisma.movementGroup.findMany({ orderBy: { sortOrder: "asc" } });
  const rows = movementGroups
    .map((movementGroup) => ({
      movementGroupId: movementGroup.id,
      targetSets: decimalOrNull(formData.get(`target:${movementGroup.id}`)),
    }))
    .filter((row) => row.targetSets !== null);

  await prisma.$transaction(async (tx) => {
    await tx.mesocycleMovementVolumeTarget.deleteMany({ where: { mesocycleId } });
    if (rows.length > 0) {
      await tx.mesocycleMovementVolumeTarget.createMany({
        data: rows.map((row) => ({ mesocycleId, movementGroupId: row.movementGroupId, targetSets: row.targetSets ?? 0 })),
      });
    }
  });

  revalidatePath(`/programs/${mesocycle.programId}`);
  revalidatePath("/templates");
  revalidatePath("/log");
  revalidatePath("/dashboard");
  redirect(`/programs/${mesocycle.programId}?saved=1`);
}

export async function approveMesocycleStructureProposal(mesocycleId: string, formData: FormData) {
  const userId = await requireUserId();
  const proposalId = String(formData.get("proposalId") ?? "");
  const mesocycle = await prisma.programMesocycle.findFirst({
    where: { id: mesocycleId, userId, isArchived: false },
  });
  if (!mesocycle || !proposalId) redirect("/programs");

  const today = parseDateOnly(toDateInputValue(new Date()));
  const plannedEndDate = plannedMesocycleEndDate(mesocycle.startDate, mesocycle.lengthWeeks);
  if (mesocycle.actualEndDate || plannedEndDate < today) redirect(`/programs/${mesocycle.programId}`);

  const prescription = await buildProgramPrescription(mesocycle.programId, userId, {
    mesocycleId: mesocycle.id,
    includeWeeklyPlan: false,
  });
  const proposal = prescription?.generated.structureProposals.find((row) => row.id === proposalId);
  if (!proposal) redirect(`/programs/${mesocycle.programId}?structureProposalStale=1`);

  const current = parseMesocycleStructureOverrides(mesocycle.structureOverrides);
  const actions = [...current.actions.filter((action) => action.id !== proposal.action.id), proposal.action];
  await prisma.programMesocycle.update({
    where: { id: mesocycle.id },
    data: { structureOverrides: { version: 1, actions } as Prisma.InputJsonValue },
  });

  revalidatePath(`/programs/${mesocycle.programId}`);
  revalidatePath("/templates");
  revalidatePath("/log");
  revalidatePath("/dashboard");
  redirect(`/programs/${mesocycle.programId}?structureApproved=1`);
}

export async function removeMesocycleStructureOverride(mesocycleId: string, formData: FormData) {
  const userId = await requireUserId();
  const actionId = String(formData.get("actionId") ?? "");
  const mesocycle = await prisma.programMesocycle.findFirst({
    where: { id: mesocycleId, userId, isArchived: false },
  });
  if (!mesocycle || !actionId) redirect("/programs");

  const current = parseMesocycleStructureOverrides(mesocycle.structureOverrides);
  const actions = current.actions.filter((action) => action.id !== actionId);
  await prisma.programMesocycle.update({
    where: { id: mesocycle.id },
    data: { structureOverrides: { version: 1, actions } as Prisma.InputJsonValue },
  });

  revalidatePath(`/programs/${mesocycle.programId}`);
  revalidatePath("/templates");
  revalidatePath("/log");
  revalidatePath("/dashboard");
  redirect(`/programs/${mesocycle.programId}?structureUpdated=1`);
}

export async function getMesocyclePanelData(programId: string) {
  const userId = await requireUserId();
  const program = await prisma.program.findFirst({
    where: { id: programId, userId, isArchived: false },
    include: {
      volumeTargets: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
      priorityMuscles: true,
      templates: {
        where: { isActive: true, isArchived: false },
        select: { id: true, name: true },
      },
    },
  });
  if (!program) return null;

  const mesocycles = await prisma.programMesocycle.findMany({
    where: { programId, userId, isArchived: false },
    orderBy: { startDate: "desc" },
    include: {
      volumeTargets: { include: { muscle: true } },
      repPolicies: true,
      movementRepPolicies: true,
      movementVolumeTargets: { include: { movementGroup: true } },
    },
  });

  const today = parseDateOnly(toDateInputValue(new Date()));
  const statusFor = (mesocycle: (typeof mesocycles)[number]): "ACTIVE" | "UPCOMING" | "COMPLETED" => {
    const plannedEndDate = plannedMesocycleEndDate(mesocycle.startDate, mesocycle.lengthWeeks);
    if (mesocycle.actualEndDate || plannedEndDate < today) return "COMPLETED";
    if (mesocycle.startDate > today) return "UPCOMING";
    return "ACTIVE";
  };

  const structureCandidates = mesocycles.filter(
    (mesocycle) => statusFor(mesocycle) !== "COMPLETED" && mesocycle.movementVolumeTargets.length > 0,
  );

  const prescriptionMesocycleIds = Array.from(
    new Set([
      ...mesocycles.slice(0, 4).map((mesocycle) => mesocycle.id),
      ...structureCandidates.map((mesocycle) => mesocycle.id),
    ]),
  );

  const [prescriptionEntries, muscles, movementGroups] = await Promise.all([
    Promise.all(
      prescriptionMesocycleIds.map(async (mesocycleId) => ({
        mesocycleId,
        prescription: await buildProgramPrescription(program.id, userId, { mesocycleId, includeWeeklyPlan: false }),
      })),
    ),
    prisma.muscle.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.movementGroup.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const prescriptionByMesocycle = new Map(
    prescriptionEntries.map(({ mesocycleId, prescription }) => [mesocycleId, prescription]),
  );
  const reviews = await Promise.all(
    mesocycles.slice(0, 4).map(async (mesocycle) =>
      buildMesocycleReview(userId, program, mesocycle, prescriptionByMesocycle.get(mesocycle.id) ?? null),
    ),
  );

  const structureDisplayScale = 7 / volumeWindowDays(program.volumeWindowType, program.customWindowDays ?? null);

  const structureByMesocycle = new Map(
    structureCandidates.map((mesocycle) => [
      mesocycle.id,
      prescriptionByMesocycle.get(mesocycle.id)
        ? {
            approved: prescriptionByMesocycle.get(mesocycle.id)!.generated.approvedStructureActions,
            proposals: prescriptionByMesocycle.get(mesocycle.id)!.generated.structureProposals.map((proposal) => ({
              id: proposal.id,
              type: proposal.type,
              movementGroupId: proposal.movementGroupId,
              movementGroupName: proposal.movementGroupName,
              templateId: proposal.templateId,
              templateName: proposal.templateName,
              targetEffectiveSets: round(proposal.targetEffectiveSets * structureDisplayScale),
              currentEffectiveSets: round(proposal.currentEffectiveSets * structureDisplayScale),
              projectedEffectiveSets: round(proposal.projectedEffectiveSets * structureDisplayScale),
              physicalSets: proposal.physicalSets,
              setTypeSummary: proposal.setTypeSummary,
              reason: proposal.reason,
            })),
            movementRows: prescriptionByMesocycle.get(mesocycle.id)!.generated.movementVolumeRows.map((row) => ({
              movementGroupId: row.movementGroupId,
              movementGroupName: row.movementGroupName,
              target: row.target === null ? null : round(row.target * structureDisplayScale),
              base: round(row.base * structureDisplayScale),
              planned: round(row.planned * structureDisplayScale),
            })),
          }
        : null,
    ]),
  );


  return {
    programId,
    activePhase: program.activePhase,
    muscles,
    movementGroups,
    programTargets: program.volumeTargets.map((target: any) => ({
      muscleId: target.muscleId,
      weeklyTargetSets: toNumber(target.weeklyTargetSets),
    })),
    mesocycles: mesocycles.map((mesocycle) => {
      const plannedEndDate = plannedMesocycleEndDate(mesocycle.startDate, mesocycle.lengthWeeks);
      const effectiveEndDate = effectiveMesocycleEndDate(mesocycle.startDate, mesocycle.lengthWeeks, mesocycle.actualEndDate);
      const status = statusFor(mesocycle);
      const structurePlan = structureByMesocycle.get(mesocycle.id) ?? {
        approved: parseMesocycleStructureOverrides(mesocycle.structureOverrides).actions.map((action) => ({
          id: action.id,
          type: action.type,
          movementGroupId: action.movementGroupId,
          movementGroupName: movementGroups.find((group) => group.id === action.movementGroupId)?.name ?? "Movement slot",
          templateId: action.templateId,
          templateName: program.templates.find((template) => template.id === action.templateId)?.name ?? "Template",
          description: action.type === "ADD_SLOT" ? "Mesocycle-only slot added" : "Base slot hidden for this mesocycle",
        })),
        proposals: [],
        movementRows: [],
      };

      return {
        id: mesocycle.id,
        name: mesocycle.name,
        phase: mesocycle.phase,
        status,
        startDate: toDateInputValue(mesocycle.startDate),
        endDate: toDateInputValue(effectiveEndDate),
        plannedEndDate: toDateInputValue(plannedEndDate),
        actualEndDate: mesocycle.actualEndDate ? toDateInputValue(mesocycle.actualEndDate) : null,
        endedEarly: Boolean(mesocycle.actualEndDate && mesocycle.actualEndDate < plannedEndDate),
        lengthWeeks: mesocycle.lengthWeeks,
        notes: mesocycle.notes ?? "",
        volumeTargets: mesocycle.volumeTargets.map((target: any) => ({
          muscleId: target.muscleId,
          targetSets: toNumber(target.targetSets),
          minimumSets: target.minimumSets === null ? null : toNumber(target.minimumSets),
          maximumSets: target.maximumSets === null ? null : toNumber(target.maximumSets),
          priorityLevel: target.priorityLevel,
        })),
        repPolicies: mesocycle.repPolicies.map((policy: any) => ({
          repBucket: policy.repBucket,
          minReps: policy.minReps,
          maxReps: policy.maxReps,
        })),
        movementRepPolicies: mesocycle.movementRepPolicies.map((policy: any) => ({
          movementGroupId: policy.movementGroupId,
          minReps: policy.minReps,
          maxReps: policy.maxReps,
        })),
        movementVolumeTargets: mesocycle.movementVolumeTargets.map((target: any) => ({
          movementGroupId: target.movementGroupId,
          targetSets: toNumber(target.targetSets),
        })),
        structurePlan,
      };
    }),
    reviews,
  };
}

async function buildMesocycleReview(
  userId: string,
  program: any,
  mesocycle: any,
  prescriptionOverride?: Awaited<ReturnType<typeof buildProgramPrescription>> | null,
) {
  const startDate = mesocycle.startDate;
  const plannedEndDate = plannedMesocycleEndDate(startDate, mesocycle.lengthWeeks);
  const endDate = effectiveMesocycleEndDate(startDate, mesocycle.lengthWeeks, mesocycle.actualEndDate);
  const endExclusive = addDays(endDate, 1);
  const days = durationDaysInclusive(startDate, endDate);
  const durationWeeks = days / 7;
  const priorityIds = new Set(program.priorityMuscles.map((link: any) => link.muscleId));
  const prescription = prescriptionOverride ?? await buildProgramPrescription(program.id, userId, { mesocycleId: mesocycle.id, includeWeeklyPlan: false });
  const windowDays = volumeWindowDays(program.volumeWindowType, program.customWindowDays ?? null);
  const planMultiplier = days / windowDays;
  const secondaryContribution = toNumber(program.secondaryContribution, 0.5);

  type MuscleRow = {
    muscleId: string;
    muscleName: string;
    sortOrder: number;
    target: number;
    planned: number;
    completed: number;
    productive: number;
    status: string;
    isPriority: boolean;
  };

  const muscleRows = new Map<string, MuscleRow>();
  for (const target of program.volumeTargets) {
    muscleRows.set(target.muscleId, {
      muscleId: target.muscleId,
      muscleName: target.muscle.name,
      sortOrder: target.muscle.sortOrder,
      target: toNumber(target.weeklyTargetSets) * durationWeeks,
      planned: 0,
      completed: 0,
      productive: 0,
      status: "on",
      isPriority: priorityIds.has(target.muscleId),
    });
  }

  for (const target of mesocycle.volumeTargets ?? []) {
    const previous = muscleRows.get(target.muscleId);
    const overrideTarget = toNumber(target.targetSets);
    muscleRows.set(target.muscleId, {
      muscleId: target.muscleId,
      muscleName: target.muscle.name,
      sortOrder: target.muscle.sortOrder,
      target: overrideTarget > 0 ? overrideTarget * durationWeeks : previous?.target ?? 0,
      planned: previous?.planned ?? 0,
      completed: previous?.completed ?? 0,
      productive: previous?.productive ?? 0,
      status: "on",
      isPriority: target.priorityLevel > 0 || priorityIds.has(target.muscleId),
    });
  }

  for (const row of prescription?.generated.volumeRows ?? []) {
    const current = muscleRows.get(row.muscleId) ?? {
      muscleId: row.muscleId,
      muscleName: row.muscleName,
      sortOrder: row.sortOrder,
      target: 0,
      planned: 0,
      completed: 0,
      productive: 0,
      status: "on",
      isPriority: priorityIds.has(row.muscleId),
    };
    current.planned = row.planned * planMultiplier;
    muscleRows.set(row.muscleId, current);
  }

  type MovementRow = {
    movementGroupId: string;
    movementGroupName: string;
    sortOrder: number;
    target: number;
    planned: number;
    completed: number;
    productive: number;
    status: string;
  };
  const movementRows = new Map<string, MovementRow>();

  for (const target of mesocycle.movementVolumeTargets ?? []) {
    movementRows.set(target.movementGroupId, {
      movementGroupId: target.movementGroupId,
      movementGroupName: target.movementGroup.name,
      sortOrder: target.movementGroup.sortOrder,
      target: toNumber(target.targetSets) * durationWeeks,
      planned: 0,
      completed: 0,
      productive: 0,
      status: "on",
    });
  }

  for (const generatedRow of prescription?.generated.movementVolumeRows ?? []) {
    const row = movementRows.get(generatedRow.movementGroupId) ?? {
      movementGroupId: generatedRow.movementGroupId,
      movementGroupName: generatedRow.movementGroupName,
      sortOrder: generatedRow.sortOrder,
      target: 0,
      planned: 0,
      completed: 0,
      productive: 0,
      status: "on",
    };
    row.planned = toNumber(generatedRow.planned) * planMultiplier;
    movementRows.set(generatedRow.movementGroupId, row);
  }

  const sessionExercises = await prisma.workoutSessionExercise.findMany({
    where: {
      session: {
        userId,
        programId: program.id,
        status: "COMPLETED",
        performedAt: { gte: startDate, lt: endExclusive },
      },
    },
    include: {
      exercise: {
        include: {
          movementGroup: true,
          primaryMuscles: { include: { muscle: true } },
          secondaryMuscles: { include: { muscle: true } },
        },
      },
      session: true,
      stimulusSetType: true,
      sets: { orderBy: { setNumber: "asc" }, include: { setType: true } },
    },
    orderBy: { session: { performedAt: "asc" } },
  });

  const repRange = { inRange: 0, tooLow: 0, tooHigh: 0, mixed: 0, notLogged: 0 };
  const effort = { tooEasy: 0, productive: 0, veryHard: 0, failure: 0, notSure: 0 };
  const performanceByExercise = new Map<string, Array<{ date: Date; e1rm: number }>>();

  for (const item of sessionExercises) {
    const contribution = getStimulusContribution(item);
    const completed = contribution.completed;
    const productiveEquivalent = contribution.productiveEquivalent;

    const completedRows = item.sets.filter((set: any) => set.isCompleted);
    if (completedRows.length > 0 || item.sets.length > 0) {
      for (const set of completedRows) {
        const repStatus = set.repRangeStatus ?? item.repRangeStatus ?? "NOT_LOGGED";
        if (repStatus === "IN_RANGE") repRange.inRange += 1;
        else if (repStatus === "TOO_LOW") repRange.tooLow += 1;
        else if (repStatus === "TOO_HIGH") repRange.tooHigh += 1;
        else if (repStatus === "MIXED") repRange.mixed += 1;
        else repRange.notLogged += 1;

        const effortStatus = set.effortStatus ?? item.effortStatus ?? "PRODUCTIVE";
        if (effortStatus === "TOO_EASY") effort.tooEasy += 1;
        else if (effortStatus === "PRODUCTIVE") effort.productive += 1;
        else if (effortStatus === "VERY_HARD") effort.veryHard += 1;
        else if (effortStatus === "FAILURE") effort.failure += 1;
        else effort.notSure += 1;
      }
    } else if (usesStimulusEntry(item)) {
      if (item.repRangeStatus === "IN_RANGE") repRange.inRange += completed;
      else if (item.repRangeStatus === "TOO_LOW") repRange.tooLow += completed;
      else if (item.repRangeStatus === "TOO_HIGH") repRange.tooHigh += completed;
      else if (item.repRangeStatus === "MIXED") repRange.mixed += completed;
      else repRange.notLogged += completed;

      if (item.effortStatus === "TOO_EASY") effort.tooEasy += completed;
      else if (item.effortStatus === "PRODUCTIVE") effort.productive += completed;
      else if (item.effortStatus === "VERY_HARD") effort.veryHard += completed;
      else if (item.effortStatus === "FAILURE") effort.failure += completed;
      else effort.notSure += completed;
    } else {
      repRange.notLogged += completed;
      effort.productive += completed;
    }

    const bestE1rm = item.sets
      .filter((set: any) => set.isCompleted && set.weight !== null && set.reps !== null)
      .map((set: any) => estimateE1RM(toNumber(set.weight), set.reps ?? 0))
      .filter((value: number | null) => value !== null && Number.isFinite(value)) as number[];

    if (bestE1rm.length > 0) {
      const list = performanceByExercise.get(item.exerciseId) ?? [];
      list.push({ date: item.session.performedAt, e1rm: Math.max(...bestE1rm) });
      performanceByExercise.set(item.exerciseId, list);
    }

    const movement = item.exercise.movementGroup;
    const movementRow = movementRows.get(movement.id) ?? {
      movementGroupId: movement.id,
      movementGroupName: movement.name,
      sortOrder: movement.sortOrder,
      target: 0,
      planned: 0,
      completed: 0,
      productive: 0,
      status: "on",
    };
    movementRow.completed += completed;
    movementRow.productive += productiveEquivalent;
    movementRows.set(movement.id, movementRow);

    for (const link of item.exercise.primaryMuscles) {
      const row = muscleRows.get(link.muscleId) ?? {
        muscleId: link.muscleId,
        muscleName: link.muscle.name,
        sortOrder: link.muscle.sortOrder,
        target: 0,
        planned: 0,
        completed: 0,
        productive: 0,
        status: "on",
        isPriority: priorityIds.has(link.muscleId),
      };
      row.completed += completed;
      row.productive += productiveEquivalent;
      muscleRows.set(link.muscleId, row);
    }

    for (const link of item.exercise.secondaryMuscles) {
      const row = muscleRows.get(link.muscleId) ?? {
        muscleId: link.muscleId,
        muscleName: link.muscle.name,
        sortOrder: link.muscle.sortOrder,
        target: 0,
        planned: 0,
        completed: 0,
        productive: 0,
        status: "on",
        isPriority: priorityIds.has(link.muscleId),
      };
      row.productive += productiveEquivalent * secondaryContribution;
      muscleRows.set(link.muscleId, row);
    }
  }

  function classify(productive: number, target: number) {
    if (target <= 0) return "on";
    const ratio = productive / target;
    if (ratio < 0.85) return "below";
    if (ratio > 1.25) return "above";
    return "on";
  }

  const volume = Array.from(muscleRows.values())
    .map((row) => ({
      ...row,
      target: round(row.target),
      planned: round(row.planned),
      completed: round(row.completed),
      productive: round(row.productive),
      actual: round(row.productive),
      status: classify(row.productive, row.target),
      adherence: row.target > 0 ? round((row.productive / row.target) * 100, 0) : null,
    }))
    .filter((row) => row.target > 0 || row.planned > 0 || row.completed > 0 || row.productive > 0)
    .sort((a, b) => Number(b.isPriority) - Number(a.isPriority) || a.sortOrder - b.sortOrder);

  const movementVolume = Array.from(movementRows.values())
    .map((row) => ({
      ...row,
      target: round(row.target),
      planned: round(row.planned),
      completed: round(row.completed),
      productive: round(row.productive),
      status: classify(row.productive, row.target),
      adherence: row.target > 0 ? round((row.productive / row.target) * 100, 0) : null,
    }))
    .filter((row) => row.target > 0 || row.planned > 0 || row.completed > 0 || row.productive > 0)
    .sort((a, b) => b.productive - a.productive || a.sortOrder - b.sortOrder);

  let up = 0;
  let down = 0;
  let flat = 0;
  for (const exposures of performanceByExercise.values()) {
    if (exposures.length < 2) continue;
    const first = exposures[0]?.e1rm;
    const last = exposures[exposures.length - 1]?.e1rm;
    if (!first || !last) continue;
    const change = (last - first) / first;
    if (change > 0.02) up += 1;
    else if (change < -0.02) down += 1;
    else flat += 1;
  }

  const circumferenceWindowStart = addDays(startDate, -7);
  const circumferenceWindowEnd = addDays(endDate, 8);
  const metrics = await prisma.metricLog.findMany({
    where: { userId, isDraft: false, loggedAt: { gte: circumferenceWindowStart, lt: circumferenceWindowEnd } },
    orderBy: { loggedAt: "asc" },
  });
  const startWindowEnd = addDays(startDate, 7);
  const endWindowStart = addDays(endExclusive, -7);
  const avg = (values: Array<number | null>) => {
    const filtered = values.filter((value): value is number => value !== null && Number.isFinite(value));
    return filtered.length > 0 ? round(filtered.reduce((sum, value) => sum + value, 0) / filtered.length, 1) : null;
  };
  const metricNumber = (value: unknown) => (value === null || value === undefined ? null : toNumber(value));
  const startMetrics = metrics.filter((metric: any) => metric.loggedAt >= startDate && metric.loggedAt < startWindowEnd);
  const endMetrics = metrics.filter((metric: any) => metric.loggedAt >= endWindowStart && metric.loggedAt < endExclusive);
  const startBoundaryMetrics = metrics.filter(
    (metric: any) => metric.loggedAt >= circumferenceWindowStart && metric.loggedAt < addDays(startDate, 8),
  );
  const endBoundaryMetrics = metrics.filter(
    (metric: any) => metric.loggedAt >= addDays(endDate, -7) && metric.loggedAt < circumferenceWindowEnd,
  );
  const circumferenceFields = ["chest", "shoulders", "arms", "thighs", "glutes", "calves"] as const;

  function nearestCircumferenceValue(
    boundaryMetrics: any[],
    field: (typeof circumferenceFields)[number],
    boundaryDate: Date,
    preferredLogType: "MESOCYCLE_START" | "MESOCYCLE_END",
  ) {
    const withValue = boundaryMetrics.filter((metric) => metricNumber(metric[field]) !== null);
    const preferred = withValue.filter((metric) => metric.logType === preferredLogType);
    const candidates = preferred.length > 0 ? preferred : withValue;
    const nearest = [...candidates].sort(
      (left, right) => Math.abs(left.loggedAt.getTime() - boundaryDate.getTime()) - Math.abs(right.loggedAt.getTime() - boundaryDate.getTime()),
    )[0];
    return nearest ? metricNumber(nearest[field]) : null;
  }

  const metricSummary = {
    startBodyweight7d: avg(startMetrics.map((metric: any) => metricNumber(metric.bodyweight))),
    endBodyweight7d: avg(endMetrics.map((metric: any) => metricNumber(metric.bodyweight))),
    startWaist7d: avg(startMetrics.map((metric: any) => metricNumber(metric.waist))),
    endWaist7d: avg(endMetrics.map((metric: any) => metricNumber(metric.waist))),
    circumferences: circumferenceFields.map((field) => ({
      field,
      start: nearestCircumferenceValue(startBoundaryMetrics, field, startDate, "MESOCYCLE_START"),
      end: nearestCircumferenceValue(endBoundaryMetrics, field, endDate, "MESOCYCLE_END"),
    })),
  };

  const belowPriority = volume.filter((row) => row.isPriority && row.status === "below").length;
  const aboveRows = volume.filter((row) => row.status === "above").length;
  const tooEasySets = effort.tooEasy;
  const recommendation =
    sessionExercises.length === 0
      ? "No completed sessions in this mesocycle yet."
      : belowPriority > 0
        ? "Priority productive volume is below target. Review adherence or planned set allocation next mesocycle."
        : tooEasySets > 0
          ? "Some completed volume was marked too easy. Treat it separately from productive stimulus."
          : aboveRows > 0
            ? "Some muscles are above target. Keep or reduce depending on recovery and next block intent."
            : "Productive volume broadly matches the target structure.";

  return {
    id: mesocycle.id,
    name: mesocycle.name,
    startDate: toDateInputValue(startDate),
    endDate: toDateInputValue(endDate),
    plannedEndDate: toDateInputValue(plannedEndDate),
    endedEarly: Boolean(mesocycle.actualEndDate && mesocycle.actualEndDate < plannedEndDate),
    durationDays: days,
    sessionCount: new Set(sessionExercises.map((item: any) => item.sessionId)).size,
    volume,
    movementVolume,
    effort,
    repRange,
    metrics: metricSummary,
    performance: { up, flat, down },
    recommendation,
  };
}
