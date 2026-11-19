import test from "node:test";
import assert from "node:assert/strict";
import { tableQrUrl, cashierQrUrl, contrastAgainstWhite, textOnColor } from "./qrUtils.js";

test("table URLs preserve the public route and encode the current branch", () => {
  assert.equal(tableQrUrl("https://example.com", "my-cafe", 12, "north & east"), "https://example.com/menu/my-cafe/12?branch=north%20%26%20east");
  assert.equal(tableQrUrl("https://example.com", "my-cafe", 1, null), "https://example.com/menu/my-cafe/1?branch=main");
  assert.equal(tableQrUrl("https://example.com", "", 1, "main"), "");
});

test("cashier URL retains cashier mode and branch", () => {
  assert.equal(cashierQrUrl("https://example.com", "my-cafe", "patio"), "https://example.com/menu/my-cafe?branch=patio&cashier=1");
});

test("contrast helper identifies unsafe QR ink and readable accent text", () => {
  assert.equal(contrastAgainstWhite("#ffffff"), 1);
  assert.ok(contrastAgainstWhite("#000000") >= 20.9);
  assert.ok(contrastAgainstWhite("#d9541e") < 4.5);
  assert.equal(textOnColor("#000000"), "#ffffff");
  assert.equal(textOnColor("#ffffff"), "#111111");
});
