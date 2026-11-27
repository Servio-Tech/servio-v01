import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  base64UrlToUint8Array,
  subscriptionUsesApplicationServerKey,
} from "./pushNotifications.js";

describe("Web Push subscription helpers", () => {
  test("converts base64url VAPID keys into bytes", () => {
    assert.deepEqual(Array.from(base64UrlToUint8Array("AQIDBA")), [1, 2, 3, 4]);
    assert.throws(() => base64UrlToUint8Array(""), /required/);
  });

  test("detects whether an existing subscription uses the current VAPID key", () => {
    const subscription = { options: { applicationServerKey: Uint8Array.from([1, 2, 3, 4]).buffer } };
    assert.equal(subscriptionUsesApplicationServerKey(subscription, "AQIDBA"), true);
    assert.equal(subscriptionUsesApplicationServerKey(subscription, "BQIDBA"), false);
    assert.equal(subscriptionUsesApplicationServerKey({ options: {} }, "AQIDBA"), false);
  });

  test("compares typed-array views without reading bytes outside their bounds", () => {
    const backing = Uint8Array.from([99, 1, 2, 3, 4, 99]);
    const subscription = { options: { applicationServerKey: backing.subarray(1, 5) } };
    assert.equal(subscriptionUsesApplicationServerKey(subscription, "AQIDBA"), true);
  });
});
