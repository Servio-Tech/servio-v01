import { test } from "node:test";
import assert from "node:assert/strict";
import { getPlanCapabilities } from "./planCapabilities.js";

const starter = { plan: "starter", aiWaiter: false, multiBranch: false, advancedAnalytics: true, maxBranches: 1 };
const pro = { plan: "pro", aiWaiter: true, multiBranch: true, advancedAnalytics: true, maxBranches: 3 };

test("Starter retains advanced analytics and Pro includes all capabilities", () => {
  assert.deepEqual(getPlanCapabilities({ plan: "starter" }), starter);
  assert.deepEqual(getPlanCapabilities({ plan: "pro" }), pro);
});

test("missing, malformed and unrecognized plan values default to Starter", () => {
  for (const tenant of [undefined, null, {}, { id: "tenant-1", name: "Cafe" }, { plan: "enterprise" }, { plan: "PRO" }, { plan: true }, Object.create({ plan: "pro" })]) {
    assert.deepEqual(getPlanCapabilities(tenant), starter);
  }
});

test("theme, metadata and guessed plan fields cannot enable Pro", () => {
  for (const tenant of [
    { subscription_plan: "pro" },
    { theme_config: { plan: "pro", aiWaiter: true } },
    { user_metadata: { plan: "pro" } },
    { entitlements: { multiBranch: true, aiWaiter: true } },
  ]) assert.deepEqual(getPlanCapabilities(tenant), starter);
});

test("returned objects are independent and cannot change later results", () => {
  const first = getPlanCapabilities(null);
  first.multiBranch = true;
  assert.deepEqual(getPlanCapabilities(null), starter);
});
