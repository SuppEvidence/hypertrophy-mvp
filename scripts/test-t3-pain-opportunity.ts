import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPainOpportunityEvidence, assertPainOpportunity, assertPainOpportunityPreview, assertPainOpportunityApprovedCapacity, type PainApproval } from "../lib/coaching/t3-pain-opportunity";
import { validateT3Review, type DecisionValidationContext } from "../lib/coaching/t3-review-validation";
import type { ToleranceExposure } from "../lib/coaching/exposure-tolerance";
import type { ProgrammingOption, ProgrammingRecommendations } from "../lib/ai/programming-decision-schema";
import type { T3PlanPreview } from "../lib/coaching/t3-prescription-preview";
const row = (exerciseId: string, muscleId: string, day: number, pain: boolean): ToleranceExposure => ({ exerciseId, painFlag: pain,
  exercise: { name: exerciseId, movementGroupId: exerciseId, primaryMuscles: [{ muscleId }], secondaryMuscles: [] },
  session: { performedAt: new Date(`2026-10-${String(day).padStart(2, "0")}T10:00:00Z`) },
  sets: [{ weight: 20, reps: 12, rir: 1, painFlag: false, intensifierDetails: null,
    setType: { slug: "normal", name: "Normal", multiplier: 1, isIntensifier: false } }] });
const history = [row("squat", "quads", 10, true), row("squat", "quads", 12, true), row("curl", "biceps", 10, false), row("curl", "biceps", 12, false)];
const evidence = buildPainOpportunityEvidence(history, false, new Date("2026-10-13T12:00:00Z"));
assert.deepEqual(evidence.sourceMuscleIds, ["quads"]);
assert.deepEqual(evidence.toleratedExerciseIds, ["curl"]);
assert.deepEqual(buildPainOpportunityEvidence([history[0], history[0]], false, new Date("2026-10-13")).sourceMuscleIds, []);
assert.deepEqual(buildPainOpportunityEvidence(history, false, new Date("2026-11-13")).sourceMuscleIds, []);
const assessment = { muscleId: "biceps", muscleName: "Biceps", priority: "MAINTAIN" as const, status: "ON_TRACK" as const,
  priorityReview: { maintenanceBasis: "LOWER_DOSE_HISTORY" as const }, confidence: "MODERATE" as const,
  recommendedRangeMinimum: 6, recommendedRangeMaximum: 8, rationale: "Productive tolerated work", evidence: ["Repeated comparable pain-free curl performance."] };
const opportunity: ProgrammingOption = { optionKey: "OPTION_A", action: "INCREASE_VOLUME", deltaWeeklySets: 2,
  painOpportunity: { sourceMuscleIds: ["quads"] }, title: "Optional biceps growth trial", preferredExerciseType: "ISOLATION", placementPreference: "KEEP_CURRENT",
  movementChanges: [{ movementPatternId: "curl", movementPatternName: "Curl", deltaSets: 2 }], rationale: "Use released training room", expectedBenefit: "Extra productive work", mainRisk: "Elbow tolerance" };
