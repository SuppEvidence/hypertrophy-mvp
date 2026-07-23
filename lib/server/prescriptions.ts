"use server";

import { prisma } from "@/lib/db/prisma";
import { volumeWindowDays } from "@/lib/programs/options";
import { generateMesocyclePrescription } from "@/lib/planning/mesocycleGenerator";
import { applyWeeklyMissedWorkoutPlan, endOfIsoWeek, parseStoredWeeklyPlan, startOfIsoWeek, toDateOnly } from "@/lib/templates/weeklyPlan";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function getActiveMesocycle(programId: string, userId: string, now = new Date()) {
  const mesocycles = await prisma.programMesocycle.findMany({
    where: { programId, userId, isArchived: false, startDate: { lte: now } },
    orderBy: { startDate: "desc" },
    include: {
      volumeTargets: { include: { muscle: true } },
      repPolicies: true,
      movementRepPolicies: true,
      movementVolumeTargets: { include: { movementGroup: true } },
    },
  });

  return mesocycles.find((mesocycle) => addDays(mesocycle.startDate, mesocycle.lengthWeeks * 7) > now) ?? null;
}

async function getMesocycleForPrescription(programId: string, userId: string, mesocycleId?: string | null) {
  if (!mesocycleId) return getActiveMesocycle(programId, userId);
  return prisma.programMesocycle.findFirst({
    where: { id: mesocycleId, programId, userId, isArchived: false },
    include: {
      volumeTargets: { include: { muscle: true } },
      repPolicies: true,
      movementRepPolicies: true,
      movementVolumeTargets: { include: { movementGroup: true } },
    },
  });
}

