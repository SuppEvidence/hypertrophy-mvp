
import { loadCompletedWeekSessions } from "@/lib/server/completed-week-evidence";
import "server-only";

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
  const sessions = await loadCompletedWeekSessions(userId,week.start,week.end);
  return approvedWeekDose({ plan: { ...approved.plan, workouts: approved.distribution.workouts }, missedIds: approved.missedIds,
    startedIds: approved.startedIds, completedOccurrenceIds: sessions.flatMap((row) => {
      const id = weeklyOccurrenceFromSummary(row.prescriptionSummary); return id ? [id] : [];
    }), completed: completedWeekBaseline(sessions).sessions, exercises, multipliers });
}
