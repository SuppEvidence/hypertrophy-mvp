export type PreferredUnit = "KG" | "LB";

export type ProgramType =
  | "FULL_BODY_EOD"
  | "UPPER_LOWER"
  | "PPL"
  | "BRO_SPLIT"
  | "TORSO_LIMBS"
  | "CUSTOM";

export type RotationStyle = "FIXED_SEQUENCE" | "WEEKDAY_BASED" | "MANUAL";

export type VolumeWindowType = "WEEKLY" | "ROLLING_10D" | "ROLLING_14D" | "CUSTOM";

export type ProgramPhase = "PUSH" | "HOLD" | "DELOAD" | "MAINTENANCE" | "OTHER";

export type WorkoutSessionStatus = "DRAFT" | "COMPLETED";

export type ReferenceMuscle = {
  id: string;
  name: string;
  slug?: string;
  sortOrder?: number;
};

export type ReferenceMovementGroup = {
  id: string;
  name: string;
  slug?: string;
  sortOrder?: number;
};

export type ProgramFormProgram = {
  id: string;
  name: string;
  programType: ProgramType;
  templateCount: number;
  rotationStyle: RotationStyle;
  volumeWindowType: VolumeWindowType;
  customWindowDays: number | null;
  secondaryContribution: unknown;
  activePhase: ProgramPhase;
  advancedMuscleMode: boolean;
  priorityMuscles: Array<{ muscleId: string; muscle: ReferenceMuscle }>;
  volumeTargets: Array<{ muscleId: string; weeklyTargetSets: unknown; muscle: ReferenceMuscle }>;
};

export type ExerciseFormExercise = {
  id: string;
  name: string;
  movementGroupId: string;
  tags: string[];
  setupNotes: string | null;
  isSeed: boolean;
  isActive: boolean;
  isArchived: boolean;
  primaryMuscles: Array<{ muscleId: string; muscle: ReferenceMuscle }>;
  secondaryMuscles: Array<{ muscleId: string; muscle: ReferenceMuscle }>;
};
