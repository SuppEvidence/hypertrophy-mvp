import type { ProgramType } from "@/lib/types/domain";

const defaultNames: Record<ProgramType, string[]> = {
  FULL_BODY_EOD: ["A", "B", "C"],
  UPPER_LOWER: ["Upper A", "Lower A", "Upper B", "Lower B"],
  PPL: ["Push A", "Pull A", "Legs A", "Push B", "Pull B", "Legs B"],
  BRO_SPLIT: ["Chest", "Back", "Legs", "Shoulders", "Arms"],
  TORSO_LIMBS: ["Torso A", "Limbs A", "Torso B", "Limbs B"],
  CUSTOM: ["Template 1", "Template 2", "Template 3", "Template 4", "Template 5", "Template 6"],
};

export function defaultTemplateName(programType: ProgramType, sequenceIndex: number) {
  return defaultNames[programType]?.[sequenceIndex] ?? `Template ${sequenceIndex + 1}`;
}
