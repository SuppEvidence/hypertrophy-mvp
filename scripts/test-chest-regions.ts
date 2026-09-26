import assert from "node:assert/strict";
import { chestRegionForMovement, classifyChestPrimary } from "../lib/coaching/chest-regions";

assert.equal(chestRegionForMovement["Incline press"], "Upper chest");
assert.equal(chestRegionForMovement["Low-to-high chest fly/press"], "Upper chest");
assert.equal(chestRegionForMovement["Flat press"], "Mid chest");
assert.equal(chestRegionForMovement["Decline/dip press"], "Lower chest");
assert.equal(chestRegionForMovement["Chest fly"], undefined);
const input = (movementName: string, primaryIds: string[]) =>
  classifyChestPrimary({ movementName, primaryIds, chestId: "chest", regionId: "upper", chestRegionIds: ["upper", "mid", "lower"] });
assert.deepEqual(input("Incline press", []), ["upper"]);
assert.deepEqual(input("Incline press", ["chest"]), ["upper"]);
assert.deepEqual(input("Incline press", ["mid"]), ["mid"]);
assert.deepEqual(input("Incline press", ["front delts"]), ["front delts", "upper"]);
assert.deepEqual(classifyChestPrimary({ movementName: "Incline press", primaryIds: ["chest", "mid"], chestId: "chest", regionId: "upper", chestRegionIds: ["upper", "mid", "lower"] }), ["mid"]);
assert.deepEqual(input("Chest fly", ["chest"]), ["chest"]);
console.log("Chest movement defaults passed.");
