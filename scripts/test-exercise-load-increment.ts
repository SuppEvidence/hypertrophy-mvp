import assert from "node:assert/strict";
import { exerciseSchema } from "../lib/validations/exercise";

const base = {
  name: "Machine press",
  movementGroupId: "11111111-1111-4111-8111-111111111111",
  tags: "machine",
  setupNotes: "Seat 4",
  isActive: true,
  isArchived: false,
};

assert.equal(exerciseSchema.parse({ ...base, minimumWeightIncrement: "" }).minimumWeightIncrement, null);
assert.equal(exerciseSchema.parse({ ...base, minimumWeightIncrement: "2.5" }).minimumWeightIncrement, 2.5);
assert.equal(exerciseSchema.safeParse({ ...base, minimumWeightIncrement: "0" }).success, false);
assert.equal(exerciseSchema.safeParse({ ...base, minimumWeightIncrement: "-2.5" }).success, false);
assert.equal(exerciseSchema.safeParse({ ...base, minimumWeightIncrement: "1.234" }).success, false);

console.log("5 exercise load-increment validation checks passed.");
