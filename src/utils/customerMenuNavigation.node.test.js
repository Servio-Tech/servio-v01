import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomerMenuTrackingTarget } from "./customerMenuNavigation.js";

test("customer menu tracking keeps the token out of the URL", () => {
  const target = buildCustomerMenuTrackingTarget("coffee-house", {
    orderId: "order-123",
    trackingToken: "secret-token",
    tableNumber: "4",
  });
  assert.equal(target.path, "/track/coffee-house/order-123");
  assert.equal(target.path.includes("secret-token"), false);
  assert.deepEqual(target.state, { trackingToken: "secret-token", tableNumber: "4" });
});

test("customer menu tracking falls back to the slug route without inventing a token", () => {
  const target = buildCustomerMenuTrackingTarget("coffee-house", null);
  assert.equal(target.path, "/track/coffee-house");
  assert.equal(Object.hasOwn(target, "state"), false);
});

test("a record without its saved token is not used as an order-specific route", () => {
  const target = buildCustomerMenuTrackingTarget("coffee-house", {
    orderId: "order-123",
    trackingToken: "",
  });
  assert.equal(target.path, "/track/coffee-house");
  assert.equal(Object.hasOwn(target, "state"), false);
});
