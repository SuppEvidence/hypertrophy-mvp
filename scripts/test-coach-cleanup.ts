import assert from "node:assert/strict";
import { freshT3Assessment, summarizeCoachAnalysis } from "../lib/coaching/coach-evidence-summary";
import { approvedWeekDose } from "../lib/coaching/weekly-coach-dose";
import { WorkoutAnalysisSchema } from "../lib/ai/workout-analysis-schema";
import type { WeeklyCoachPlan } from "../lib/coaching/weekly-coach-policy";

const now = new Date("2026-10-01T09:00:00Z");
const assessment = { assessments: [{ muscleId: "delts", muscleName: "Side delts", priority: "SPECIALIZE", status: "ON_TRACK", confidence: "HIGH",
  recommendedRangeMinimum: 12, recommendedRangeMaximum: 20, rationale: "Useful dose with low fatigue", evidence: [] }] };
assert.ok(freshT3Assessment(assessment, new Date("2026-10-01T08:00:00Z"), new Date("2026-10-01T07:00:00Z"), now));
assert.equal(freshT3Assessment(assessment, new Date("2026-09-01"), new Date("2026-08-31"), now), null);
assert.equal(freshT3Assessment(assessment, new Date("2026-10-01T08:00:00Z"), new Date("2026-10-01T08:30:00Z"), now), null,
  "New workout, metric or analysis evidence makes prior conclusions stale");
assert.equal(freshT3Assessment({ assessments: [] }, now, now, now), null);
const analysis = WorkoutAnalysisSchema.parse({ workoutSummary: "Legacy detailed summary ".repeat(30), overallFatigueSignal: "HIGH", confidence: "LOW",
  exerciseAssessments: [{ sessionExerciseId: "e", exerciseName: "Cable lateral raise", overallStimulus: "MODERATE", overallFatigueCost: "HIGH",
    performanceDecay: "HIGHER_THAN_USUAL", confidence: "LOW", notableSignals: ["Repeated pain", "Compromised execution"], rationale: "Older detailed explanation ".repeat(20),
    sets: [{ setNumber: 1, stimulus: "MODERATE", fatigueCost: "HIGH", rirPlausibility: "UNCERTAIN", confidence: "LOW", rationale: "Legacy detailed rationale" }] }],
  movementPatternAssessments: [{ movementPatternId: "lateral", movementPatternName: "Lateral raise", overallStimulus: "MODERATE", overallFatigueCost: "HIGH",
    progressionSignal: "NEGATIVE", exerciseConsistency: "MIXED", implementationInterpretation: "EXERCISE_SPECIFIC_LIMITATION", confidence: "LOW",
    notableSignals: ["Repeated pain"], rationale: "Older pattern explanation ".repeat(20) }] });
const compact = summarizeCoachAnalysis(analysis);
assert.equal(compact.overallFatigueSignal, "HIGH");
assert.equal(compact.confidence, "LOW");
assert.deepEqual(compact.exercises?.[0].notableSignals, ["Repeated pain", "Compromised execution"]);
assert.ok(JSON.stringify(compact).length < JSON.stringify(analysis).length);
assert.equal(summarizeCoachAnalysis(analysis, new Set(["other"]), false).movementPatterns.length, 0);

const day = (id: string) => ({ id, date: "2026-10-01", templateId: "template", durationMinutes: 60, rationale: "Plan",
  items: [{ sourceSlotId: "slot", exerciseId: "e", sets: 2, setTypeIds: ["normal", "edt"], reason: "Priority" }] });
const plan: WeeklyCoachPlan = { version: "W1", weekStart: "2026-09-28", summary: "Plan", workouts: [day("done"), day("next"), day("missed")] };
const dose = approvedWeekDose({ plan, missedIds: ["missed"], completedOccurrenceIds: ["done"], startedIds: ["done", "next"],
  completed: [{ id: "session", date: "2026-09-29", templateId: "template", physicalSets: 3, effectiveSets: 3,
    muscles: { delts: 3 }, movements: { lateral: 3 } }],
  exercises: [{ id: "e", movementGroupId: "lateral", primaryMuscleIds: ["delts"], secondaryMuscles: [{ muscleId: "traps", fraction: .25 }] }],
  multipliers: { normal: 1, edt: 1.5 } });
assert.equal(dose.completed.muscleDose.delts, 3);
assert.equal(dose.notCompleted.muscleDose.delts, 2.5, "Do not add completed or missed occurrence prescriptions to remaining work");
assert.equal(dose.notCompleted.muscleDose.traps, .625);
assert.equal(dose.notCompleted.sessions[0].status, "IN_PROGRESS");
assert.equal(dose.notCompleted.unknownItems, 0);
console.log("Compact evidence, freshness, and approved-week dose checks passed.");
