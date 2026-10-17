import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyChanges,
  baselineSchema,
  proposalSchema,
  type Baseline,
} from "../lib/nutrition/schema";
const mealId = "11111111-1111-4111-8111-111111111111";
const baseline: Baseline = {
  goal: "Gain with a sustainable meal structure",
  constraints: "",
  activity: "",
  dailyMacros: { protein: 170, carbs: 300, fat: 80 },
  meals: [
    {
      id: mealId,
      name: "Lunch",
      foods: "Usual lunch",
      macros: { protein: 40, carbs: 70, fat: 20 },
    },
  ],
  instructions: [],
};
const p = proposalSchema.parse({
  assessment: "Trial a small adjustment",
  evidence: [],
  uncertainties: [],
  changes: [
    {
      mealId,
      instruction: "Add 25g carbs to lunch",
      rationale: "Review observed response",
      proteinDelta: 0,
      carbsDelta: 25,
      fatDelta: 0,
    },
  ],
  phase: null,
  phaseReason: "",
  suggestedPhaseWeeks: null,
  reviewAfterDays: 14,
  reviewCriteria: "Weight trend, hunger and comparable performance",
  trainingHandoff: "",
  questions: [],
});
const after = applyChanges(baseline, p);
assert.equal(after.dailyMacros.carbs, 325);
assert.equal(after.meals[0].macros.carbs, 95);
assert.equal(
  baseline.dailyMacros.carbs,
  300,
  "Pure application must not mutate saved baseline",
);
assert.equal(after.dailyMacros.protein, 170);
const unknown = structuredClone(baseline);
unknown.dailyMacros.carbs = null;
assert.equal(applyChanges(unknown, p).dailyMacros.carbs, null);
const wholeDay = structuredClone(p);
wholeDay.changes[0].mealId = null;
assert.equal(
  applyChanges(baseline, wholeDay).meals[0].macros.carbs,
  null,
  "Do not invent meal allocation",
);
const unquantified = structuredClone(p);
unquantified.changes[0].carbsDelta = null;
assert.equal(applyChanges(baseline, unquantified).dailyMacros.carbs, null);
const missingMeal = structuredClone(p);
missingMeal.changes[0].mealId = "22222222-2222-4222-8222-222222222222";
assert.throws(
  () => applyChanges(baseline, missingMeal),
  /meal no longer exists/,
);
const negative = structuredClone(p);
negative.changes[0].carbsDelta = -100;
assert.throws(() => applyChanges(baseline, negative), /invalid macro/);
assert.equal(
  baselineSchema.safeParse({
    ...baseline,
    meals: [...baseline.meals, ...baseline.meals],
  }).success,
  false,
);
assert.equal(
  proposalSchema.safeParse({ ...p, reviewAfterDays: 0 }).success,
  false,
);
assert.equal(
  applyChanges(baseline, { ...p, changes: [] }).dailyMacros.carbs,
  300,
);
const source = readFileSync("lib/server/nutrition-coach.ts", "utf8");
assert.equal((source.match(/responses\.parse/g) ?? []).length, 1);
const discussion = source.slice(
  source.indexOf('mode: "DISCUSSION"'),
  source.indexOf("const started ="),
);
assert.ok(!discussion.includes("buildNutritionEvidence"));
assert.ok(discussion.includes("slice(-6)"));
const client = readFileSync("components/nutrition/NutritionCoach.tsx", "utf8");
assert.ok(!client.includes("useEffect"));
assert.ok(
  !readFileSync("lib/server/automatic-coaching.ts", "utf8").includes(
    "runNutritionAction",
  ),
);
for (const file of [
  "pre-workout-coach",
  "weekly-coach",
  "ai-programming-decisions",
  "ai-mesocycle-recommendations",
  "ai-workout-analysis",
  "mesocycle-design-context",
  "physique-checkins",
])
  assert.ok(
    readFileSync(`lib/server/${file}.ts`, "utf8").includes(
      "getNutritionTrainingContext",
    ),
    file,
  );
const migration = readFileSync(
  "prisma/migrations/20261017120000_nutrition_coach/migration.sql",
  "utf8",
);
assert.equal((migration.match(/ENABLE ROW LEVEL SECURITY/g) ?? []).length, 2);
assert.ok(migration.includes("FROM PUBLIC, anon, authenticated"));
console.log(
  "Nutrition deltas, unknown estimates, validation, targeted-context and integration boundaries passed.",
);
