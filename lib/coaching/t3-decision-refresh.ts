import { z } from "zod";
import {
  ProgrammingOptionSchema,
  type ProgrammingOption,
} from "../ai/programming-decision-schema";
import { generateMesocyclePrescriptionWithQuickOverrides as generate } from "../planning/mesocycleQuickOverrides";
import {
  previewT3Prescription,
  t3PreviewEffectsSignature,
  type T3PlanPreview,
  type T3PrescriptionInput,
} from "./t3-prescription-preview";

// Fractions are deterministic remaining doses, never new model proposals.
const AppliedOptionSchema = ProgrammingOptionSchema.extend({
  deltaWeeklySets: z.number().min(-6).max(4),
  movementChanges: z
    .array(
      ProgrammingOptionSchema.shape.movementChanges.element.extend({
        deltaSets: z.number().min(-6).max(4),
      }),
    )
    .max(3),
});
export function readAppliedOption(outcome: unknown): ProgrammingOption | null {
  if (!outcome || typeof outcome !== "object" || !("appliedOption" in outcome))
    return null;
  const parsed = AppliedOptionSchema.safeParse(outcome.appliedOption);
  return parsed.success ? parsed.data : null;
}
export type RefreshedT3Option = {
  status: "READY" | "SATISFIED" | "BLOCKED";
  option: ProgrammingOption;
  preview: T3PlanPreview | null;
  note: string | null;
  coveredDose?: number;
};

/** Keep the original reviewed goal, accounting for already accepted compound overlap. */
export function refreshT3Option(
  input: T3PrescriptionInput,
  muscleId: string,
  option: ProgrammingOption,
  reviewed: Omit<T3PlanPreview, "structureOverrides">,
  confidence: string,
  status: string,
  preserveMovementIntent = false,
): RefreshedT3Option {
  try {
    const current = generate(input),
      weekly = 7 / input.program.volumeWindowDays;
    const goal = reviewed.muscles.find((row) => row.muscleId === muscleId);
    let adjusted = option;
    if (
      option.action !== "REALLOCATE_VOLUME" &&
      !preserveMovementIntent &&
      goal &&
      Math.abs(goal.after - goal.before) > 0.05
    ) {
      const dose =
        (current.volumeRows.find((row) => row.muscleId === muscleId)?.planned ??
          0) * weekly;
      const remaining = goal.after - dose,
        direction = Math.sign(goal.after - goal.before);
      if (remaining * direction <= 0.05)
        return {
          status: "SATISFIED",
          coveredDose: dose,
          option,
          preview: null,
          note: "The accepted changes already reach this option’s reviewed muscle dose. No additional change is needed. Accept the current dose to close this card.",
        };
      const fraction = Math.min(
        1,
        Math.abs(remaining / (goal.after - goal.before)),
      );
      adjusted = {
        ...option,
        title:
          fraction < 0.999
            ? option.action === "DECREASE_VOLUME"
              ? "Reduce remaining dose"
              : "Add remaining dose"
            : option.title,
        deltaWeeklySets: option.deltaWeeklySets * fraction,
        movementChanges: option.movementChanges.map((change) => ({
          ...change,
          deltaSets: change.deltaSets * fraction,
        })),
      };
    } else if (
      option.action === "REALLOCATE_VOLUME" ||
      preserveMovementIntent
    ) {
      adjusted = {
        ...option,
        movementChanges: option.movementChanges.flatMap((change) => {
          const target = reviewed.movementTargets.find(
            (row) => row.movementGroupId === change.movementPatternId,
          )?.targetSets;
          if (target === undefined)
            throw new Error("This older movement option needs a new review.");
          const actual =
            (current.movementVolumeRows.find(
              (row) => row.movementGroupId === change.movementPatternId,
            )?.planned ?? 0) * weekly;
          const remaining = target - actual;
          if (remaining * Math.sign(change.deltaSets) <= 0.05) return [];
          return [
            {
              ...change,
              deltaSets:
                Math.sign(change.deltaSets) *
                Math.min(Math.abs(change.deltaSets), Math.abs(remaining)),
            },
          ];
        }),
      };
      if (!adjusted.movementChanges.length)
        return {
          status: "SATISFIED",
          coveredDose:
            (current.volumeRows.find((row) => row.muscleId === muscleId)
              ?.planned ?? 0) * weekly,
          option,
          preview: null,
          note: "The accepted changes already reach this option’s reviewed movement allocation. Accept the current dose to close this card.",
        };
    }
    if (preserveMovementIntent) {
      const originalWork = option.movementChanges.reduce(
        (sum, row) => sum + Math.abs(row.deltaSets),
        0,
      );
      const remainingWork = adjusted.movementChanges.reduce(
        (sum, row) => sum + Math.abs(row.deltaSets),
        0,
      );
      adjusted = {
        ...adjusted,
        deltaWeeklySets: originalWork
          ? option.deltaWeeklySets * Math.min(1, remainingWork / originalWork)
          : option.deltaWeeklySets,
      };
    }
    const preview = previewT3Prescription(
      input,
      muscleId,
      adjusted,
      confidence,
      status,
      reviewed.slots,
    );
    const effect = preview.muscles.find((row) => row.muscleId === muscleId);
    if (
      goal &&
      effect &&
      option.action !== "REALLOCATE_VOLUME" &&
      !preserveMovementIntent &&
      (effect.after - goal.after) * Math.sign(goal.after - goal.before) > 0.1
    ) {
      throw new Error(
        "The remaining dose is smaller than the available set increment. Keep the current dose or request a new review for a different approach.",
      );
    }
    return {
      status: "READY",
      option: adjusted,
      preview,
      note:
        t3PreviewEffectsSignature(preview) !==
        t3PreviewEffectsSignature(reviewed)
          ? preserveMovementIntent
            ? "Updated from your accepted changes. The remaining reduction still addresses the originally reviewed painful movement; check its revised muscle effects before approving."
            : "Updated from your accepted changes. This shows only the remaining change toward the original reviewed dose; check the revised effects before approving."
          : null,
    };
  } catch (error) {
    return {
      status: "BLOCKED",
      option,
      preview: null,
      note:
        error instanceof Error
          ? error.message
          : "This option cannot currently be implemented.",
    };
  }
}
