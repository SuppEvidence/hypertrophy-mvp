"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";
import { calculateFatigueSummary } from "@/lib/metrics/fatigue";
import { metricLogSchema } from "@/lib/validations/metrics";

function dateInputToDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function createMetricLog(formData: FormData) {
  const userId = await requireUserId();
  const intent = String(formData.get("intent") ?? "complete");
  const draftId = String(formData.get("draftId") ?? "");
  const input = metricLogSchema.parse({
    loggedAt: formData.get("loggedAt"),
    logType: formData.get("logType") || "DAILY",
    bodyweight: formData.get("bodyweight"),
    waist: formData.get("waist"),
    chest: formData.get("chest"),
    shoulders: formData.get("shoulders"),
    arms: formData.get("arms"),
    thighs: formData.get("thighs"),
    glutes: formData.get("glutes"),
    calves: formData.get("calves"),
    sleepDuration: formData.get("sleepDuration"),
    sleepQuality: formData.get("sleepQuality"),
    stress: formData.get("stress"),
    readiness: formData.get("readiness"),
    manualFatigue: formData.get("manualFatigue"),
    sorenessJointIrritation: formData.get("sorenessJointIrritation"),
    steps: formData.get("steps"),
    notes: formData.get("notes")?.toString() ?? "",
  });

  const data = {
      userId,
      loggedAt: dateInputToDate(input.loggedAt),
      logType: input.logType,
      bodyweight: input.bodyweight,
      waist: input.waist,
      chest: input.chest,
      shoulders: input.shoulders,
      arms: input.arms,
      thighs: input.thighs,
      glutes: input.glutes,
      calves: input.calves,
      sleepDuration: input.sleepDuration,
      sleepQuality: input.sleepQuality,
      stress: input.stress,
      readiness: input.readiness,
      manualFatigue: input.manualFatigue,
      sorenessJointIrritation: input.sorenessJointIrritation,
      steps: input.steps,
      notes: input.notes || null,
      isDraft: intent === "draft",
  };

  const existingDraft = draftId
    ? await prisma.metricLog.findFirst({ where: { id: draftId, userId, isDraft: true } })
    : await prisma.metricLog.findFirst({ where: { userId, isDraft: true }, orderBy: { updatedAt: "desc" } });

  if (existingDraft) {
    await prisma.metricLog.update({ where: { id: existingDraft.id }, data });
  } else {
    await prisma.metricLog.create({ data });
  }

  revalidatePath("/metrics");
  revalidatePath("/dashboard");
  redirect(intent === "draft" ? "/metrics?draft=1" : "/metrics?saved=1");
}

export async function getMetricsPageData() {
  const userId = await requireUserId();
  const [logs, draft] = await Promise.all([
    prisma.metricLog.findMany({ where: { userId, isDraft: false }, orderBy: { loggedAt: "desc" }, take: 10 }),
    prisma.metricLog.findFirst({ where: { userId, isDraft: true }, orderBy: { updatedAt: "desc" } }),
  ]);
  const mapLog = (log: any) => ({
    id: log.id,
    loggedAt: log.loggedAt.toISOString(),
    bodyweight: numberOrNull(log.bodyweight),
    logType: log.logType ?? "DAILY",
    waist: numberOrNull(log.waist),
    chest: numberOrNull(log.chest),
    shoulders: numberOrNull(log.shoulders),
    arms: numberOrNull(log.arms),
    thighs: numberOrNull(log.thighs),
    glutes: numberOrNull(log.glutes),
    calves: numberOrNull(log.calves),
    sleepDuration: numberOrNull(log.sleepDuration),
    sleepQuality: log.sleepQuality,
    stress: log.stress,
    readiness: log.readiness,
    manualFatigue: log.manualFatigue,
    sorenessJointIrritation: log.sorenessJointIrritation,
    steps: log.steps,
    notes: log.notes,
    fatigue: calculateFatigueSummary({
      sleepDuration: numberOrNull(log.sleepDuration),
      sleepQuality: log.sleepQuality,
      stress: log.stress,
      readiness: log.readiness,
      manualFatigue: log.manualFatigue,
      sorenessJointIrritation: log.sorenessJointIrritation,
    }),
  });
  return { logs: logs.map(mapLog), draft: draft ? mapLog(draft) : null };
}

export async function getLatestMetricContext(userId: string) {
  const latest = await prisma.metricLog.findFirst({ where: { userId, isDraft: false }, orderBy: { loggedAt: "desc" } });
  if (!latest) return null;

  const plain = {
    id: latest.id,
    loggedAt: latest.loggedAt.toISOString(),
    bodyweight: numberOrNull(latest.bodyweight),
    logType: latest.logType ?? "DAILY",
    waist: numberOrNull(latest.waist),
    chest: numberOrNull(latest.chest),
    shoulders: numberOrNull(latest.shoulders),
    arms: numberOrNull(latest.arms),
    thighs: numberOrNull(latest.thighs),
    glutes: numberOrNull(latest.glutes),
    calves: numberOrNull(latest.calves),
    sleepDuration: numberOrNull(latest.sleepDuration),
    sleepQuality: latest.sleepQuality,
    stress: latest.stress,
    readiness: latest.readiness,
    manualFatigue: latest.manualFatigue,
    sorenessJointIrritation: latest.sorenessJointIrritation,
    steps: latest.steps,
    notes: latest.notes,
  };

  return { ...plain, fatigue: calculateFatigueSummary(plain) };
}
