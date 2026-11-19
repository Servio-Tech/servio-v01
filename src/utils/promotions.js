// Public data is deliberately projected instead of spreading the server response.
export function normalizePromotion(row = {}) {
  const value = Number(row.discount_value);
  return {
    id: row.id == null ? "" : String(row.id),
    title_ar: String(row.title_ar || ""),
    title_en: String(row.title_en || ""),
    description_ar: String(row.description_ar || ""),
    description_en: String(row.description_en || ""),
    target_item_ids: Array.isArray(row.target_item_ids)
      ? [...new Set(row.target_item_ids.filter((id) => id != null).map(String).filter(Boolean))]
      : [],
    discount_type: row.discount_type === "fixed" ? "fixed" : "percentage",
    discount_value: Number.isFinite(value) ? value : 0,
    starts_at: row.starts_at || null,
    ends_at: row.ends_at || null,
    is_active: row.is_active === true,
  };
}

export function isPromotionsUnavailableError(error) {
  if (!error) return false;
  if (error.code === "PROMOTIONS_UNAVAILABLE" || error.code === "PGRST202" || error.code === "42883") return true;
  return (error.code === "42P01" || error.code === "PGRST205") && /promotion/i.test(String(error.message || ""));
}

/**
 * Returns active, orderable offers for one tenant/branch, evaluated by the server.
 * Missing migration and other RPC errors are thrown, never silently represented as no offers.
 */
export async function getActivePromotions(supabase, tenantId, branchId) {
  if (!supabase || typeof supabase.rpc !== "function" || !tenantId || !branchId) {
    throw new TypeError("A Supabase client, tenant ID and branch ID are required to load promotions.");
  }
  const { data, error } = await supabase.rpc("get_active_promotions", {
    p_tenant_id: tenantId,
    p_branch_id: branchId,
  });
  if (error) {
    if (isPromotionsUnavailableError(error)) {
      const unavailable = new Error("Promotions are unavailable until the promotions database migration is applied.", { cause: error });
      unavailable.code = "PROMOTIONS_UNAVAILABLE";
      throw unavailable;
    }
    throw error;
  }
  if (data != null && !Array.isArray(data)) throw new Error("Invalid promotions response.");
  return (data || []).map(normalizePromotion);
}

export function promotionStatus(promotion, now = Date.now()) {
  if (!promotion.is_active) return "disabled";
  if (promotion.ends_at && new Date(promotion.ends_at).getTime() <= now) return "expired";
  if (promotion.starts_at && new Date(promotion.starts_at).getTime() > now) return "scheduled";
  return "active";
}
