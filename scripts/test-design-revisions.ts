import assert from "node:assert/strict";
import { zodTextFormat } from "openai/helpers/zod";
import { proposal, refs } from "./mesocycle-design-fixture";
import {
  applyDesignRevision,
  designRevisionSchema,
  revisionSchemaForCatalogue,
  revisionCatalogue,
} from "../lib/mesocycle-design/revision";
import { validateDesign } from "../lib/mesocycle-design/validation";
import { brief } from "./mesocycle-design-fixture";
const fields = Object.fromEntries(
  Object.keys(designRevisionSchema.shape.fields.shape).map((k) => [k, null]),
);
const empty = {
  summary: "Answer without changing your plan.",
  changes: [],
  fields,
  changedSessions: [],
  removedSessionKeys: [],
};
assert.deepEqual(
  applyDesignRevision(proposal, empty).sessions,
  proposal.sessions,
);
assert.equal(
  applyDesignRevision(proposal, empty).lengthWeeks,
  proposal.lengthWeeks,
);
const changed = structuredClone(proposal.sessions[0]);
changed.items[0].sets += 1;
const revised = applyDesignRevision(proposal, {
  ...empty,
  changedSessions: [changed],
});
assert.equal(revised.sessions[0].items[0].sets, changed.items[0].sets);
assert.deepEqual(revised.sessions[1], proposal.sessions[1]);
assert.deepEqual(
  applyDesignRevision(proposal, {
    ...empty,
    fields: { ...fields, libraryGaps: [] },
  }).libraryGaps,
  [],
);
assert.throws(
  () =>
    applyDesignRevision(proposal, {
      ...empty,
      changedSessions: [changed, changed],
    }),
  /duplicate/,
);
assert.throws(
  () =>
    applyDesignRevision(proposal, {
      ...empty,
      removedSessionKeys: ["unknown"],
    }),
  /invalid/,
);
assert.throws(
  () =>
    applyDesignRevision(proposal, {
      ...empty,
      removedSessionKeys: [changed.key],
      changedSessions: [changed],
    }),
  /invalid/,
);
const locked = structuredClone(proposal);
locked.sessions[0].items[0].locked = true;
assert.ok(
  validateDesign(
    applyDesignRevision(locked, { ...empty, changedSessions: [changed] }),
    brief,
    refs,
    locked,
  ).errors.some((e) => e.startsWith("Locked item")),
);
const foreign = structuredClone(changed);
foreign.items[0].exerciseId = "99999999-9999-4999-8999-999999999999";
assert.equal(
  revisionSchemaForCatalogue(refs).safeParse({
    ...empty,
    changedSessions: [foreign],
  }).success,
  false,
);
assert.ok(zodTextFormat(revisionSchemaForCatalogue(refs), "revision").schema);
assert.equal(
  revisionCatalogue(refs, proposal, []).exercises.length,
  refs.exercises.length,
);
console.log(
  "Design revision merge, preservation, catalogue, locks and structured-output schema passed.",
);
