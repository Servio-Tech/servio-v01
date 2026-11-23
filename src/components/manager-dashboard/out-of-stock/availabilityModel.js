// This view consumes the menu context's effective availability; it never persists data itself.
export function scopeToBranch(rows = [], branchId) {
  if (!branchId) return [];
  return rows.filter((row) => row.branch_id && String(row.branch_id) === String(branchId));
}

export function linkedItemsByIngredient(items = []) {
  const result = new Map();
  items.forEach((item) => {
    new Set(item.ingredient_ids || []).forEach((id) => {
      const key = String(id);
      const linked = result.get(key) || [];
      linked.push(item);
      result.set(key, linked);
    });
  });
  return result;
}

export function summarizeAvailability(ingredients = [], items = []) {
  return {
    ingredientTotal: ingredients.length,
    ingredientUnavailable: ingredients.filter((ingredient) => ingredient.available !== true).length,
    itemTotal: items.length,
    itemAvailable: items.filter((item) => item.isAvailableForSale === true).length,
    itemUnavailable: items.filter((item) => item.isAvailableForSale !== true).length,
    itemAffected: items.filter((item) => (item.unavailableIngredients || []).length > 0).length,
    itemUnknown: items.filter((item) => item.hasUnknownIngredient).length,
  };
}

export function filterAndSortAvailability(rows, { type, query = "", status = "all", sort = "unavailable", linkedItems = new Map(), locale = "ar" }) {
  const needle = query.trim().toLocaleLowerCase(locale);
  const isAvailable = (row) => type === "ingredient" ? row.available === true : row.isAvailableForSale === true;
  return [...rows].filter((row) => {
    if (status === "available" && !isAvailable(row)) return false;
    if (status === "unavailable" && isAvailable(row)) return false;
    if (!needle) return true;
    const related = type === "ingredient"
      ? (linkedItems.get(String(row.id)) || []).map((item) => item.name)
      : (row.ingredients || []).map((ingredient) => ingredient.name);
    return [row.name, ...related].filter(Boolean).join(" ").toLocaleLowerCase(locale).includes(needle);
  }).sort((a, b) => {
    if (sort === "unavailable" && isAvailable(a) !== isAvailable(b)) return isAvailable(a) ? 1 : -1;
    const comparison = String(a.name || "").localeCompare(String(b.name || ""), locale);
    return sort === "name-desc" ? -comparison : comparison;
  });
}

// Make missing or mismatched branch data fail closed before invoking a context write.
export async function runScopedAction(branchId, recordBranchId, action) {
  if (!branchId || (recordBranchId != null && String(recordBranchId) !== String(branchId))) {
    return { error: new Error("Branch mismatch or branch not selected") };
  }
  try {
    const result = await action();
    return result || { error: new Error("The operation did not return a result") };
  } catch (error) {
    return { error };
  }
}
