import "server-only";
import { prisma } from "@/lib/db/prisma";
import { parseWeeklyCoachPlan, parseMissedOccurrenceIds, weeklyOccurrenceFromSummary } from "@/lib/coaching/weekly-coach-runtime";
import { coachedWeek } from "@/lib/coaching/weekly-coach-calendar";

export async function readApprovedWeek(userId: string, programId: string) {
  const week = coachedWeek();
  const record = await prisma.weeklyCoachPlan.findUnique({ where: { programId_weekStart: { programId, weekStart: week.dbWeekStart } } });
  const plan = record?.status === "APPROVED" && record.userId === userId ? parseWeeklyCoachPlan(record.proposal) : null;
  if (!plan) return null;
  const sessions = await prisma.workoutSession.findMany({ where: { userId, programId, performedAt: { gte: week.start, lt: week.end } },
      select: { prescriptionSummary: true } });
  const startedIds = sessions.map((session) => weeklyOccurrenceFromSummary(session.prescriptionSummary)).filter((id): id is string => Boolean(id));
  const missedIds = parseMissedOccurrenceIds(record?.missedIds);
  const allocation = parseWeeklyCoachPlan(record?.allocation) ?? plan;
  const distribution = { workouts: allocation.workouts, unallocatedSets: record?.unallocated ?? 0 };
  return { record, plan, missedIds, startedIds, distribution };
}

export async function readApprovedOccurrence(userId: string, programId: string, occurrenceId: string) {
  const week = await readApprovedWeek(userId, programId);
  if (!week || week.missedIds.includes(occurrenceId) || week.startedIds.includes(occurrenceId)) return null;
  const occurrence = week.distribution.workouts.find((item) => item.id === occurrenceId);
  return occurrence ? { occurrence, plan: week.plan, mesocycleId: week.record!.mesocycleId, weekStart: week.plan.weekStart } : null;
}
