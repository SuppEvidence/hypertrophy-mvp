import type { User } from "@supabase/supabase-js";
import { prisma } from "@/lib/db/prisma";

const globalForProfiles = globalThis as unknown as {
  knownProfileIds?: Set<string>;
};

const knownProfileIds = globalForProfiles.knownProfileIds ?? new Set<string>();
globalForProfiles.knownProfileIds = knownProfileIds;

export async function ensureProfile(user: User) {
  if (knownProfileIds.has(user.id)) return;

  const email = user.email ?? null;
  const existing = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { id: true, email: true },
  });

  if (existing) {
    knownProfileIds.add(user.id);
    if (existing.email !== email) {
      await prisma.profile.update({ where: { id: user.id }, data: { email } });
    }
    return;
  }

  try {
    await prisma.profile.create({
      data: {
        id: user.id,
        email,
        settings: {
          create: {
            preferredUnit: "KG",
            defaultSecondaryContribution: 0.5,
            advancedMuscleMode: false,
            metricVisibility: {
              bodyweight: true,
              waist: true,
              sleep: true,
              stress: true,
              readiness: true,
              fatigue: true,
              soreness: true,
              steps: true,
            },
          },
        },
      },
    });
  } catch (error) {
    const racedProfile = await prisma.profile.findUnique({ where: { id: user.id }, select: { id: true } });
    if (!racedProfile) throw error;
  }

  knownProfileIds.add(user.id);
}
