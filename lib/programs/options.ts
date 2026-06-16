import type { ProgramPhase, ProgramType, RotationStyle, VolumeWindowType } from "@prisma/client";

export const programTypeOptions: Array<{ value: ProgramType; label: string }> = [
  { value: "FULL_BODY_EOD", label: "Full Body EOD" },
  { value: "UPPER_LOWER", label: "Upper/Lower" },
  { value: "PPL", label: "PPL" },
  { value: "BRO_SPLIT", label: "Bro Split" },
  { value: "TORSO_LIMBS", label: "Torso/Limbs" },
  { value: "CUSTOM", label: "Custom" },
];

export const rotationStyleOptions: Array<{ value: RotationStyle; label: string }> = [
  { value: "FIXED_SEQUENCE", label: "Fixed sequence" },
  { value: "WEEKDAY_BASED", label: "Weekday-based" },
  { value: "MANUAL", label: "Manual" },
];

export const volumeWindowOptions: Array<{ value: VolumeWindowType; label: string }> = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "ROLLING_10D", label: "Rolling 10d" },
  { value: "ROLLING_14D", label: "Rolling 14d" },
  { value: "CUSTOM", label: "Custom" },
];

export const phaseOptions: Array<{ value: ProgramPhase; label: string }> = [
  { value: "PUSH", label: "Push" },
  { value: "HOLD", label: "Hold" },
  { value: "DELOAD", label: "Deload" },
  { value: "MAINTENANCE", label: "Maintenance / Other" },
  { value: "OTHER", label: "Other" },
];

export const programTypeLabels = Object.fromEntries(programTypeOptions.map((item) => [item.value, item.label])) as Record<ProgramType, string>;
export const rotationStyleLabels = Object.fromEntries(rotationStyleOptions.map((item) => [item.value, item.label])) as Record<RotationStyle, string>;
export const volumeWindowLabels = Object.fromEntries(volumeWindowOptions.map((item) => [item.value, item.label])) as Record<VolumeWindowType, string>;
export const phaseLabels = Object.fromEntries(phaseOptions.map((item) => [item.value, item.label])) as Record<ProgramPhase, string>;

export function defaultProgramValues(programType: ProgramType) {
  switch (programType) {
    case "FULL_BODY_EOD":
      return {
        name: "Full Body EOD",
        templateCount: 3,
        rotationStyle: "FIXED_SEQUENCE" as RotationStyle,
        volumeWindowType: "ROLLING_14D" as VolumeWindowType,
        customWindowDays: null,
        secondaryContribution: 0.25,
        priorityMuscles: ["Lats", "Upper chest", "Side delts"],
      };
    case "UPPER_LOWER":
      return {
        name: "Upper/Lower",
        templateCount: 4,
        rotationStyle: "FIXED_SEQUENCE" as RotationStyle,
        volumeWindowType: "WEEKLY" as VolumeWindowType,
        customWindowDays: null,
        secondaryContribution: 0.5,
        priorityMuscles: ["Quads", "Lats", "Side delts"],
      };
    case "PPL":
      return {
        name: "PPL",
        templateCount: 6,
        rotationStyle: "FIXED_SEQUENCE" as RotationStyle,
        volumeWindowType: "WEEKLY" as VolumeWindowType,
        customWindowDays: null,
        secondaryContribution: 0.5,
        priorityMuscles: ["Chest", "Lats", "Hamstrings"],
      };
    case "BRO_SPLIT":
      return {
        name: "Bro Split",
        templateCount: 5,
        rotationStyle: "WEEKDAY_BASED" as RotationStyle,
        volumeWindowType: "WEEKLY" as VolumeWindowType,
        customWindowDays: null,
        secondaryContribution: 0.25,
        priorityMuscles: ["Chest", "Upper back", "Biceps", "Triceps"],
      };
    case "TORSO_LIMBS":
      return {
        name: "Torso/Limbs",
        templateCount: 4,
        rotationStyle: "FIXED_SEQUENCE" as RotationStyle,
        volumeWindowType: "WEEKLY" as VolumeWindowType,
        customWindowDays: null,
        secondaryContribution: 0.5,
        priorityMuscles: ["Upper chest", "Lats", "Side delts"],
      };
    case "CUSTOM":
    default:
      return {
        name: "Custom Program",
        templateCount: 4,
        rotationStyle: "MANUAL" as RotationStyle,
        volumeWindowType: "ROLLING_10D" as VolumeWindowType,
        customWindowDays: null,
        secondaryContribution: 0.5,
        priorityMuscles: [],
      };
  }
}

export function volumeWindowDays(type: VolumeWindowType, customWindowDays?: number | null) {
  if (type === "WEEKLY") return 7;
  if (type === "ROLLING_10D") return 10;
  if (type === "ROLLING_14D") return 14;
  return customWindowDays && customWindowDays > 0 ? customWindowDays : 7;
}