assert.doesNotThrow(() => assertPainOpportunity(opportunity, "biceps", assessment, evidence));
for (const e of [{ ...evidence, systemicConcern: true }, { ...evidence, affectedMuscleIds: ["quads", "biceps"] }]) assert.throws(() => assertPainOpportunity(opportunity, "biceps", assessment, e));
assert.throws(() => assertPainOpportunity(opportunity, "biceps", { ...assessment, confidence: "LOW" }, evidence));
assert.throws(() => assertPainOpportunity(opportunity, "biceps", { ...assessment, priority: "INDIRECT_ONLY" }, evidence));
const increase: T3PlanPreview = { slots: [{ id: "c", templateId: "upper", exerciseId: "curl", template: "Upper", exercise: "Curl", before: 3, after: 4 }], muscles: [{ muscleId: "biceps", name: "Biceps", before: 8, after: 10 }], movementTargets: [], weeklyPhysicalSetsAdded: 2, weeklyPhysicalSetsRemoved: 0 };
assert.doesNotThrow(() => assertPainOpportunityPreview(opportunity, increase, evidence));
assert.throws(() => assertPainOpportunityPreview(opportunity, { ...increase, slots: [{ ...increase.slots[0], exerciseId: "new-curl" }] }, evidence));
assert.throws(() => assertPainOpportunityPreview(opportunity, { ...increase, muscles: [...increase.muscles, { muscleId: "quads", name: "Quads", before: 10, after: 11 }] }, evidence));
const reduction: ProgrammingOption = { ...opportunity, painOpportunity: null, action: "DECREASE_VOLUME", deltaWeeklySets: -2, movementChanges: [{ movementPatternId: "squat", movementPatternName: "Squat", deltaSets: -2 }] };
const sourcePreview: T3PlanPreview = { slots: [{ id: "s", templateId: "lower", exerciseId: "squat", template: "Lower", exercise: "Squat", before: 5, after: 3 }], muscles: [{ muscleId: "quads", name: "Quads", before: 16, after: 12 }], movementTargets: [], weeklyPhysicalSetsAdded: 0, weeklyPhysicalSetsRemoved: 4 };
const source: PainApproval = { muscleId: "quads", option: reduction, preview: sourcePreview, sourceEvidence: evidence, selectedAt: new Date("2026-10-13T10:00:00Z") };
const currentDose = new Map([["quads", 12]]), currentSlots = new Map([["lower:squat", 3]]);
assert.throws(() => assertPainOpportunityApprovedCapacity(opportunity, increase, [], currentDose, currentSlots), /Approve/);
assert.doesNotThrow(() => assertPainOpportunityApprovedCapacity(opportunity, increase, [source], currentDose, currentSlots));
assert.throws(() => assertPainOpportunityApprovedCapacity(opportunity, increase, [source], new Map([["quads", 16]]), currentSlots), /remain/);
assert.throws(() => assertPainOpportunityApprovedCapacity(opportunity, increase, [source], currentDose, new Map([["lower:squat", 5]])), /restored/);
const used: PainApproval = { ...source, muscleId: "chest", option: { ...opportunity, painOpportunity: null }, preview: { ...increase, weeklyPhysicalSetsAdded: 3 }, selectedAt: new Date("2026-10-13T11:00:00Z") };
assert.throws(() => assertPainOpportunityApprovedCapacity(opportunity, increase, [source, used], currentDose, currentSlots), /headroom/);
assert.throws(() => assertPainOpportunityApprovedCapacity(opportunity, increase, [{ ...source, sourceEvidence: null }], currentDose, currentSlots), /Approve/);
const sourceAssessment = { ...assessment, muscleId: "quads", muscleName: "Quads", priority: "SPECIALIZE" as const, priorityReview: { maintenanceBasis: "NOT_MAINTENANCE" as const }, status: "RECOVERABILITY_CONCERN" as const, recommendedRangeMinimum: 10, recommendedRangeMaximum: 14, evidence: ["Repeated knee symptoms in squat exposures."] };
const proposal = (muscleId: string, option: ProgrammingOption) => ({ targetMuscleId: muscleId, targetMuscleName: muscleId, decisionSummary: "Change", confidence: "MODERATE" as const, evidence: ["Dated exposures"], recommendedOptionKey: "OPTION_A" as const, options: [option], keepAsIsRationale: "Optional" });
const review: ProgrammingRecommendations = { globalSummary: "", bodyCompositionContext: "", assessments: [assessment, sourceAssessment], decisions: [proposal("biceps", opportunity), proposal("quads", reduction)] };
const context: DecisionValidationContext = { painOpportunityEvidence: evidence, validMuscleIds: new Set(["biceps", "quads"]), canonicalMuscleNames: new Map([["biceps", "Biceps"], ["quads", "Quads"]]), targetByMuscle: new Map([["biceps", { priority: "MAINTAIN", target: 8, minimum: 6, maximum: 8 }], ["quads", { priority: "SPECIALIZE", target: 16, minimum: 14, maximum: 20 }]]), currentMovementSets: new Map([["curl", 8], ["squat", 16]]), validPatternsByMuscle: new Map([...["biceps", "quads"].map((muscle) => { const pattern = muscle === "biceps" ? "curl" : "squat"; return [muscle, new Map([[pattern, { movementPatternId: pattern, movementPatternName: pattern, primaryExerciseCount: 1, secondaryExerciseCount: 0, availableExerciseTypes: ["ISOLATION" as const], exampleExercises: [pattern] }]])] as const; })]) };
const checked = validateT3Review(review, context);
assert.equal(checked.parsed.decisions.length, 2);
assert.equal(checked.parsed.assessments[0].recommendedRangeMinimum, 6);
const ordinary = structuredClone(review); ordinary.decisions[0].options[0].painOpportunity = null;
assert.equal(validateT3Review(ordinary, context).parsed.decisions.length, 1);
const orphan = { ...review, decisions: [review.decisions[0]] };
assert.equal(validateT3Review(orphan, context).parsed.decisions.length, 0);
assert.equal(validateT3Review(orphan, { ...context, painOpportunityEvidence: { ...evidence, approvedSourceMuscleIds: ["quads"] } }).parsed.decisions.length, 1);
const server = readFileSync("lib/server/ai-programming-decisions.ts", "utf8");
assert.equal((server.match(/responses\.parse\(/g) ?? []).length, 1);
assert.ok(server.includes("assertPainOpportunityApprovedCapacity(selectedOption, appliedPreview"));
console.log("Localized pain opportunities, maintenance exception, approval dependencies, restored/used capacity and symptom guards passed.");
