import type { User } from "@supabase/supabase-js";
import { prisma } from "@/lib/db/prisma";

export async function ensureProfile(user: User) {
  const email = user.email ?? null;

  return prisma.profile.upsert({
    where: { id: user.id },
    update: { email },
    create: {
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
}
