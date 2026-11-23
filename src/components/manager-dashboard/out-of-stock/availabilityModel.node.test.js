import test from "node:test";
import assert from "node:assert/strict";
import { withIngredientAvailability } from "../../../utils/menuAvailability.js";
import { canChangeAvailability, filterAndSortAvailability, linkedItemsByIngredient, runScopedAction, scopeToBranch, summarizeAvailability } from "./availabilityModel.js";

const ingredients = [
  { id: "milk", name: "حليب", available: true, branch_id: "a" },
  { id: "coffee", name: "قهوة", available: false, branch_id: "a" },
  { id: "other", name: "مكون آخر", available: false, branch_id: "b" },
];
const rawItems = [
  { id: "latte", name: "لاتيه", available: true, branch_id: "a" },
  { id: "tea", name: "شاي", available: true, branch_id: "a" },
  { id: "disabled", name: "موقوف", available: false, branch_id: "a" },
  { id: "unknown", name: "مجهول", available: true, branch_id: "a" },
  { id: "other-item", name: "صنف فرع آخر", available: true, branch_id: "b" },
];
const links = [
  { menu_item_id: "latte", ingredient_id: "milk" },
  { menu_item_id: "latte", ingredient_id: "coffee" },
  { menu_item_id: "disabled", ingredient_id: "coffee" },
  { menu_item_id: "unknown", ingredient_id: "missing" },
];
const items = withIngredientAvailability(rawItems, ingredients, links);
const branchIngredients = scopeToBranch(ingredients, "a");
const branchItems = scopeToBranch(items, "a");

test("selected branch is required and other branches never appear", () => {
  assert.deepEqual(scopeToBranch(ingredients, null), []);
  assert.deepEqual(branchIngredients.map((row) => row.id), ["milk", "coffee"]);
  assert.deepEqual(scopeToBranch(items, "b").map((row) => row.id), ["other-item"]);
});

test("summary separates effective status, missing links and manually disabled items", () => {
  assert.deepEqual(summarizeAvailability(branchIngredients, branchItems), {
    ingredientTotal: 2, ingredientUnavailable: 1, itemTotal: 4,
    itemAvailable: 1, itemUnavailable: 3, itemAffected: 2, itemUnknown: 1,
  });
  assert.equal(branchItems.find((item) => item.id === "latte").isAvailableForSale, false);
  assert.equal(branchItems.find((item) => item.id === "unknown").hasUnknownIngredient, true);
  assert.equal(branchItems.find((item) => item.id === "disabled").available, false);
});

test("restoring ingredient availability does not override a manual stop or an unknown link", () => {
  const restored = withIngredientAvailability(rawItems, ingredients.map((row) => row.id === "coffee" ? { ...row, available: true } : row), links);
  assert.equal(restored.find((item) => item.id === "latte").isAvailableForSale, true);
  assert.equal(restored.find((item) => item.id === "disabled").isAvailableForSale, false);
  assert.equal(restored.find((item) => item.id === "unknown").isAvailableForSale, false);
});

test("search traverses links in both directions, filters effective state and sorts unavailable first", () => {
  const linkedItems = linkedItemsByIngredient(branchItems);
  const ingredientResults = filterAndSortAvailability(branchIngredients, { type: "ingredient", query: "لاتيه", linkedItems });
  assert.deepEqual(new Set(ingredientResults.map((row) => row.id)), new Set(["milk", "coffee"]));
  const itemResults = filterAndSortAvailability(branchItems, { type: "item", query: "قهوة", status: "unavailable", linkedItems });
  assert.deepEqual(new Set(itemResults.map((row) => row.id)), new Set(["latte", "disabled"]));
  const sorted = filterAndSortAvailability(branchIngredients, { type: "ingredient", sort: "unavailable", linkedItems });
  assert.equal(sorted[0].id, "coffee");
  assert.deepEqual(filterAndSortAvailability(branchItems, { type: "item", status: "available", linkedItems }).map((row) => row.id), ["tea"]);
});

test("branch guard blocks mismatched writes and preserves errors from failed calls", async () => {
  let calls = 0;
  const action = async () => { calls += 1; return { error: null }; };
  assert.ok((await runScopedAction(null, "a", action)).error);
  assert.ok((await runScopedAction("a", "b", action)).error);
  assert.equal(calls, 0);
  assert.equal((await runScopedAction("a", "a", action)).error, null);
  assert.equal(calls, 1);
  const networkError = new Error("network disconnected");
  assert.equal((await runScopedAction("a", "a", async () => { throw networkError; })).error, networkError);
  assert.equal((await runScopedAction("a", "a", async () => ({ error: networkError }))).error, networkError);
  assert.ok((await runScopedAction("a", "a", async () => undefined)).error);
});

test("cashiers can toggle manual item availability, while ingredient changes require manager permission", () => {
  const item = { branch_id: "a" };
  const ingredient = { branch_id: "a" };
  assert.equal(canChangeAvailability({ type: "item", record: item, branchId: "a" }), true);
  assert.equal(canChangeAvailability({ type: "ingredient", record: ingredient, branchId: "a" }), false);
  assert.equal(canChangeAvailability({ type: "ingredient", canManage: true, record: ingredient, branchId: "a" }), true);
  assert.equal(canChangeAvailability({ type: "item", record: item, branchId: "b" }), false);
  assert.equal(canChangeAvailability({ type: "item", record: item, branchId: "a", writesDisabled: true }), false);
});
