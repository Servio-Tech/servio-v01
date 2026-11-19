// Legacy orders can contain missing or malformed line items. Hide item-derived
// metrics rather than relying on the legacy aggregator's fallback quantity/price.
export function hasCompleteItemData(orders) {
  return orders.every((order) => {
    let items = order.items;
    try { if (typeof items === "string") items = JSON.parse(items); } catch { return false; }
    if (!Array.isArray(items) || items.length === 0) return false;
    const lines = [];
    for (let item of items) {
      try { if (typeof item === "string") item = JSON.parse(item); } catch { return false; }
      if (Array.isArray(item)) lines.push(...item);
      else lines.push(item);
    }
    return lines.length > 0 && lines.every((item) => item && typeof item === "object" && !Array.isArray(item)
      && typeof item.name === "string" && item.name.trim()
      && item.quantity !== null && item.quantity !== undefined && String(item.quantity).trim() !== ""
      && Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0
      && item.price !== null && item.price !== undefined && String(item.price).trim() !== ""
      && Number.isFinite(Number(item.price)) && Number(item.price) >= 0);
  });
}
