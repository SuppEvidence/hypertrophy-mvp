"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";
import { interpretEnergyPhase } from "@/lib/coaching/energy-phase";

const inputSchema = z.object({
  phase: z.enum(["CUTTING", "MAINTAINING", "GAINING"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function saveEnergyPhase(formData: FormData) {
  const userId = await requireUserId();
  const input = inputSchema.parse({ phase: formData.get("phase"), startDate: formData.get("startDate") });
  const date = new Date(`${input.startDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input.startDate) throw new Error("Invalid phase start date.");
  await prisma.energyPhase.upsert({
    where: { userId_startDate: { userId, startDate: date } },
    create: { userId, phase: input.phase, startDate: date },
    update: { phase: input.phase },
  });
  revalidatePath("/metrics");
  revalidatePath("/dashboard");
  revalidatePath("/ai-analysis");
  redirect("/metrics?phaseSaved=1");
}

export async function deleteEnergyPhase(formData: FormData) {
  const userId = await requireUserId();
  const id = z.string().uuid().parse(formData.get("id"));
  await prisma.energyPhase.deleteMany({ where: { id, userId } });
  revalidatePath("/metrics");
  revalidatePath("/dashboard");
  revalidatePath("/ai-analysis");
  redirect("/metrics?phaseSaved=1");
}

export async function getEnergyPhaseContext(userId: string, at = new Date()) {
  const entries = await prisma.energyPhase.findMany({
    where: { userId, startDate: { lte: at } }, orderBy: { startDate: "desc" }, take: 24,
    select: { phase: true, startDate: true },
  });
  return interpretEnergyPhase(entries, at);
}

export async function getEnergyPhaseTimeline(userId: string, at = new Date()) {
  const entries = await prisma.energyPhase.findMany({
    where: { userId, startDate: { lte: at } }, orderBy: { startDate: "desc" }, take: 24,
    select: { phase: true, startDate: true },
  });
  const chronological = entries.reverse();
  return chronological.map((entry, index) => ({
    phase: entry.phase,
    startDate: entry.startDate.toISOString().slice(0, 10),
    endDateExclusive: chronological[index + 1]?.startDate.toISOString().slice(0, 10) ?? null,
  }));
}
