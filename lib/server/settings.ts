"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/auth/server";
import { ensureProfile } from "@/lib/auth/profile";
import { prisma } from "@/lib/db/prisma";
import { settingsSchema, setTypeMultiplierSchema } from "@/lib/validations/settings";

const defaultMetricVisibility = {
  bodyweight: true,
  waist: true,
  sleep: true,
  stress: true,
  readiness: true,
  fatigue: true,
  soreness: true,
  steps: true,
};

type MetricVisibility = typeof defaultMetricVisibility;

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await ensureProfile(user);
  return user.id;
}

function boolFromForm(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function normalizeMetricVisibility(value: unknown): MetricVisibility {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaultMetricVisibility;
  const source = value as Record<string, unknown>;
  return {
    bodyweight: typeof source.bodyweight === "boolean" ? source.bodyweight : true,
    waist: typeof source.waist === "boolean" ? source.waist : true,
    sleep: typeof source.sleep === "boolean" ? source.sleep : true,
    stress: typeof source.stress === "boolean" ? source.stress : true,
    readiness: typeof source.readiness === "boolean" ? source.readiness : true,
    fatigue: typeof source.fatigue === "boolean" ? source.fatigue : true,
    soreness: typeof source.soreness === "boolean" ? source.soreness : true,
    steps: typeof source.steps === "boolean" ? source.steps : true,
  };
}

function toNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getSettingsPageData() {
  const userId = await requireUserId();

  const [settings, setTypes] = await Promise.all([
    prisma.userSettings.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        preferredUnit: "KG",
        defaultSecondaryContribution: 0.5,
        advancedMuscleMode: false,
        metricVisibility: defaultMetricVisibility,
      },
    }),
    prisma.setType.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return {
    settings: {
      preferredUnit: settings.preferredUnit,
      defaultSecondaryContribution: toNumber(settings.defaultSecondaryContribution, 0.5),
      advancedMuscleMode: settings.advancedMuscleMode,
      metricVisibility: normalizeMetricVisibility(settings.metricVisibility),
    },
    setTypes: setTypes.map((setType) => ({
      id: setType.id,
      name: setType.name,
      slug: setType.slug,
      multiplier: toNumber(setType.multiplier, 1),
      isIntensifier: setType.isIntensifier,
      isEditable: setType.isEditable,
    })),
  };
}

export async function getUserSettingsForMetrics() {
  const userId = await requireUserId();
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  return normalizeMetricVisibility(settings?.metricVisibility);
}

export async function updateUserSettings(formData: FormData) {
  const userId = await requireUserId();
  const parsed = settingsSchema.parse({
    preferredUnit: formData.get("preferredUnit"),
    defaultSecondaryContribution: formData.get("defaultSecondaryContribution"),
    advancedMuscleMode: boolFromForm(formData, "advancedMuscleMode"),
    metricVisibility: {
      bodyweight: boolFromForm(formData, "metric_bodyweight"),
      waist: boolFromForm(formData, "metric_waist"),
      sleep: boolFromForm(formData, "metric_sleep"),
      stress: boolFromForm(formData, "metric_stress"),
      readiness: boolFromForm(formData, "metric_readiness"),
      fatigue: boolFromForm(formData, "metric_fatigue"),
      soreness: boolFromForm(formData, "metric_soreness"),
      steps: boolFromForm(formData, "metric_steps"),
    },
  });

  await prisma.userSettings.upsert({
    where: { userId },
    update: {
      preferredUnit: parsed.preferredUnit,
      defaultSecondaryContribution: parsed.defaultSecondaryContribution,
      advancedMuscleMode: parsed.advancedMuscleMode,
      metricVisibility: parsed.metricVisibility,
    },
    create: {
      userId,
      preferredUnit: parsed.preferredUnit,
      defaultSecondaryContribution: parsed.defaultSecondaryContribution,
      advancedMuscleMode: parsed.advancedMuscleMode,
      metricVisibility: parsed.metricVisibility,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/metrics");
  redirect("/settings?saved=1");
}

export async function updateSetTypeMultiplier(formData: FormData) {
  await requireUserId();
  const parsed = setTypeMultiplierSchema.parse({
    setTypeId: formData.get("setTypeId"),
    multiplier: formData.get("multiplier"),
  });

  const setType = await prisma.setType.findUnique({ where: { id: parsed.setTypeId } });
  if (!setType || !setType.isEditable) redirect("/settings?error=set-type-locked");

  await prisma.setType.update({
    where: { id: parsed.setTypeId },
    data: { multiplier: Number(parsed.multiplier) },
  });

  revalidatePath("/settings");
  revalidatePath("/templates");
  revalidatePath("/log");
  revalidatePath("/dashboard");
  redirect("/settings?saved=1");
}
