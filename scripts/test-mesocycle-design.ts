import assert from "node:assert/strict";
import { brief, refs, proposal, muscleId } from "./mesocycle-design-fixture";
import {
  briefSchema,
  designSchema,
  designSchemaForCatalogue,
} from "../lib/mesocycle-design/schema";
import { validateDesign } from "../lib/mesocycle-design/validation";
import { approvedDesignContext } from "../lib/mesocycle-design/handoff";
assert.ok(briefSchema.safeParse(brief).success);
assert.ok(designSchema.safeParse(proposal).success);
assert.deepEqual(validateDesign(proposal, brief, refs).errors, []);
assert.equal(validateDesign(proposal, brief, refs).dose[muscleId], 6);
const changed = structuredClone(proposal);
changed.sessions[1].weekday = 6;
assert.ok(
  validateDesign(changed, brief, refs).warnings.some((w) =>
    w.includes("week boundaries"),
  ),
);
assert.ok(
  validateDesign(
    proposal,
    { ...brief, availableWeekdays: [1, 2] },
    refs,
  ).errors.some((e) => e.includes("unavailable")),
);
assert.ok(
  validateDesign(
    proposal,
    { ...brief, minutesPerSession: 10 },
    refs,
  ).warnings.some((e) => e.includes("exceeds")),
);
assert.ok(
  validateDesign(
    proposal,
    { ...brief, excludedExerciseIds: [refs.exercises[0].id] },
    refs,
  ).errors.some((e) => e.includes("excluded")),
);
const missing = structuredClone(proposal);
missing.sessions[0].items[0].exerciseId = null;
assert.ok(
  validateDesign(missing, brief, refs).errors.some((e) =>
    e.includes("active library"),
  ),
);
const dup = structuredClone(proposal);
dup.sessions[0].items.push({ ...dup.sessions[0].items[0], key: "other" });
assert.ok(
  validateDesign(dup, brief, refs).errors.some((e) =>
    e.includes("duplicate exercise"),
  ),
);
const locked = structuredClone(proposal);
locked.sessions[0].items[0].locked = true;
assert.ok(
  validateDesign(proposal, brief, refs, locked).errors.some((e) =>
    e.includes("Locked item"),
  ),
);
const mismatch = structuredClone(proposal);
mismatch.priorities[0].priority = "MAINTAIN";
assert.ok(
  validateDesign(mismatch, brief, refs).errors.some((e) =>
    e.includes("confirmed priorities"),
  ),
);
const unresolved = structuredClone(proposal);
unresolved.constraintChecks = [
  { constraint: "Equipment", handling: "Confirm access", status: "UNRESOLVED" },
];
assert.ok(
  validateDesign(unresolved, brief, refs).errors.some((e) =>
    e.includes("Restriction"),
  ),
);
assert.equal(approvedDesignContext(null), null);
const intent = approvedDesignContext({ brief, plan: proposal });
assert.equal(intent?.goals, brief.goals);
assert.ok(
  !(
    "baselineSchedule" in
    approvedDesignContext({ brief, plan: proposal }, refs.exercises[0].id)!
  ),
  "T1 receives a bounded relevant handoff",
);
console.log(
  "Design validation: dates/schema, dose, cross-week spacing, time, exclusions, unresolved slots, duplicates, locked revisions, confirmed goals and compact handoff passed.",
);

const foreign = structuredClone(proposal);
foreign.sessions[0].items[0].exerciseId =
  "99999999-9999-4999-8999-999999999999";
assert.equal(
  designSchemaForCatalogue(refs).safeParse(foreign).success,
  false,
  "Model cannot generate an unknown exercise reference",
);
assert.equal(designSchemaForCatalogue(refs).safeParse(proposal).success, true);
