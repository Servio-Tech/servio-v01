import assert from "node:assert/strict";
import { test } from "node:test";
import vapidPublicKey from "./vapid-public-key.js";

function makeResponse() {
  return {
    statusCode: 200,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("VAPID public-key route loads and returns only the configured public key", () => {
  const prior = process.env.VAPID_PUBLIC_KEY;
  process.env.VAPID_PUBLIC_KEY = "public-vapid-key";
  const response = makeResponse();
  try {
    vapidPublicKey({ method: "GET" }, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, { publicKey: "public-vapid-key" });
  } finally {
    if (prior === undefined) delete process.env.VAPID_PUBLIC_KEY;
    else process.env.VAPID_PUBLIC_KEY = prior;
  }
});
