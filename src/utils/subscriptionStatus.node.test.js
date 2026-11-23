import test from "node:test";
import assert from "node:assert/strict";
import { getOwnSubscriptionStatus, resolveSubscriptionProfile, subscriptionStatusMessage, withSubscriptionTimeout } from "./subscriptionStatus.js";

function client({ statuses = ["active", "active"], profile = { id: "user-a", tenant_id: "tenant-a", role: "admin" }, session = { user: { id: "user-a" } }, sessionError = null, ensureError = null } = {}) {
  let n = 0;
  const calls = [];
  return {
    calls,
    auth: { getSession: async () => ({ data: { session }, error: sessionError }) },
    rpc: async (name, ...args) => {
      calls.push([name, ...args]);
      if (name === "platform_current_subscription_status") {
        const value = statuses[Math.min(n++, statuses.length - 1)];
        if (value instanceof Error) throw value;
        if (typeof value === "object") return value;
        return { data: value, error: null };
      }
      if (name === "ensure_profile_for_current_user") return { data: profile, error: ensureError };
      throw Error(`Unexpected RPC ${name}`);
    },
  };
}

test("only the authenticated identity's no-argument status RPC is queried", async () => {
  const c = client();
  assert.equal(await getOwnSubscriptionStatus(c), "active");
  assert.deepEqual(c.calls, [["platform_current_subscription_status"]]);
});
test("unknown status, RPC error and network failure fail closed", async () => {
  for (const v of ["forged", null, { data: "expired", error: Error("network") }, Error("offline")]) {
    const c = client({ statuses: [v] });
    assert.equal((await resolveSubscriptionProfile(c)).status, "unavailable");
    assert.equal(c.calls.length, 1);
  }
});
test("expired, future and missing are distinct and never provision a profile", async () => {
  for (const value of ["expired", "not_started", "missing"]) {
    const c = client({ statuses: [value] });
    assert.deepEqual(await resolveSubscriptionProfile(c), { status: value, profile: null });
    assert.equal(c.calls.length, 1);
  }
});
test("unlinked registration is provisioned only when its final status is active", async () => {
  const c = client({ statuses: ["unlinked", "active"] });
  assert.equal((await resolveSubscriptionProfile(c)).status, "active");
  assert.deepEqual(c.calls.map(([name]) => name), ["platform_current_subscription_status", "ensure_profile_for_current_user", "platform_current_subscription_status"]);
  const failure = client({ statuses: ["unlinked", "unlinked"], ensureError: Error("invalid registration") });
  assert.equal((await resolveSubscriptionProfile(failure)).status, "profile_unavailable");
});
test("status is checked again after provisioning and identity must match", async () => {
  assert.equal((await resolveSubscriptionProfile(client({ statuses: ["active", "expired"] }))).status, "expired");
  assert.equal((await resolveSubscriptionProfile(client({ statuses: ["active", Error("offline")] }))).status, "unavailable");
  assert.equal((await resolveSubscriptionProfile(client({ profile: { id: "user-b", tenant_id: "tenant-b" } }))).status, "profile_unavailable");
  assert.equal((await resolveSubscriptionProfile(client({ profile: null }))).status, "profile_unavailable");
  assert.equal((await resolveSubscriptionProfile(client({ ensureError: Error("denied") }))).status, "profile_unavailable");
});
test("distinguishes missing session from session lookup failure", async () => {
  assert.equal((await resolveSubscriptionProfile(client({ session: null }))).status, "signed_out");
  assert.equal((await resolveSubscriptionProfile(client({ session: null, sessionError: Error("offline") }))).status, "unavailable");
});
test("hung requests are bounded and messages do not classify unverified cases as expired", async () => {
  await assert.rejects(withSubscriptionTimeout(() => new Promise(() => {}), 5), /timed out/);
  assert.match(subscriptionStatusMessage("expired", true), /بياناتك محفوظة/);
  assert.match(subscriptionStatusMessage("expired", false), /after renewal/);
  assert.match(subscriptionStatusMessage("unavailable", true), /لا يعني أن الاشتراك انتهى/);
  assert.match(subscriptionStatusMessage("unavailable", false), /does not mean the subscription has expired/);
  assert.match(subscriptionStatusMessage("not_started", false), /has not started/);
  assert.match(subscriptionStatusMessage("missing", false), /No subscription record/);
});
