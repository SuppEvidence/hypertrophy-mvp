import type { Prisma } from "@prisma/client";

export const exerciseAccessWhere = (userId: string): Prisma.ExerciseWhereInput => ({ OR: [{ userId: null }, { userId }] });
export const exerciseArchivedWhere = (userId: string): Prisma.ExerciseWhereInput => ({ OR: [
  { isArchived: true }, { coachingProfiles: { some: { userId, isArchived: true } } },
] });
export const activeExerciseWhere = (userId: string): Prisma.ExerciseWhereInput => ({
  ...exerciseAccessWhere(userId), isActive: true, isArchived: false,
  coachingProfiles: { none: { userId, isArchived: true } },
});
