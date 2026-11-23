const KEY_PREFIX = "servio.owner.subscription.pending.v1.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function browserStorage() {
  try { return globalThis.sessionStorage; } catch { return null; }
}

export function sameSubscriptionPayload(left, right) {
  return Boolean(left && right && left.tenant_id === right.tenant_id && left.plan === right.plan &&
    left.starts_at === right.starts_at && (left.ends_at ?? null) === (right.ends_at ?? null));
}

export function createSubscriptionAttempt(payload, uuid = () => globalThis.crypto.randomUUID()) {
  if (!payload?.tenant_id || typeof uuid !== "function") throw new TypeError("Invalid subscription attempt");
  const key = uuid();
  if (typeof key !== "string" || !UUID.test(key)) throw new TypeError("A UUID idempotency key is required");
  return { key, payload: { tenant_id: payload.tenant_id, plan: payload.plan, starts_at: payload.starts_at, ends_at: payload.ends_at ?? null } };
}

export function loadSubscriptionAttempt(tenantId, storage = browserStorage()) {
  if (!tenantId || !storage) return null;
  try {
    const raw = storage.getItem(`${KEY_PREFIX}${tenantId}`);
    if (!raw) return null;
    const attempt = JSON.parse(raw);
    if (!attempt || typeof attempt !== "object" || !UUID.test(attempt.key) || attempt.payload?.tenant_id !== tenantId ||
        !["starter", "pro"].includes(attempt.payload.plan) || typeof attempt.payload.starts_at !== "string" ||
        !(attempt.payload.ends_at === null || typeof attempt.payload.ends_at === "string")) {
      storage.removeItem(`${KEY_PREFIX}${tenantId}`);
      return null;
    }
    return attempt;
  } catch { return null; }
}

export function saveSubscriptionAttempt(attempt, storage = browserStorage()) {
  if (!storage || !attempt?.payload?.tenant_id || !UUID.test(attempt.key)) return false;
  try {
    storage.setItem(`${KEY_PREFIX}${attempt.payload.tenant_id}`, JSON.stringify(attempt));
    return true;
  } catch { return false; }
}

export function clearSubscriptionAttempt(tenantId, storage = browserStorage()) {
  if (!tenantId || !storage) return;
  try { storage.removeItem(`${KEY_PREFIX}${tenantId}`); } catch { /* in-memory state still protects this open dialog */ }
}
