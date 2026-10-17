import { z } from "zod";
export const macrosSchema = z.object({
  protein: z.number().min(0).max(500).nullable(),
  carbs: z.number().min(0).max(1500).nullable(),
  fat: z.number().min(0).max(500).nullable(),
});
export const baselineSchema = z
  .object({
    goal: z.string().trim().min(1).max(1200),
    constraints: z.string().max(1500),
    activity: z.string().max(800),
    dailyMacros: macrosSchema,
    meals: z
      .array(
        z.object({
          id: z.string().uuid(),
          name: z.string().trim().min(1).max(80),
          foods: z.string().max(1500),
          macros: macrosSchema,
        }),
      )
      .max(10),
    instructions: z.array(z.string().max(800)).max(20),
  })
  .refine(
    (b) => new Set(b.meals.map((m) => m.id)).size === b.meals.length,
    "Duplicate meals.",
  );
export type Baseline = z.infer<typeof baselineSchema>;
export const emptyBaseline: Baseline = {
  goal: "",
  constraints: "",
  activity: "",
  dailyMacros: { protein: null, carbs: null, fat: null },
  meals: [],
  instructions: [],
};
export const proposalSchema = z.object({
  assessment: z.string().max(2200),
  evidence: z.array(z.string().max(500)).max(6),
  uncertainties: z.array(z.string().max(350)).max(4),
  changes: z
    .array(
      z.object({
        mealId: z.string().uuid().nullable(),
        instruction: z.string().min(1).max(800),
        rationale: z.string().max(500),
        // Null means unquantified, zero means no change. Never infer amounts from photos.
        proteinDelta: z.number().min(-200).max(200).nullable(),
        carbsDelta: z.number().min(-400).max(400).nullable(),
        fatDelta: z.number().min(-150).max(150).nullable(),
      }),
    )
    .max(3),
  phase: z.enum(["CUTTING", "MAINTAINING", "GAINING"]).nullable(),
  phaseReason: z.string().max(1000),
  suggestedPhaseWeeks: z.number().int().min(1).max(52).nullable(),
  reviewAfterDays: z.number().int().min(7).max(84),
  reviewCriteria: z.string().min(1).max(1200),
  trainingHandoff: z.string().max(700),
  questions: z.array(z.string().max(300)).max(3),
});
export type Proposal = z.infer<typeof proposalSchema>;
export const reportSchema = z.object({
  adherence: z.enum(["MOSTLY", "PARTLY", "NOT_YET", "UNKNOWN"]),
  hunger: z.number().int().min(1).max(5).nullable(),
  energy: z.number().int().min(1).max(5).nullable(),
  digestion: z.string().max(500),
  notes: z.string().max(1200),
});
export const draftSchema = z.object({
  reviewedAt: z.string().datetime(),
  evidenceStamp: z.string(),
  proposal: proposalSchema,
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(3000),
      }),
    )
    .max(12),
});
export type Draft = z.infer<typeof draftSchema>;
export const actionSchema = z.object({
  operation: z.enum([
    "SAVE_BASELINE",
    "CHECK_IN",
    "REVIEW",
    "DISCUSS",
    "ACCEPT",
    "DISMISS",
  ]),
  revision: z.number().int().min(0),
  baseline: baselineSchema.optional(),
  report: reportSchema.optional(),
  message: z.string().trim().min(1).max(2000).optional(),
  applyPhase: z.boolean().optional(),
});

/** Increment the current baseline exactly once. Unknown estimates stay unknown. */
export function applyChanges(baseline: Baseline, proposal: Proposal): Baseline {
  const next = structuredClone(baseline);
  for (const change of proposal.changes) {
    const meal = change.mealId
      ? next.meals.find((m) => m.id === change.mealId)
      : null;
    if (change.mealId && !meal)
      throw new Error(
        "Nutrition: proposed meal no longer exists. Review again.",
      );
    for (const key of ["protein", "carbs", "fat"] as const) {
      const delta = change[`${key}Delta`];
      // Daily estimate changes once even when the change belongs to a named meal.
      for (const macros of meal
        ? [meal.macros, next.dailyMacros]
        : [next.dailyMacros]) {
        if (delta === null) macros[key] = null;
        else if (macros[key] !== null)
          macros[key] = Math.round((macros[key]! + delta) * 10) / 10;
      }
      // A daily-wide change has no known meal allocation: invalidate that meal-level estimate.
      if (!meal && delta !== 0)
        for (const m of next.meals) m.macros[key] = null;
    }
    next.instructions.push(
      `${meal ? meal.name : "Across the day"}: ${change.instruction}`,
    );
  }
  if (next.instructions.length > 20)
    throw new Error(
      "Nutrition: consolidate the saved instructions in your baseline before accepting another change.",
    );
  const result = baselineSchema.safeParse(next);
  if (!result.success)
    throw new Error(
      "Nutrition: these changes would produce invalid macro estimates. Revise the proposal.",
    );
  return result.data;
}

/** Discussion needs the current structure, not every saved food description or old instruction. */
export function discussionBaseline(baseline: Baseline, message: string) {
  return {
    goal: baseline.goal,
    constraints: baseline.constraints,
    activity: baseline.activity,
    dailyMacros: baseline.dailyMacros,
    meals: baseline.meals.map((m) => ({
      ...m,
      foods: m.foods.slice(
        0,
        message.toLowerCase().includes(m.name.toLowerCase()) ? 1500 : 240,
      ),
    })),
    alreadyAppliedInstructions: baseline.instructions
      .slice(-6)
      .map((s) => s.slice(0, 240)),
    omittedInstructionCount: Math.max(0, baseline.instructions.length - 6),
    interpretation:
      "Macro estimates already include accepted increments. Food descriptions and older instructions may be abbreviated. Ask for missing details rather than inventing them.",
  };
}
