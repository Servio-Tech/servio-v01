import test from "node:test";
import assert from "node:assert/strict";
import { formatMenuPrice, getAvailabilityState, getComplementSummary, getOrderedItems, moveMenuItem } from "./menuControlUtils.js";

const items = [
  { id: "b", sort_order: 1, created_at: "2026-01-02" },
  { id: "c", sort_order: null, created_at: "2026-01-03" },
  { id: "a", sort_order: 0, created_at: "2026-01-01" },
];

test("reordering uses the entire branch list and does not mutate its input", () => {
  assert.deepEqual(getOrderedItems(items).map((item) => item.id), ["a", "b", "c"]);
  assert.deepEqual(moveMenuItem(items, "c", 0), ["c", "a", "b"]);
  assert.deepEqual(moveMenuItem(items, "a", 1), ["b", "a", "c"]);
  assert.deepEqual(items.map((item) => item.id), ["b", "c", "a"]);
  assert.equal(moveMenuItem(items, "missing", 0), null);
  assert.equal(moveMenuItem(items, "a", -1), null);
  assert.equal(moveMenuItem(items, "a", 0), null);
});

test("availability distinguishes manual disablement and ingredient pauses", () => {
  assert.equal(getAvailabilityState({ available: false, unavailableIngredients: [{ name: "Milk" }] }), "unavailable");
  assert.equal(getAvailabilityState({ available: true, unavailableIngredients: [{ name: "Milk" }] }), "paused");
  assert.equal(getAvailabilityState({ available: true, hasUnknownIngredient: true }), "paused");
  assert.equal(getAvailabilityState({ available: true, isAvailableForSale: false }), "paused");
  assert.equal(getAvailabilityState({ available: true, isAvailableForSale: true }), "available");
});

test("complement counts are normalized and the limit is bounded by actual choices", () => {
  assert.deepEqual(getComplementSummary({ addon_options: [" Sauce ", "sauce", "Honey"], free_addon_item_ids: ["1", "1", "2"], max_addons: 10 }), { count: 4, limit: 4 });
  assert.deepEqual(getComplementSummary({}), { count: 0, limit: 0 });
});

test("prices preserve zero and do not invent values for absent or invalid data", () => {
  assert.equal(formatMenuPrice(0), "0.00");
  assert.equal(formatMenuPrice("12.5"), "12.50");
  assert.equal(formatMenuPrice(null), "—");
  assert.equal(formatMenuPrice(""), "—");
  assert.equal(formatMenuPrice("   "), "—");
  assert.equal(formatMenuPrice("invalid"), "—");
});
