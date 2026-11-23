import test from "node:test";
import assert from "node:assert/strict";
import { getBranchLimit, canAddBranch } from "./planCapabilities.js";

test("Starter permits exactly one branch and Pro permits three in total", () => {
  assert.equal(getBranchLimit("starter"), 1);
  assert.equal(canAddBranch("starter", 0), true);
  assert.equal(canAddBranch("starter", 1), false);
  assert.equal(getBranchLimit("pro"), 3);
  assert.equal(canAddBranch("pro", 2), true);
  assert.equal(canAddBranch("pro", 3), false);
  assert.equal(canAddBranch("pro", 4), false);
});

test("unknown plans and unavailable counts fail closed", () => {
  assert.equal(getBranchLimit("unknown"), null);
  assert.equal(canAddBranch("unknown", 0), false);
  assert.equal(canAddBranch("pro", null), false);
  assert.equal(canAddBranch("pro", -1), false);
  assert.equal(canAddBranch("pro", 1.5), false);
});
