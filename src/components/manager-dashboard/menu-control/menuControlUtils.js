import { normalizeAddonItemIds, normalizeAddonLimit, normalizeAddonOptions } from "../../../utils/menuItemOptions.js";

export function getOrderedItems(items) {
  return [...items].sort((a, b) =>
    (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER)
    || String(a.created_at).localeCompare(String(b.created_at))
  );
}

// Returns the complete branch order, or null when the requested move is invalid.
export function moveMenuItem(items, id, targetIndex) {
  const ordered = getOrderedItems(items);
  const from = ordered.findIndex((item) => item.id === id);
  if (from < 0 || targetIndex < 0 || targetIndex >= ordered.length || from === targetIndex) return null;
  const [moved] = ordered.splice(from, 1);
  ordered.splice(targetIndex, 0, moved);
  return ordered.map((item) => item.id);
}

export function getComplementSummary(item) {
  const count = normalizeAddonOptions(item.addon_options).length + normalizeAddonItemIds(item.free_addon_item_ids).length;
  return { count, limit: normalizeAddonLimit(item.max_addons, count) };
}

export function getAvailabilityState(item) {
  if (!item.available) return "unavailable";
  if (item.unavailableIngredients?.length || item.hasUnknownIngredient || item.isAvailableForSale === false) return "paused";
  return "available";
}

export function formatMenuPrice(price) {
  if (price === null || price === undefined || (typeof price === "string" && !price.trim()) || !Number.isFinite(Number(price))) return "—";
  return Number(price).toFixed(2);
}
