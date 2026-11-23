import test from "node:test";
import assert from "node:assert/strict";
import { clearSubscriptionAttempt, createSubscriptionAttempt, loadSubscriptionAttempt, sameSubscriptionPayload, saveSubscriptionAttempt } from "./subscriptionAttempts.js";

const payload = { tenant_id: "tenant-1", plan: "pro", starts_at: "2026-01-01T00:00:00.000Z", ends_at: "2026-12-31T23:59:59.999Z" };
const KEY = "40000000-0000-0000-0000-000000000004";
function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

test("pending subscription attempt persists its UUID and exact payload for replay", () => {
  const storage = memoryStorage();
  const attempt = createSubscriptionAttempt(payload, () => KEY);
  assert.equal(saveSubscriptionAttempt(attempt, storage), true);
  assert.deepEqual(loadSubscriptionAttempt(payload.tenant_id, storage), attempt);
  assert.equal(sameSubscriptionPayload(attempt.payload, payload), true);
  assert.equal(sameSubscriptionPayload(attempt.payload, { ...payload, plan: "starter" }), false);
  clearSubscriptionAttempt(payload.tenant_id, storage);
  assert.equal(loadSubscriptionAttempt(payload.tenant_id, storage), null);
});

test("invalid keys and corrupted stored attempts are rejected", () => {
  assert.throws(() => createSubscriptionAttempt(payload, () => "not-a-uuid"), /UUID/);
  const storage = memoryStorage();
  storage.setItem("servio.owner.subscription.pending.v1.tenant-1", JSON.stringify({ key: "bad", payload }));
  assert.equal(loadSubscriptionAttempt(payload.tenant_id, storage), null);
});
