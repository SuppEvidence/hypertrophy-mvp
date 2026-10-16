import {
  type DesignBrief,
  type DesignReferences,
  type MesocycleDesign,
} from "../lib/mesocycle-design/schema";
export const muscleId = "11111111-1111-4111-8111-111111111111";
export const exerciseId = "22222222-2222-4222-8222-222222222222";
export const setTypeId = "33333333-3333-4333-8333-333333333333";
export const movementId = "44444444-4444-4444-8444-444444444444";
export const brief: DesignBrief = {
  startDate: new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()),
  energyPhase: "USE_CURRENT",
  daysPerWeek: 2,
  minutesPerSession: 60,
  availableWeekdays: [],
  goals: "Improve lateral delts",
  restrictions: "",
  excludedExerciseIds: [],
  priorities: [{ muscleId, priority: "GROW" }],
};
export const refs: DesignReferences = {
  muscles: [
    { id: muscleId, name: "QA delts", slug: "qa-delts", accountingSlug: null },
  ],
  exercises: [
    {
      id: exerciseId,
      name: "QA raise",
      movementGroupId: movementId,
      movementGroupName: "Abduction",
      primaryMuscleIds: [muscleId],
      secondaryMuscles: [],
      preference: "NEUTRAL",
      intensifierPreference: "DEFAULT",
      allowedIntensifierIds: [],
      mechanics: null,
      notes: null,
    },
  ],
  setTypes: [
    {
      id: setTypeId,
      name: "Straight",
      slug: "straight",
      multiplier: 1,
      isIntensifier: false,
    },
  ],
};
export const proposal: MesocycleDesign = {
  version: 1,
  name: "QA six week block",
  summary: "Two sessions with supported starting work.",
  lengthWeeks: 6,
  phase: "PUSH",
  durationReason: "Provisional duration with review; not a phase formula.",
  reviewAfterWeeks: 3,
  successCriteria: ["Stable comparable performance and tolerable joints."],
  adjustmentCriteria: [
    "Reassess if repeated comparable exposures deteriorate.",
  ],
  progression: "Progress reps within the range before load.",
  structureReason: "Distribute work across the week.",
  constraintChecks: [],
  priorities: [{ muscleId, priority: "GROW", rationale: "User confirmed." }],
  spacing: [
    {
      muscleId,
      preferredGapDays: 2,
      reason: "Provisional spacing to review with tolerance.",
    },
  ],
  sessions: [0, 3].map((weekday, i) => ({
    key: `day-${i}`,
    name: `Session ${i + 1}`,
    weekday,
    rationale: "Distribute exposure.",
    items: [
      {
        key: `item-${i}`,
        exerciseId,
        purpose: "Lateral delt work",
        sets: 3,
        minReps: 10,
        maxReps: 15,
        rir: 2,
        restSeconds: 120,
        setTypeId,
        slotRole: "ISOLATION",
        locked: false,
        rationale: "Suitable library exercise.",
      },
    ],
  })),
  libraryGaps: [],
  questions: [],
  limitations: ["History is limited."],
  changes: [],
};
