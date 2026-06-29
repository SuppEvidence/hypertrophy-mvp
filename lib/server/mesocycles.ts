"use server";

import type { ProgramPhase } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/auth/server";
import { ensureProfile } from "@/lib/auth/profile";
import { prisma } from "@/lib/db/prisma";
import { estimateE1RM } from "@/lib/calculations/performance";
import { mesocycleSchema } from "@/lib/validations/mesocycle";

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await ensureProfile(user);
  return user.id;
}

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

function parseMesocycleForm(formData: FormData) {
  return mesocycleSchema.parse({
    name: formData.get("name"),
    phase: formData.get("phase"),
    startDate: formData.get("startDate"),
    lengthWeeks: formData.get("lengthWeeks"),
    notes: String(formData.get("notes") ?? ""),
  });
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

  await prisma.programMesocycle.update({
    where: { id: mesocycle.id },
    data: {
      name: input.name,
      phase: input.phase as ProgramPhase,
      startDate: parseDateOnly(input.startDate),
      lengthWeeks: input.lengthWeeks,
      notes: input.notes || null,
    },
  });

  revalidatePath(`/programs/${mesocycle.programId}`);
  redirect(`/programs/${mesocycle.programId}?saved=1`);
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

export async function getMesocyclePanelData(programId: string) {
  const userId = await requireUserId();
  const program = await prisma.program.findFirst({
    where: { id: programId, userId, isArchived: false },
    include: {
      volumeTargets: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
      priorityMuscles: true,
    },
  });
  if (!program) return null;

  const mesocycles = await prisma.programMesocycle.findMany({
    where: { programId, userId, isArchived: false },
    orderBy: { startDate: "desc" },
  });

  const reviews = await Promise.all(
    mesocycles.slice(0, 4).map(async (mesocycle) => buildMesocycleReview(userId, program, mesocycle)),
  );

  return {
    programId,
    activePhase: program.activePhase,
    mesocycles: mesocycles.map((mesocycle) => ({
      id: mesocycle.id,
      name: mesocycle.name,
      phase: mesocycle.phase,
      startDate: toDateInputValue(mesocycle.startDate),
      endDate: toDateInputValue(addDays(mesocycle.startDate, mesocycle.lengthWeeks * 7 - 1)),
      lengthWeeks: mesocycle.lengthWeeks,
      notes: mesocycle.notes ?? "",
    })),
    reviews,
  };
}

async function buildMesocycleReview(userId: string, program: any, mesocycle: any) {
  const startDate = mesocycle.startDate;
  const endExclusive = addDays(startDate, mesocycle.lengthWeeks * 7);
  const days = mesocycle.lengthWeeks * 7;
  const priorityIds = new Set(program.priorityMuscles.map((link: any) => link.muscleId));
  type TargetVolumeRow = {
    muscleId: string;
    muscleName: string;
    sortOrder: number;
    target: number;
  };
  const targetByMuscle = new Map<string, TargetVolumeRow>(
    program.volumeTargets.map((target: any) => [
      target.muscleId,
      {
        muscleId: target.muscleId,
        muscleName: target.muscle.name,
        sortOrder: target.muscle.sortOrder,
        target: (toNumber(target.weeklyTargetSets) * days) / 7,
      },
    ]),
  );

  const sessionExercises = await prisma.workoutSessionExercise.findMany({
    where: {
      session: {
        userId,
        programId: program.id,
        status: "COMPLETED",
        performedAt: { gte: startDate, lt: endExclusive },
      },
      sets: { some: { isCompleted: true } },
    },
    include: {
      exercise: {
        include: {
          primaryMuscles: { include: { muscle: true } },
          secondaryMuscles: { include: { muscle: true } },
        },
      },
      session: true,
      sets: { include: { setType: true } },
    },
    orderBy: { session: { performedAt: "asc" } },
  });

  const volumeRows = new Map<string, { muscleId: string; muscleName: string; sortOrder: number; actual: number; target: number; status: string; isPriority: boolean }>();
  const performanceByExercise = new Map<string, Array<{ date: Date; e1rm: number }>>();
  const secondaryContribution = toNumber(program.secondaryContribution, 0.5);

  for (const item of sessionExercises) {
    const effectiveSetTotal = item.sets
      .filter((set: any) => set.isCompleted)
      .reduce((sum: number, set: any) => sum + toNumber(set.setType.multiplier, 1), 0);

    const bestE1rm = item.sets
      .filter((set: any) => set.isCompleted && set.weight !== null && set.reps !== null)
      .map((set: any) => estimateE1RM(toNumber(set.weight), set.reps ?? 0))
      .filter((value: number | null) => value !== null && Number.isFinite(value)) as number[];

    if (bestE1rm.length > 0) {
      const list = performanceByExercise.get(item.exerciseId) ?? [];
      list.push({ date: item.session.performedAt, e1rm: Math.max(...bestE1rm) });
      performanceByExercise.set(item.exerciseId, list);
    }

    for (const link of item.exercise.primaryMuscles) {
      const target = targetByMuscle.get(link.muscleId);
      const row = volumeRows.get(link.muscleId) ?? {
        muscleId: link.muscleId,
        muscleName: link.muscle.name,
        sortOrder: link.muscle.sortOrder,
        actual: 0,
        target: target?.target ?? 0,
        status: "on",
        isPriority: priorityIds.has(link.muscleId),
      };
      row.actual += effectiveSetTotal;
      volumeRows.set(link.muscleId, row);
    }

    for (const link of item.exercise.secondaryMuscles) {
      const target = targetByMuscle.get(link.muscleId);
      const row = volumeRows.get(link.muscleId) ?? {
        muscleId: link.muscleId,
        muscleName: link.muscle.name,
        sortOrder: link.muscle.sortOrder,
        actual: 0,
        target: target?.target ?? 0,
        status: "on",
        isPriority: priorityIds.has(link.muscleId),
      };
      row.actual += effectiveSetTotal * secondaryContribution;
      volumeRows.set(link.muscleId, row);
    }
  }

  for (const target of targetByMuscle.values()) {
    if (!volumeRows.has(target.muscleId)) {
      volumeRows.set(target.muscleId, {
        ...target,
        actual: 0,
        status: "below",
        isPriority: priorityIds.has(target.muscleId),
      });
    }
  }

  const volume = Array.from(volumeRows.values())
    .map((row) => {
      const ratio = row.target > 0 ? row.actual / row.target : 1;
      const status = ratio < 0.85 ? "below" : ratio > 1.25 ? "above" : "on";
      return { ...row, actual: Math.round(row.actual * 10) / 10, target: Math.round(row.target * 10) / 10, ratio, status };
    })
    .filter((row) => row.target > 0 || row.actual > 0)
    .sort((a, b) => Number(b.isPriority) - Number(a.isPriority) || a.sortOrder - b.sortOrder);

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

  const belowPriority = volume.filter((row) => row.isPriority && row.status === "below").length;
  const aboveRows = volume.filter((row) => row.status === "above").length;
  const recommendation =
    sessionExercises.length === 0
      ? "No completed sessions in this mesocycle yet."
      : belowPriority > 0
        ? "Priority volume is below target. Consider adding exposure or reallocating sets next mesocycle."
        : down > up && aboveRows > 0
          ? "Performance is down while volume is high. Consider reducing volume or adding a deload/hold."
          : up >= down && aboveRows === 0
            ? "Keep the structure broadly similar. Progression and target volume look acceptable."
            : "Review exercise-level performance and adjust volume only where recovery or progress suggests it.";

  return {
    id: mesocycle.id,
    name: mesocycle.name,
    startDate: toDateInputValue(startDate),
    endDate: toDateInputValue(addDays(startDate, days - 1)),
    sessionCount: new Set(sessionExercises.map((item: any) => item.sessionId)).size,
    volume,
    performance: { up, flat, down },
    recommendation,
  };
}
