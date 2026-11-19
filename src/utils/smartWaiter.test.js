import { test } from "node:test";
import assert from "node:assert/strict";
import { getSmartWaiterGreeting, getSmartWaiterPeriod, getSmartWaiterPromotionScope, getSmartWaiterSuggestions, hasUnsupportedDietaryConstraint, normalizeSmartWaiterText, parseSmartWaiterQuery } from "./smartWaiter.js";

const categories = [{ id: "drinks", name: "مشروبات", name_en: "Drinks" }, { id: "desserts", name: "حلويات", name_en: "Desserts" }];
const items = [
  { id: "coffee", name: "قهوة", name_en: "Coffee", category_id: "drinks", price: 18, available: true, recommendation_item_ids: ["cake"] },
  { id: "tea", name: "شاي", name_en: "Tea", category_id: "drinks", price: 8, available: true },
  { id: "cake", name: "كيك", name_en: "Cake", category_id: "desserts", price: 24, available: true },
  { id: "soldout", name: "قهوة أخرى", category_id: "drinks", price: 5, available: false },
  { id: "ingredient-blocked", name: "قهوة", category_id: "drinks", price: 5, available: true, isAvailableForSale: false },
];

test("bilingual time greetings follow local hour boundaries", () => {
  assert.equal(getSmartWaiterPeriod(4), "evening");
  assert.equal(getSmartWaiterPeriod(5), "morning");
  assert.equal(getSmartWaiterPeriod(12), "afternoon");
  assert.equal(getSmartWaiterPeriod(18), "evening");
  assert.equal(getSmartWaiterGreeting("en", 9), "Good morning!");
  assert.equal(getSmartWaiterGreeting("ar", 20), "مساء الخير!");
});

test("normalizes Arabic and Persian numerals and extracts explicit price limits", () => {
  assert.equal(normalizeSmartWaiterText("أقل من ٣٠ و ۹"), "اقل من 30 و 9");
  assert.equal(parseSmartWaiterQuery("قهوة أقل من ٣٠").budget, 30);
  assert.equal(parseSmartWaiterQuery("coffee under 12.5").budget, 12.5);
  assert.equal(parseSmartWaiterQuery("latte").budget, null);
});

test("cart pairings rank first, already ordered or unavailable items are excluded", () => {
  const result = getSmartWaiterSuggestions({ items, categories, cartItems: [{ id: "coffee", quantity: 1 }], hour: 8 });
  assert.deepEqual(result.map((entry) => entry.item.id), ["cake", "tea"]);
  assert.equal(result[0].reason, "pairing");
});

test("time of day and explicit price limit affect the recommendations", () => {
  const morning = getSmartWaiterSuggestions({ items, categories, hour: 8, limit: 1 });
  assert.equal(morning[0].item.id, "coffee");
  const evening = getSmartWaiterSuggestions({ items, categories, hour: 20, limit: 1 });
  assert.equal(evening[0].item.id, "tea");
  assert.deepEqual(getSmartWaiterSuggestions({ items, categories, query: "coffee under 10" }).map((entry) => entry.item.id), []);
  assert.deepEqual(getSmartWaiterSuggestions({ items, categories, budget: "١٠", hour: 12 }).map((entry) => entry.item.id), ["tea"]);
  assert.deepEqual(getSmartWaiterSuggestions({ items, categories, budget: 0 }).map((entry) => entry.item.id), []);
});

test("only targeted offers on available items are highlighted without price changes", () => {
  const promotions = [
    { title_ar: "عرض الحلوى", target_item_ids: ["cake", "soldout"] },
    { title_en: "Untargeted", target_item_ids: [] },
  ];
  const result = getSmartWaiterSuggestions({ items, categories, promotions, hour: 12 });
  assert.equal(result[0].item.id, "cake");
  assert.equal(result[0].reason, "promotion");
  assert.equal(result[0].item.price, 24);
  assert.equal(result.filter((entry) => entry.promotion).length, 1);
});

test("requested kinds, dismissed IDs and unknown requests fail safely", () => {
  assert.deepEqual(getSmartWaiterSuggestions({ items, categories, query: "dessert", dismissedIds: ["cake"] }), []);
  assert.deepEqual(getSmartWaiterSuggestions({ items, categories, query: "unlisted foodxyz" }), []);
  assert.deepEqual(getSmartWaiterSuggestions({ items, categories, query: "شاي" }).map((entry) => entry.item.id), ["tea"]);
  assert.deepEqual(getSmartWaiterSuggestions({ items: [] }), []);
});

test("allergy and exclusion requests never invert into unsafe positive matches", () => {
  const nuts = [{ id: "nuts", name: "مكسرات", name_en: "Peanuts", price: 5, available: true }];
  for (const query of ["no nuts", "without peanuts", "بدون مكسرات", "لدي حساسية من المكسرات", "nut-free", "I can't have peanuts", "خالي من الفول"]) {
    assert.equal(hasUnsupportedDietaryConstraint(query), true, query);
    assert.deepEqual(getSmartWaiterSuggestions({ items: nuts, query }), [], query);
  }
  assert.equal(hasUnsupportedDietaryConstraint("coffee under 10"), false);
});

test("promotion reads require a matching tenant, branch, and explicit public branch slug", () => {
  const tenant = { id: "tenant" };
  const branch = { id: "branch", tenant_id: "tenant", slug: "north" };
  assert.deepEqual(getSmartWaiterPromotionScope(tenant, branch, "north"), { tenantId: "tenant", branchId: "branch" });
  assert.equal(getSmartWaiterPromotionScope(tenant, branch, "south"), null);
  assert.equal(getSmartWaiterPromotionScope(tenant, { ...branch, tenant_id: "other" }, null), null);
  assert.equal(getSmartWaiterPromotionScope(tenant, null, null), null);
  assert.equal(getSmartWaiterPromotionScope(null, branch, null), null);
});
