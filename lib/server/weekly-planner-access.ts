import "server-only";
import { prisma } from "@/lib/db/prisma";
import {
  coachedWeek,
  plannerWeekOptions,
} from "@/lib/coaching/weekly-coach-calendar";
import {
  parseWeeklyCoachPlan,
  weeklyOccurrenceFromSummary,
} from "@/lib/coaching/weekly-coach-runtime";

/** Read saved completion evidence only. Opening the planner never requests AI. */
export async function getWeeklyPlannerAccess(
  userId: string,
  programId: string,
  now = new Date(),
) {
  const week = coachedWeek(now);
  const calendar = plannerWeekOptions(now);
  // The normal calendar opening needs no additional completion queries.
  if (calendar.nextAvailable)
    return { ...calendar, currentWeekCompleted: false };
  const record = await prisma.weeklyCoachPlan.findFirst({
    where: {
      userId,
      programId,
      weekStart: week.dbWeekStart,
      status: "APPROVED",
    },
    select: { proposal: true, allocation: true },
  });
  const proposal = record ? parseWeeklyCoachPlan(record.proposal) : null;
  const allocation = proposal
    ? (parseWeeklyCoachPlan(record?.allocation) ?? proposal)
    : null;
  if (
    !proposal ||
    proposal.weekStart !== week.weekStart ||
    !allocation ||
    allocation.weekStart !== week.weekStart
  ) {
    return { ...calendar, currentWeekCompleted: false };
  }
  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      programId,
      status: "COMPLETED",
      performedAt: { gte: week.start, lt: week.end, lte: now },
    },
    select: { prescriptionSummary: true },
  });
  const completed = new Set(
    sessions.flatMap((session) => {
      const id = weeklyOccurrenceFromSummary(session.prescriptionSummary);
      return id ? [id] : [];
    }),
  );
  // Missed workouts are not completed. Keep every occurrence in the approved
  // allocation in the check, including repeat uses of the same template.
  const currentWeekCompleted =
    allocation.workouts.length > 0 &&
    allocation.workouts.every((workout) => completed.has(workout.id));
  return {
    ...plannerWeekOptions(now, currentWeekCompleted),
    currentWeekCompleted,
  };
}
