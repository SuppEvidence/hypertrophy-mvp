import assert from "node:assert/strict";
import { evaluateLiveCoachEligibility } from "../lib/coaching/live-coaching";
import { detectCoachSignal, validateCoachDecision, type CoachSet, type CoachDecision } from "../lib/coaching/workout-coach-policy";

let checks = 0;
function check(name: string, fn: () => void) { fn(); checks++; console.log(`PASS ${name}`); }
const set = (patch: Partial<CoachSet> = {}): CoachSet => ({ id: "set", setNumber: 1,
  weight: 80, reps: 10, rir: 1, setTypeId: "straight", isIntensifier: false,
  pain: false, executionCompromised: false, ...patch });
const prescription = { minReps: 8, maxReps: 12, targetRir: 1, suggestedLoad: 80 };
const history = Array.from({ length: 5 }, () => [set(), set({ setNumber: 2, reps: 9 })]);
const detect = (trigger: CoachSet, overrides = {}) => detectCoachSignal({ trigger, current: [set(), trigger], history, prescription, exercisePain: false, ...overrides });
const gate = { sessionStatus: "DRAFT", plannedSetCount: 3, completedSetCount: 1,
  triggerSetCompleted: true, triggerSetHasUsablePerformance: true, triggerSetPain: false,
  triggerSetExecutionCompromised: false, historicalPerformanceExposureCount: 5, existingActionForTriggerSet: false };

check("single-set exercises skip even with pain", () => assert.equal(evaluateLiveCoachEligibility({ ...gate, plannedSetCount: 1, triggerSetPain: true }).shouldCheck, false));
check("final sets skip", () => assert.equal(evaluateLiveCoachEligibility({ ...gate, completedSetCount: 3 }).shouldCheck, false));
check("completed workouts skip", () => assert.equal(evaluateLiveCoachEligibility({ ...gate, sessionStatus: "COMPLETED" }).shouldCheck, false));
check("duplicate triggers skip", () => assert.equal(evaluateLiveCoachEligibility({ ...gate, existingActionForTriggerSet: true }).shouldCheck, false));
check("normal variation stays quiet", () => assert.equal(detect(set({ reps: 9 })).shouldCheck, false));
check("insufficient history stays quiet", () => assert.equal(detect(set({ reps: 6 }), { history: history.slice(0, 2) }).shouldCheck, false));
check("missing RIR is not assumed failure", () => assert.equal(detect(set({ rir: null })).shouldCheck, false));
check("intensifier totals not treated as straight sets", () => assert.equal(detect(set({ isIntensifier: true })).shouldCheck, false));
check("wrong historical set types do not qualify", () => assert.equal(detect(set({ setTypeId: "drop" })).shouldCheck, false));
check("zero-load/bodyweight index is not usable", () => assert.equal(detect(set({ weight: 0 })).shouldCheck, false));
check("pain warrants review with sparse history", () => assert.equal(detect(set({ pain: true }), { history: [] }).shouldCheck, true));
check("large target miss qualifies", () => assert.equal(detect(set({ reps: 6 })).shouldCheck, true));
check("normal second-set decay stays quiet", () => assert.equal(detect(set({ setNumber: 2, reps: 9 })).shouldCheck, false));
check("abnormal second-set decay qualifies", () => {
  const result = detect(set({ setNumber: 2, reps: 5 }));
  assert.equal(result.shouldCheck, true); assert.equal(result.reason, "EXCESSIVE_DECAY");
});

const decision: CoachDecision = { action: "ADJUST", confidence: "MODERATE", reason: "Reduce load.",
  suggestedLoad: 77.5, minReps: null, maxReps: null, targetRir: null };
const input = { current: prescription, referenceLoad: 80, trigger: set(), signal: "EXCESSIVE_DECAY", targetIsIntensifier: false };
check("small load reduction accepted", () => assert.equal(validateCoachDecision(decision, input), null));
check("large load reduction rejected", () => assert.equal(validateCoachDecision({ ...decision, suggestedLoad: 60 }, input), "LOAD_BOUND"));
check("load increase after decay rejected", () => assert.equal(validateCoachDecision({ ...decision, suggestedLoad: 82 }, input), "NO_LOAD_INCREASE"));
check("automatic pain adjustment rejected", () => assert.equal(validateCoachDecision(decision, { ...input, signal: "PAIN" }), "PAIN_REQUIRES_REVIEW"));
check("intensifier adjustment rejected", () => assert.equal(validateCoachDecision(decision, { ...input, targetIsIntensifier: true }), "INTENSIFIER_ADJUSTMENT_UNSUPPORTED"));
check("low-confidence adjustment rejected", () => assert.equal(validateCoachDecision({ ...decision, confidence: "LOW" }, input), "LOW_CONFIDENCE"));
check("inverted rep targets rejected", () => assert.equal(validateCoachDecision({ ...decision, minReps: 10, maxReps: 9 }, input), "REP_BOUND"));
check("harder RIR after decay rejected", () => assert.equal(validateCoachDecision({ ...decision, targetRir: 0 }, input), "NO_EFFORT_INCREASE"));
check("missing RIR target not invented", () => assert.equal(validateCoachDecision({ ...decision, targetRir: 1 }, { ...input, current: { ...prescription, targetRir: null } }), "RIR_BOUND"));
check("KEEP needs no mutation", () => assert.equal(validateCoachDecision({ ...decision, action: "KEEP" }, input), null));
check("load increase after a too-hard target miss rejected", () => assert.equal(validateCoachDecision({ ...decision, suggestedLoad: 82 }, { ...input, signal: "TARGET_MISS", trigger: set({ reps: 6, rir: 0 }) }), "NO_LOAD_INCREASE"));
check("load increase after clearly too-easy set allowed", () => assert.equal(validateCoachDecision({ ...decision, suggestedLoad: 82 }, { ...input, signal: "TARGET_MISS", trigger: set({ reps: 12, rir: 3 }) }), null));
check("unchanged targets do not produce a coaching action", () => assert.equal(validateCoachDecision({ ...decision, suggestedLoad: 80 }, input), "NO_CHANGE"));
console.log(`${checks} live coach policy checks passed.`);
