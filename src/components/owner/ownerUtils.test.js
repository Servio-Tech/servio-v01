import test from "node:test";
import assert from "node:assert/strict";
import { dateInputValue, isBlocked, isOwnerResponse, matchesUser, needsReconciliation, subscriptionPayload } from "./ownerUtils.js";

test("owner access fails closed without an explicit affirmative response", () => {
  for (const value of [null, {}, { success: true }, { error: "forbidden" }, { authorized: false }, { success: true, authorized: false }]) assert.equal(isOwnerResponse(value), false);
  assert.equal(isOwnerResponse({ authorized: true }), true);
  assert.equal(isOwnerResponse({ is_owner: true }), true);
});

test("subscription validates tenant, plans and calendar dates, inclusive UTC end", () => {
  assert.equal(subscriptionPayload(null, "pro", "2026-01-01", "2026-02-01"), null);
  assert.equal(subscriptionPayload("tenant", "enterprise", "2026-01-01", "2026-02-01"), null);
  assert.equal(subscriptionPayload("tenant", "starter", "2026-02-30", "2026-03-01"), null);
  assert.equal(subscriptionPayload("tenant", "pro", "2026-03-02", "2026-03-01"), null);
  assert.deepEqual(subscriptionPayload("tenant", "pro", "2026-03-01", "2026-03-02"), { tenant_id: "tenant", plan: "pro", starts_at: "2026-03-01T00:00:00.000Z", ends_at: "2026-03-02T23:59:59.999Z" });
  assert.equal(dateInputValue("2026-03-02T23:59:59.999Z"), "2026-03-02");
});

test("account status and search are derived from actual records", () => {
  assert.equal(isBlocked({ blocked: true }), true);
  assert.equal(isBlocked({ banned_until: "2027-01-01T00:00:00Z" }, Date.parse("2026-01-01T00:00:00Z")), true);
  assert.equal(isBlocked({ banned_until: "2025-01-01T00:00:00Z" }, Date.parse("2026-01-01T00:00:00Z")), false);
  assert.equal(matchesUser({ email: "Owner@Example.com", tenant_name: "مقهى" }, "example"), true);
  assert.equal(matchesUser({ email: "a@example.com" }, "missing"), false);
});

test("ambiguous mutations require verification before retrying", () => {
  assert.equal(needsReconciliation("ban_user", 503, "BAN_PARTIALLY_ENFORCED"), true);
  assert.equal(needsReconciliation("delete_user", undefined, undefined), true);
  assert.equal(needsReconciliation("set_subscription", 503, "AUDIT_INCOMPLETE"), true);
  assert.equal(needsReconciliation("ban_user", 503, "GUARD_UNAVAILABLE"), false);
  assert.equal(needsReconciliation("list", undefined, undefined), false);
});
