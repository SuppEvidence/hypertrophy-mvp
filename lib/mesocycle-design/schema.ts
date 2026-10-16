import { z } from "zod";
const text = z.string().max(1600);
export const prioritySchema = z.enum([
  "SPECIALIZE",
  "GROW",
  "MAINTAIN",
  "INDIRECT_ONLY",
]);
export const briefSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (s) =>
        !Number.isNaN(Date.parse(s)) &&
        new Date(s).toISOString().slice(0, 10) === s,
      "Invalid start date",
    ),
  energyPhase: z.enum(["USE_CURRENT", "CUTTING", "MAINTAINING", "GAINING"]),
  daysPerWeek: z.number().int().min(1).max(7),
  minutesPerSession: z.number().int().min(20).max(120),
  availableWeekdays: z.array(z.number().int().min(0).max(6)).max(7),
  goals: text,
  restrictions: text,
  excludedExerciseIds: z.array(z.string().uuid()).max(500),
  priorities: z
    .array(z.object({ muscleId: z.string().uuid(), priority: prioritySchema }))
    .max(100),
});
export type DesignBrief = z.infer<typeof briefSchema>;
export const designItemSchema = z.object({
  key: z.string().min(1).max(60),
  exerciseId: z.string().uuid().nullable(),
  purpose: z.string().min(1).max(350),
  sets: z.number().int().min(1).max(12),
  minReps: z.number().int().min(1).max(50),
  maxReps: z.number().int().min(1).max(50),
  rir: z.number().min(0).max(5),
  restSeconds: z.number().int().min(30).max(360),
  setTypeId: z.string().uuid().nullable(),
  slotRole: z.enum(["PRIMARY_COMPOUND", "SECONDARY_COMPOUND", "ISOLATION"]),
  locked: z.boolean(),
  rationale: z.string().max(600),
});
export const designSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(100),
  summary: text,
  lengthWeeks: z.number().int().min(2).max(16),
  phase: z.enum(["PUSH", "HOLD", "DELOAD"]),
  durationReason: text,
  reviewAfterWeeks: z.number().int().min(1).max(16),
  successCriteria: z.array(z.string().min(1).max(350)).min(1).max(6),
  adjustmentCriteria: z.array(z.string().min(1).max(350)).min(1).max(6),
  progression: text,
  structureReason: text,
  constraintChecks: z
    .array(
      z.object({
        constraint: z.string().max(250),
        handling: z.string().max(500),
        status: z.enum(["MET", "TRADEOFF", "UNRESOLVED"]),
      }),
    )
    .max(16),
  priorities: z
    .array(
      z.object({
        muscleId: z.string().uuid(),
        priority: prioritySchema,
        rationale: z.string().max(500),
      }),
    )
    .max(100),
  spacing: z
    .array(
      z.object({
        muscleId: z.string().uuid(),
        preferredGapDays: z.number().int().min(1).max(7),
        reason: z.string().max(500),
      }),
    )
    .max(50),
  sessions: z
    .array(
      z.object({
        key: z.string().min(1).max(60),
        name: z.string().min(1).max(100),
        weekday: z.number().int().min(0).max(6),
        rationale: z.string().max(600),
        items: z.array(designItemSchema).max(12),
      }),
    )
    .min(1)
    .max(7),
  libraryGaps: z
    .array(
      z.object({
        muscleId: z.string().uuid(),
        kind: z.enum([
          "MISSING_EXERCISE",
          "ASSESSMENT_NEEDED",
          "CONSTRAINT_CONFLICT",
        ]),
        reason: z.string().max(600),
        candidates: z
          .array(
            z.object({
              name: z.string().max(120),
              equipment: z.string().max(200),
            }),
          )
          .max(4),
      }),
    )
    .max(12),
  questions: z.array(z.string().max(300)).max(4),
  limitations: z.array(z.string().max(500)).max(8),
  changes: z.array(z.string().max(300)).max(12),
});
export type MesocycleDesign = z.infer<typeof designSchema>;
export type DesignExercise = {
  id: string;
  name: string;
  movementGroupId: string;
  movementGroupName: string;
  primaryMuscleIds: string[];
  secondaryMuscles: Array<{ muscleId: string; fraction: number }>;
  preference: string;
  intensifierPreference: string;
  allowedIntensifierIds: string[];
  mechanics: unknown;
  notes: string | null;
};
export type DesignSetType = {
  id: string;
  name: string;
  slug: string;
  multiplier: number;
  isIntensifier: boolean;
};
export type DesignMuscle = {
  id: string;
  name: string;
  accountingSlug: string | null;
  slug: string;
};
export type DesignReferences = {
  exercises: DesignExercise[];
  setTypes: DesignSetType[];
  muscles: DesignMuscle[];
};
/** Restrict model-generated references to the same catalogue used by deterministic approval. */
export function designSchemaForCatalogue(refs: DesignReferences) {
  const groups = refs.muscles
    .filter((m) => !m.accountingSlug && m.slug !== "chest")
    .map((m) => m.id);
  if (!groups.length)
    throw new Error("Design needs a populated shared muscle catalogue.");
  const muscle = z.enum(groups as [string, ...string[]]);
  const allMuscles = z.enum(
    refs.muscles.map((m) => m.id) as [string, ...string[]],
  );
  const exercise = refs.exercises.length
    ? z
        .enum(refs.exercises.map((e) => e.id) as [string, ...string[]])
        .nullable()
    : z.null();
  const setType = refs.setTypes.length
    ? z.enum(refs.setTypes.map((t) => t.id) as [string, ...string[]]).nullable()
    : z.null();
  return designSchema.extend({
    priorities: z
      .array(designSchema.shape.priorities.element.extend({ muscleId: muscle }))
      .max(100),
    spacing: z
      .array(designSchema.shape.spacing.element.extend({ muscleId: muscle }))
      .max(50),
    libraryGaps: z
      .array(
        designSchema.shape.libraryGaps.element.extend({ muscleId: allMuscles }),
      )
      .max(12),
    sessions: z
      .array(
        designSchema.shape.sessions.element.extend({
          items: z
            .array(
              designItemSchema.extend({
                exerciseId: exercise,
                setTypeId: setType,
              }),
            )
            .max(12),
        }),
      )
      .min(1)
      .max(7),
  });
}
