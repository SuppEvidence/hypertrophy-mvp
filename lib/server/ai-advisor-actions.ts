"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/user";
import { generateMesocycleRecommendationForUser, getCurrentMesocycleRecommendationForUser } from "@/lib/server/ai-mesocycle-recommendations";

import { analyzeWorkoutAction } from "@/lib/server/ai-workout-analysis";
import {
  generateProgrammingRecommendationsAction,
  selectProgrammingDecisionAction,
} from "@/lib/server/ai-programming-decisions";

function errorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  return (message || fallback).slice(0, 280);
}

export async function analyzeAdvisorWorkoutAction(formData: FormData) {
  try {
    await analyzeWorkoutAction(formData);
    revalidatePath("/ai-analysis/workouts");
  } catch (error) {
    redirect(
      `/ai-analysis/workouts?error=${encodeURIComponent(
        errorMessage(error, "Workout analysis failed."),
      )}`,
    );
  }
}

export async function generateAdvisorVolumeRecommendationsAction() {
  try {
    await generateProgrammingRecommendationsAction();
    revalidatePath("/ai-analysis/volume");
  } catch (error) {
    redirect(
      `/ai-analysis/volume?error=${encodeURIComponent(
        errorMessage(error, "Volume recommendation generation failed."),
      )}`,
    );
  }
  redirect("/ai-analysis/volume");
}

export async function generateAdvisorMesocycleRecommendationAction() {
  try {
    const userId = await requireUserId();
    const current = await getCurrentMesocycleRecommendationForUser(userId);
    if (!current?.checkinStatus?.comparable) {
      throw new Error("Save comparable start and end circumference check-ins near the block boundaries first.");
    }
    if (!current.completedWorkoutsInBlock) {
      throw new Error("No completed workouts were found within this block's dates for the active program.");
    }
    await generateMesocycleRecommendationForUser(userId, current.id);
    revalidatePath("/ai-analysis/mesocycle");
  } catch (error) {
    redirect(`/ai-analysis/mesocycle?error=${encodeURIComponent(errorMessage(error, "Mesocycle review failed."))}`);
  }
  redirect("/ai-analysis/mesocycle");
}

export async function selectAdvisorProgrammingDecisionAction(formData: FormData) {
  try {
    await selectProgrammingDecisionAction(formData);
    revalidatePath("/ai-analysis/volume");
  } catch (error) {
    redirect(
      `/ai-analysis/volume?error=${encodeURIComponent(
        errorMessage(error, "Could not save the programming selection."),
      )}`,
    );
  }
}
