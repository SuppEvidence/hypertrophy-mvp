import "server-only";
import { prisma } from "@/lib/db/prisma";
import { readApprovedWeek } from "@/lib/server/weekly-coach-read";
import { coachedWeek } from "@/lib/coaching/weekly-coach-calendar";
import { completedWeekBaseline } from "@/lib/coaching/weekly-coach-baseline";
import { approvedWeekDose } from "@/lib/coaching/weekly-coach-dose";
import { weeklyOccurrenceFromSummary } from "@/lib/coaching/weekly-coach-runtime";

export async function getApprovedWeekDoseContext(userId: string, programId: string, mesocycleId: string,
  exercises: Parameters<typeof approvedWeekDose>[0]["exercises"], multipliers: Record<string, number>) {
  const approved = await readApprovedWeek(userId, programId);
  if (!approved || approved.record?.mesocycleId !== mesocycleId) return null;
  const week = coachedWeek();
  const sessions = await prisma.workoutSession.findMany({ where: { userId, programId, status: "COMPLETED", performedAt: { gte: week.start, lt: week.end } },
    select: { id: true, performedAt: true, templateId: true, prescriptionSummary: true, exercises: { select: { id: true, exerciseId: true, painFlag: true,
      exercise: { select: { movementGroupId: true, primaryMuscles: { select: { muscleId: true } }, secondaryMuscles: { select: { muscleId: true, contributionEstimate: true } } } },
      sets: { select: { id: true, isCompleted: true, setTypeId: true, weight: true, reps: true, rir: true, painFlag: true, setType: { select: { multiplier: true } } } } } } } });
  return approvedWeekDose({ plan: { ...approved.plan, workouts: approved.distribution.workouts }, missedIds: approved.missedIds,
    startedIds: approved.startedIds, completedOccurrenceIds: sessions.flatMap((row) => {
      const id = weeklyOccurrenceFromSummary(row.prescriptionSummary); return id ? [id] : [];
    }), completed: completedWeekBaseline(sessions).sessions, exercises, multipliers });
}
