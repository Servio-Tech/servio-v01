import test from "node:test";
import assert from "node:assert/strict";
import { getActivePromotions, isPromotionsUnavailableError, normalizePromotion, promotionStatus } from "./promotions.js";

test("public retrieval is scoped and projects a normalized safe response", async () => {
  let called;
  const supabase = { rpc: async (...args) => {
    called = args;
    return { data: [{ id: "p1", title_ar: "عرض", title_en: "Offer", description_ar: null, description_en: "Hello", target_item_ids: ["i1", "i1", "i2"], discount_type: "fixed", discount_value: "12.50", starts_at: null, ends_at: null, is_active: true, tenant_id: "secret", internal_note: "private" }], error: null };
  } };
  const result = await getActivePromotions(supabase, "tenant-1", "branch-1");
  assert.deepEqual(called, ["get_active_promotions", { p_tenant_id: "tenant-1", p_branch_id: "branch-1" }]);
  assert.deepEqual(result, [{ id: "p1", title_ar: "عرض", title_en: "Offer", description_ar: "", description_en: "Hello", target_item_ids: ["i1", "i2"], discount_type: "fixed", discount_value: 12.5, starts_at: null, ends_at: null, is_active: true }]);
});

test("an empty response is an array, but missing scope and migration errors are not silent", async () => {
  assert.deepEqual(await getActivePromotions({ rpc: async () => ({ data: [], error: null }) }, "t", "b"), []);
  await assert.rejects(() => getActivePromotions({ rpc: () => {} }, "t", ""), TypeError);
  await assert.rejects(() => getActivePromotions({ rpc: async () => ({ error: { code: "PGRST202", message: "missing function" } }) }, "t", "b"), { code: "PROMOTIONS_UNAVAILABLE" });
  const denied = { code: "42501", message: "permission denied" };
  await assert.rejects(() => getActivePromotions({ rpc: async () => ({ error: denied }) }, "t", "b"), (error) => error === denied);
  await assert.rejects(() => getActivePromotions({ rpc: async () => ({ data: {}, error: null }) }, "t", "b"), /Invalid promotions response/);
});

test("unavailable error detection does not mask generic database failures", () => {
  assert.equal(isPromotionsUnavailableError({ code: "42P01", message: "relation promotions does not exist" }), true);
  assert.equal(isPromotionsUnavailableError({ code: "42P01", message: "relation other does not exist" }), false);
  assert.equal(isPromotionsUnavailableError({ code: "42501", message: "permission denied" }), false);
  assert.equal(normalizePromotion().target_item_ids.length, 0);
});

test("status respects enablement and inclusive-start/exclusive-end boundaries", () => {
  const now = Date.parse("2026-11-19T12:00:00Z");
  assert.equal(promotionStatus({ is_active: false, starts_at: "2026-11-20T00:00:00Z" }, now), "disabled");
  assert.equal(promotionStatus({ is_active: true, starts_at: "2026-11-20T00:00:00Z" }, now), "scheduled");
  assert.equal(promotionStatus({ is_active: true, starts_at: "2026-11-19T12:00:00Z", ends_at: "2026-11-19T13:00:00Z" }, now), "active");
  assert.equal(promotionStatus({ is_active: true, ends_at: "2026-11-19T12:00:00Z" }, now), "expired");
});
