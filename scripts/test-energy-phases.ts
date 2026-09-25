import assert from "node:assert/strict";
import { interpretEnergyPhase } from "../lib/coaching/energy-phase";

const phases = [
  { phase: "MAINTAINING" as const, startDate: new Date("2026-09-01T00:00:00Z") },
  { phase: "CUTTING" as const, startDate: new Date("2026-09-20T00:00:00Z") },
];
assert.equal(interpretEnergyPhase(phases, new Date("2026-08-31T12:00:00Z")), null);
assert.equal(interpretEnergyPhase(phases, new Date("2026-09-10T12:00:00Z"))?.endDateExclusive, "2026-09-20");
assert.equal(interpretEnergyPhase(phases, new Date("2026-09-20T12:00:00Z"))?.phase, "CUTTING");
assert.equal(interpretEnergyPhase(phases, new Date("2026-09-25T12:00:00Z"))?.transitionCaution, true);
assert.equal(interpretEnergyPhase(phases, new Date("2026-10-10T12:00:00Z"))?.transitionCaution, false);
console.log("Dated energy phase boundaries and transition interpretation passed.");
