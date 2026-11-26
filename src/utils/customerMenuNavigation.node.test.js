import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCustomerMenuPath,
  buildCustomerMenuTrackingTarget,
  buildCustomerPagePath,
  getCustomerReviewUrl,
  preserveCustomerContext,
} from "./customerMenuNavigation.js";

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

test("customer page links retain the selected branch and table", () => {
  assert.equal(
    buildCustomerPagePath("cart", "cafe-name", "12", "?branch=north"),
    "/cart/cafe-name/12?branch=north",
  );
  assert.equal(
    buildCustomerPagePath("service", "cafe-name", "Cashier", "?branch=north"),
    "/service/cafe-name?cashier=1&branch=north",
  );
  assert.equal(
    buildCustomerMenuPath("cafe-name", "12", "?branch=north"),
    "/menu/cafe-name/12?branch=north",
  );
});

test("customer context adds the branch without duplicating existing route options", () => {
  assert.equal(
    preserveCustomerContext("/menu/cafe-name?cashier=1", "?branch=north&cashier=1"),
    "/menu/cafe-name?cashier=1&branch=north",
  );
});

test("review links allow only absolute HTTP(S) destinations", () => {
  assert.equal(getCustomerReviewUrl("https://maps.google.com/review"), "https://maps.google.com/review");
  assert.equal(getCustomerReviewUrl("javascript:alert(1)"), "");
  assert.equal(getCustomerReviewUrl(""), "");
});