export async function buildProgramPrescription(
  programId: string,
  userId: string,
  options?: { mesocycleId?: string | null; includeWeeklyPlan?: boolean },
) {
  const program = await prisma.program.findFirst({
    where: { id: programId, userId, isArchived: false },
    include: {
      volumeTargets: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
      templates: {
        where: { userId, isActive: true, isArchived: false },
        orderBy: { sequenceIndex: "asc" },
        include: {
          exercises: {
            orderBy: { sortOrder: "asc" },
            include: {
              defaultSetType: true,
              movementGroup: true,
              setPlans: { orderBy: { setNumber: "asc" }, include: { setType: true } },
              exercise: {
                include: {
                  movementGroup: true,
                  primaryMuscles: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
                  secondaryMuscles: { include: { muscle: true }, orderBy: { muscle: { sortOrder: "asc" } } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!program) return null;

  const activeMesocycle = await getMesocycleForPrescription(programId, userId, options?.mesocycleId);
  const templateExercises = program.templates.flatMap((template) =>
    template.exercises.map((item) => ({
      id: item.id,
      templateId: template.id,
      templateName: template.name,
      templateSequenceIndex: template.sequenceIndex,
      expectedOccurrences: template.expectedOccurrences,
      exerciseId: item.exerciseId,
      exerciseName: item.exercise.name,
      movementGroupId: item.movementGroupId ?? item.exercise.movementGroupId,
      movementGroupName: item.movementGroup?.name ?? item.exercise.movementGroup.name,
      movementGroupSortOrder: item.movementGroup?.sortOrder ?? item.exercise.movementGroup.sortOrder,
      defaultMinReps: item.exercise.defaultMinReps,
      defaultMaxReps: item.exercise.defaultMaxReps,
      sortOrder: item.sortOrder,
      plannedSets: item.plannedSets,
      minSets: item.minSets,
      maxSets: item.maxSets,
      minReps: item.minReps,
      maxReps: item.maxReps,
      rirTarget: item.rirTarget,
      defaultSetTypeId: item.defaultSetTypeId,
      defaultSetTypeMultiplier: item.defaultSetType.multiplier,
      setPlans: item.setPlans.map((plan) => ({
        setNumber: plan.setNumber,
        setTypeId: plan.setTypeId,
        multiplier: plan.setType.multiplier,
      })),
      slotPriority: item.slotPriority,
      slotRole: item.slotRole,
      repBucket: item.repBucket,
      autoAdjustable: item.autoAdjustable,
      primaryMuscles: item.exercise.primaryMuscles.map((link) => ({
        muscleId: link.muscleId,
        muscleName: link.muscle.name,
        sortOrder: link.muscle.sortOrder,
      })),
      secondaryMuscles: item.exercise.secondaryMuscles.map((link) => ({
        muscleId: link.muscleId,
        muscleName: link.muscle.name,
        sortOrder: link.muscle.sortOrder,
      })),
    })),
  );

  const generated = generateMesocyclePrescription({
    program: {
      secondaryContribution: program.secondaryContribution,
      volumeWindowDays: volumeWindowDays(program.volumeWindowType, program.customWindowDays ?? null),
      volumeTargets: program.volumeTargets.map((target) => ({
        muscleId: target.muscleId,
        muscleName: target.muscle.name,
        sortOrder: target.muscle.sortOrder,
        weeklyTargetSets: target.weeklyTargetSets,
      })),
    },
    mesocycle: activeMesocycle
      ? {
          id: activeMesocycle.id,
          volumeTargets: activeMesocycle.volumeTargets.map((target) => ({
            muscleId: target.muscleId,
            muscleName: target.muscle.name,
            sortOrder: target.muscle.sortOrder,
            targetSets: target.targetSets,
            minimumSets: target.minimumSets,
            maximumSets: target.maximumSets,
            priorityLevel: target.priorityLevel,
          })),
          repPolicies: activeMesocycle.repPolicies.map((policy) => ({
            repBucket: policy.repBucket,
            minReps: policy.minReps,
            maxReps: policy.maxReps,
          })),
          movementRepPolicies: activeMesocycle.movementRepPolicies.map((policy) => ({
            movementGroupId: policy.movementGroupId,
            minReps: policy.minReps,
            maxReps: policy.maxReps,
          })),
        }
      : null,
    templateExercises,
  });

  const includeWeeklyPlan = options?.includeWeeklyPlan !== false;
  const weekStartDate = startOfIsoWeek();
  const weekStart = toDateOnly(weekStartDate);
  const storedWeeklyPlan = parseStoredWeeklyPlan(program.weeklyPlan, weekStart);
  const completedSessions: Array<{ templateId: string | null }> = includeWeeklyPlan
    ? await prisma.workoutSession.findMany({
        where: {
          userId,
          programId: program.id,
          status: "COMPLETED",
          templateId: { not: null },
          performedAt: { gte: weekStartDate, lt: endOfIsoWeek(weekStartDate) },
        },
        select: { templateId: true },
      })
    : [];
  const completedTemplateIds: string[] = Array.from(
    new Set(
      completedSessions
        .map((session: { templateId: string | null }) => session.templateId)
        .filter((templateId: string | null): templateId is string => Boolean(templateId)),
    ),
  );

  const weekly = includeWeeklyPlan
    ? applyWeeklyMissedWorkoutPlan({
        items: generated.items,
        weekStart,
        missedTemplateIds: storedWeeklyPlan.missedTemplateIds,
        completedTemplateIds,
        recipientExcludedTemplateIds: storedWeeklyPlan.recipientExcludedTemplateIds,
      })
    : applyWeeklyMissedWorkoutPlan({
        items: generated.items,
        weekStart,
        missedTemplateIds: [],
        completedTemplateIds: [],
        recipientExcludedTemplateIds: [],
      });

  return {
    program,
    activeMesocycle,
    generated: {
      ...generated,
      items: weekly.items,
      weeklyPlan: weekly.summary,
    },
  };
}

export async function getTemplatePrescription(programId: string, templateId: string, userId: string) {
  const prescription = await buildProgramPrescription(programId, userId);
  if (!prescription) return null;
  return {
    ...prescription,
    templateItems: prescription.generated.items.filter((item) => item.templateId === templateId).sort((a, b) => a.sortOrder - b.sortOrder),
  };
}
