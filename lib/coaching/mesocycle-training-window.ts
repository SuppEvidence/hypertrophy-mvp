/** A block includes all completed workouts for its program on its calendar dates,
 * including sessions created before the app began attaching mesocycle IDs. */
export function mesocycleCompletedWorkoutWhere(args: {
  userId: string;
  programId: string;
  startDate: Date;
  endDate: Date;
}) {
  const start = args.startDate.toISOString().slice(0, 10);
  const end = Date.parse(`${args.endDate.toISOString().slice(0, 10)}T00:00:00Z`);
  return {
    userId: args.userId,
    programId: args.programId,
    status: "COMPLETED" as const,
    performedAt: { gte: new Date(`${start}T00:00:00Z`), lt: new Date(end + 86_400_000) },
  };
}
