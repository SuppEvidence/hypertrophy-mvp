export const defaultMuscles = [
  "Chest",
  "Lats",
  "Upper back",
  "Front delts",
  "Side delts",
  "Rear delts",
  "Biceps",
  "Brachialis / brachioradialis",
  "Triceps",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Calves",
  "Abs",
  "Spinal erectors",
] as const;

export const defaultMovementGroups = [
  "Squat pattern",
  "Hip hinge",
  "Hip thrust / glute bridge",
  "Knee extension",
  "Leg curl",
  "Hip abduction",
  "Hip adduction",
  "Straight-leg calf raise",
  "Bent-knee calf raise",
  "Flat press",
  "Incline press",
  "Decline/dip press",
  "Chest fly",
  "Low-to-high chest fly/press",
  "Vertical pull",
  "Horizontal pull",
  "Shoulder extension",
  "Lat pull-around",
  "Upper-back row",
  "Shrug/elevation",
  "Vertical press",
  "Lateral raise",
  "Rear delt fly",
  "Face pull / external rotation row",
  "Supinated curl",
  "Incline / lengthened curl",
  "Preacher / shortened curl",
  "Hammer curl",
  "Reverse curl",
  "Triceps lengthened",
  "Triceps pressdown",
  "Triceps compound press",
  "Spinal flexion",
  "Anti-extension",
  "Anti-rotation",
  "Hip flexion / leg raise",
  "Loaded carry",
] as const;

export const defaultSetTypes = [
  { name: "Normal", multiplier: 1.0, isIntensifier: false, isEditable: false },
  { name: "Lengthened partials", multiplier: 1.2, isIntensifier: true, isEditable: true },
  { name: "Rest-pause", multiplier: 1.3, isIntensifier: true, isEditable: true },
  { name: "Drop set", multiplier: 1.2, isIntensifier: true, isEditable: true },
  { name: "Myo-reps", multiplier: 1.3, isIntensifier: true, isEditable: true },
  { name: "Extended set", multiplier: 1.2, isIntensifier: true, isEditable: true },
] as const;

export type SeedExercise = {
  name: string;
  movementGroup: string;
  primary: string[];
  secondary: string[];
  defaultMinReps: number;
  defaultMaxReps: number;
  tags: string[];
};

export const defaultExercises: SeedExercise[] = [
  {
    name: "Incline DB Press",
    movementGroup: "Incline press",
    primary: ["Chest"],
    secondary: ["Front delts", "Triceps"],
    defaultMinReps: 6,
    defaultMaxReps: 10,
    tags: ["press", "upper-chest-biased"],
  },
  {
    name: "Incline Machine Press",
    movementGroup: "Incline press",
    primary: ["Chest"],
    secondary: ["Front delts", "Triceps"],
    defaultMinReps: 8,
    defaultMaxReps: 12,
    tags: ["press", "stable"],
  },
  {
    name: "DB Chest Press",
    movementGroup: "Flat press",
    primary: ["Chest"],
    secondary: ["Front delts", "Triceps"],
    defaultMinReps: 6,
    defaultMaxReps: 10,
    tags: ["press"],
  },
  {
    name: "Neutral Grip Pulldown",
    movementGroup: "Vertical pull",
    primary: ["Lats"],
    secondary: ["Biceps", "Upper back"],
    defaultMinReps: 8,
    defaultMaxReps: 12,
    tags: ["vertical-pull", "lat"],
  },
  {
    name: "Iliac Lat Pull-Around",
    movementGroup: "Lat pull-around",
    primary: ["Lats"],
    secondary: ["Abs"],
    defaultMinReps: 10,
    defaultMaxReps: 15,
    tags: ["lat", "unilateral"],
  },
  {
    name: "Chest-Supported Row",
    movementGroup: "Horizontal pull",
    primary: ["Upper back"],
    secondary: ["Lats", "Rear delts"],
    defaultMinReps: 8,
    defaultMaxReps: 12,
    tags: ["row", "stable"],
  },
  {
    name: "Cable Lateral Raise",
    movementGroup: "Lateral raise",
    primary: ["Side delts"],
    secondary: [],
    defaultMinReps: 10,
    defaultMaxReps: 20,
    tags: ["delts", "cable"],
  },
  {
    name: "Cable Hammer Curl",
    movementGroup: "Hammer curl",
    primary: ["Brachialis / brachioradialis"],
    secondary: ["Biceps"],
    defaultMinReps: 8,
    defaultMaxReps: 15,
    tags: ["arms", "cable"],
  },
  {
    name: "Overhead Cable Triceps Extension",
    movementGroup: "Triceps lengthened",
    primary: ["Triceps"],
    secondary: [],
    defaultMinReps: 8,
    defaultMaxReps: 15,
    tags: ["arms", "lengthened"],
  },
  {
    name: "Hack Squat",
    movementGroup: "Squat pattern",
    primary: ["Quads"],
    secondary: ["Glutes"],
    defaultMinReps: 6,
    defaultMaxReps: 12,
    tags: ["legs", "stable"],
  },
  {
    name: "V Squat RDL",
    movementGroup: "Hip hinge",
    primary: ["Hamstrings"],
    secondary: ["Glutes", "Spinal erectors"],
    defaultMinReps: 6,
    defaultMaxReps: 10,
    tags: ["hinge", "posterior-chain"],
  },
  {
    name: "Leg Extension",
    movementGroup: "Knee extension",
    primary: ["Quads"],
    secondary: [],
    defaultMinReps: 10,
    defaultMaxReps: 20,
    tags: ["legs", "isolation"],
  },
  {
    name: "Seated Leg Curl",
    movementGroup: "Leg curl",
    primary: ["Hamstrings"],
    secondary: [],
    defaultMinReps: 8,
    defaultMaxReps: 15,
    tags: ["legs", "isolation"],
  },
  {
    name: "Leg Press Calf Raise",
    movementGroup: "Straight-leg calf raise",
    primary: ["Calves"],
    secondary: [],
    defaultMinReps: 8,
    defaultMaxReps: 15,
    tags: ["calves"],
  },
];

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
