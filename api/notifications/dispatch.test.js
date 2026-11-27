import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { createNotificationDispatcher } from "./dispatch.js";

const secret = "test-webhook-secret";
const event = { event_type: "order", event_id: "00000000-0000-4000-8000-000000000002" };
const oneDelivery = {
  subscription_id: "00000000-0000-4000-8000-000000000001",
  push_subscription: { endpoint: "https://push.example.test/endpoint", keys: { p256dh: "public-key", auth: "auth-key" } },
  notification_title: "New order",
  notification_body: "New order — Table 4",
  notification_url: "/dashboard",
};

function makeResponse() {
  return {
    headers: {}, statusCode: 200, body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

function makeRequest({ method = "POST", authorization = `Bearer ${secret}`, body = event } = {}) {
  return { method, headers: { authorization }, body };
}

function setup({ deliveries = [oneDelivery], sendNotification, env = {} } = {}) {
  const rpcCalls = [];
  const rpc = async (name, args) => {
    rpcCalls.push([name, args]);
    if (name === "claim_cashier_notification_deliveries") return { data: deliveries, error: null };
    return { data: true, error: null };
  };
  const clientCalls = [];
  const createClientFn = (...args) => { clientCalls.push(args); return { rpc }; };
  const pushCalls = [];
  const push = {
    setVapidDetails: (...args) => pushCalls.push(["vapid", ...args]),
    sendNotification: sendNotification || (async (...args) => { pushCalls.push(["send", ...args]); return { statusCode: 201 }; }),
  };
  const baseEnv = {
    NOTIFY_WEBHOOK_SECRET: secret,
    VAPID_PUBLIC_KEY: "public-vapid-key",
    VAPID_PRIVATE_KEY: "private-vapid-key",
    VAPID_SUBJECT: "mailto:alerts@example.test",
    VITE_SUPABASE_URL: "https://project.supabase.co",
    VITE_SUPABASE_KEY: "public-anon-key",
    ...env,
  };
  const dispatcher = createNotificationDispatcher({
    createClientFn, push, env: baseEnv, logger: { error() {} }, pause: async () => {},
  });
  return { dispatcher, rpcCalls, clientCalls, pushCalls };
}

let response;
beforeEach(() => { response = makeResponse(); });

describe("notification dispatch", () => {
  test("rejects requests without the correct webhook secret before database access", async () => {
    const { dispatcher, clientCalls } = setup();
    await dispatcher(makeRequest({ authorization: "Bearer wrong-secret" }), response);
    assert.equal(response.statusCode, 401);
    assert.equal(clientCalls.length, 0);
  });

  test("accepts only supported event types and UUID identifiers", async () => {
    const { dispatcher, rpcCalls } = setup();
    await dispatcher(makeRequest({ body: { event_type: "order_update", event_id: event.event_id } }), response);
    assert.equal(response.statusCode, 400);
    assert.equal(rpcCalls.length, 0);
  });

  test("uses Vite Supabase configuration and sends only the minimal notification payload", async () => {
    const { dispatcher, rpcCalls, clientCalls, pushCalls } = setup({
      env: { VITE_SUPABASE_URL: "https://project.supabase.co", VITE_SUPABASE_KEY: "public-anon-key" },
    });
    await dispatcher(makeRequest(), response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(clientCalls[0].slice(0, 2), ["https://project.supabase.co", "public-anon-key"]);
    assert.deepEqual(rpcCalls[0], ["claim_cashier_notification_deliveries", {
      p_secret: secret, p_event_type: "order", p_event_id: event.event_id,
    }]);
    const [, , payloadString] = pushCalls.find(([kind]) => kind === "send");
    const payload = JSON.parse(payloadString);
    assert.deepEqual(payload, {
      title: "New order", body: "New order — Table 4", url: "/dashboard", tag: `servio-order-${event.event_id}`,
    });
    assert.doesNotMatch(JSON.stringify(payload), /customer|phone|price|items/i);
    assert.equal(rpcCalls[1][0], "record_cashier_notification_delivery");
    assert.equal(rpcCalls[1][1].p_status, "sent");
    assert.deepEqual(response.body, { accepted: true, delivered: 1, failed: 0, expired: 0 });
  });

  test("does not deliver an event that has already been claimed", async () => {
    const { dispatcher, pushCalls } = setup({ deliveries: [] });
    await dispatcher(makeRequest(), response);
    assert.deepEqual(response.body, { accepted: true, delivered: 0, failed: 0, expired: 0 });
    assert.equal(pushCalls.some(([kind]) => kind === "send"), false);
  });

  test("retries transient provider failures before recording a successful delivery", async () => {
    let attempts = 0;
    const { dispatcher, rpcCalls } = setup({
      sendNotification: async () => {
        attempts += 1;
        if (attempts < 3) throw { statusCode: 503 };
        return { statusCode: 201 };
      },
    });
    await dispatcher(makeRequest(), response);
    assert.equal(attempts, 3);
    assert.equal(response.body.delivered, 1);
    assert.equal(rpcCalls[1][1].p_status, "sent");
  });

  test("marks expired endpoints for cleanup after provider 404 or 410", async () => {
    const { dispatcher, rpcCalls } = setup({ sendNotification: async () => { throw { statusCode: 410 }; } });
    await dispatcher(makeRequest(), response);
    assert.equal(response.body.expired, 1);
    assert.equal(rpcCalls[1][1].p_status, "expired");
    assert.equal(rpcCalls[1][1].p_http_status, 410);
  });

  test("does not process ordinary order updates as notification events", async () => {
    const { dispatcher } = setup();
    await dispatcher(makeRequest({ body: { event_type: "waiter_call_resolved", event_id: event.event_id } }), response);
    assert.equal(response.statusCode, 400);
  });
});
