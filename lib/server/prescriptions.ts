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
    where: { programId, userId, isArchived: false, actualEndDate: null, startDate: { lte: now } },
    orderBy: { startDate: "desc" },
    take: 12,
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
  const includeWeeklyPlan = options?.includeWeeklyPlan !== false;
  const weekStartDate = startOfIsoWeek();
  const weekStart = toDateOnly(weekStartDate);

  const [program, activeMesocycle, completedSessions, setTypes, movementDefaults] = await Promise.all([
    prisma.program.findFirst({
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
    }),
    getMesocycleForPrescription(programId, userId, options?.mesocycleId),
    includeWeeklyPlan
      ? prisma.workoutSession.findMany({
          where: {
            userId,
            programId,
            status: "COMPLETED",
            performedAt: { gte: weekStartDate, lt: endOfIsoWeek(weekStartDate) },
          },
          select: {
            templateId: true,
            exercises: {
              select: {
                templateExercise: { select: { movementGroupId: true } },
                exercise: { select: { movementGroupId: true } },
                sets: {
                  where: { isCompleted: true },
                  select: { setType: { select: { multiplier: true } } },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    prisma.setType.findMany({
      where: { isActive: true, OR: [{ userId: null }, { userId }] },
      orderBy: [{ userId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, multiplier: true, isIntensifier: true, sortOrder: true },
    }),
    prisma.exercise.findMany({
      where: { isArchived: false, isActive: true, OR: [{ isSeed: true, userId: null }, { userId }] },
      orderBy: [{ isSeed: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        movementGroupId: true,
        defaultMinReps: true,
        defaultMaxReps: true,
        movementGroup: { select: { id: true, name: true, sortOrder: true } },
        primaryMuscles: { select: { muscleId: true, muscle: { select: { name: true, sortOrder: true } } } },
        secondaryMuscles: { select: { muscleId: true, muscle: { select: { name: true, sortOrder: true } } } },
      },
    }),
  ]);

  if (!program) return null;
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
      defaultSetTypeIsIntensifier: item.defaultSetType.isIntensifier,
      setPlans: item.setPlans.map((plan) => ({
        setNumber: plan.setNumber,
        setTypeId: plan.setTypeId,
        multiplier: plan.setType.multiplier,
        isIntensifier: plan.setType.isIntensifier,
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
          movementVolumeTargets: activeMesocycle.movementVolumeTargets.map((target) => ({
            movementGroupId: target.movementGroupId,
            movementGroupName: target.movementGroup.name,
            sortOrder: target.movementGroup.sortOrder,
            targetSets: target.targetSets,
          })),
          structureOverrides: activeMesocycle.structureOverrides,
        }
      : null,
    templateExercises,
    templates: program.templates.map((template) => ({
      id: template.id,
      name: template.name,
      sequenceIndex: template.sequenceIndex,
      expectedOccurrences: template.expectedOccurrences,
    })),
    setTypes: setTypes.map((setType) => ({
      id: setType.id,
      name: setType.name,
      slug: setType.slug,
      multiplier: setType.multiplier,
      isIntensifier: setType.isIntensifier,
      sortOrder: setType.sortOrder,
    })),
    movementDefaults: movementDefaults.map((exercise) => ({
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      movementGroupId: exercise.movementGroupId,
      movementGroupName: exercise.movementGroup.name,
      movementGroupSortOrder: exercise.movementGroup.sortOrder,
      defaultMinReps: exercise.defaultMinReps,
      defaultMaxReps: exercise.defaultMaxReps,
      primaryMuscles: exercise.primaryMuscles.map((link) => ({
        muscleId: link.muscleId,
        muscleName: link.muscle.name,
        sortOrder: link.muscle.sortOrder,
      })),
      secondaryMuscles: exercise.secondaryMuscles.map((link) => ({
        muscleId: link.muscleId,
        muscleName: link.muscle.name,
        sortOrder: link.muscle.sortOrder,
      })),
    })),
  });

  const storedWeeklyPlan = parseStoredWeeklyPlan(program.weeklyPlan, weekStart);
  const completedTemplateIds: string[] = Array.from(
    new Set(
      completedSessions
        .map((session) => session.templateId)
        .filter((templateId): templateId is string => Boolean(templateId)),
    ),
  );

  const completedMovementVolume = new Map<string, { physicalSets: number; effectiveSets: number }>();
  for (const session of completedSessions) {
    for (const sessionExercise of session.exercises) {
      const movementGroupId = sessionExercise.templateExercise?.movementGroupId ?? sessionExercise.exercise.movementGroupId;
      const current = completedMovementVolume.get(movementGroupId) ?? { physicalSets: 0, effectiveSets: 0 };
      for (const set of sessionExercise.sets) {
        current.physicalSets += 1;
        current.effectiveSets += Math.max(0, Number(set.setType.multiplier));
      }
      completedMovementVolume.set(movementGroupId, current);
    }
  }

  const completedMovementRows = Array.from(completedMovementVolume.entries()).map(([movementGroupId, volume]) => ({
    movementGroupId,
    physicalSets: volume.physicalSets,
    effectiveSets: Math.round(volume.effectiveSets * 100) / 100,
  }));

  const weeklySetTypes = setTypes.map((setType) => ({
    id: setType.id,
    multiplier: setType.multiplier,
    isIntensifier: setType.isIntensifier,
  }));

  const weekly = includeWeeklyPlan
    ? applyWeeklyMissedWorkoutPlan({
        items: generated.items,
        templates: program.templates.map((template) => ({ id: template.id, name: template.name, sequenceIndex: template.sequenceIndex })),
        setTypes: weeklySetTypes,
        completedMovementVolume: completedMovementRows,
        weekStart,
        missedTemplateIds: storedWeeklyPlan.missedTemplateIds,
        completedTemplateIds,
        recipientExcludedTemplateIds: storedWeeklyPlan.recipientExcludedTemplateIds,
      })
    : applyWeeklyMissedWorkoutPlan({
        items: generated.items,
        templates: program.templates.map((template) => ({ id: template.id, name: template.name, sequenceIndex: template.sequenceIndex })),
        setTypes: weeklySetTypes,
        completedMovementVolume: [],
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
    templateItems: prescription.generated.items
      .filter(
        (item) =>
          item.templateId === templateId &&
          !item.isMesocycleSuppressed &&
          (item.adjustedPlannedSets > 0 || item.weeklyAdjustedPlannedSets > 0),
      )
      .sort((a, b) => a.sortOrder - b.sortOrder),
  };
}
