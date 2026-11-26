import { getCustomerTrackingPath } from "./customerTracking.js";
import { buildMenuReturnPath } from "./orderTrackingRoutes.js";

export function preserveCustomerContext(path, search = "") {
  const [pathname, existingQuery = ""] = path.split("?");
  const query = new URLSearchParams(existingQuery);
  const currentQuery = new URLSearchParams(search);
  const branch = currentQuery.get("branch");
  if (branch && !query.has("branch")) query.set("branch", branch);
  const serializedQuery = query.toString();
  return serializedQuery ? `${pathname}?${serializedQuery}` : pathname;
}

export function buildCustomerPagePath(page, slug, tableNumber, search = "") {
  const normalizedTable = String(tableNumber || "").trim();
  const isCashier = /^(cashier|كاشير)$/i.test(normalizedTable);
  let path = `/${page}/${encodeURIComponent(String(slug || ""))}`;
  if (normalizedTable && !isCashier) path += `/${encodeURIComponent(normalizedTable)}`;
  if (isCashier) path += "?cashier=1";
  return preserveCustomerContext(path, search);
}

export function buildCustomerMenuPath(slug, tableNumber, search = "") {
  return preserveCustomerContext(buildMenuReturnPath(slug, tableNumber), search);
}

export function getCustomerReviewUrl(value) {
  const reviewUrl = String(value || "").trim();
  if (!reviewUrl) return "";
  try {
    const parsedUrl = new URL(reviewUrl);
    return ["http:", "https:"].includes(parsedUrl.protocol) ? parsedUrl.href : "";
  } catch {
    return "";
  }
}

export function buildCustomerMenuTrackingTarget(slug, record) {
  const usableRecord = record?.orderId && record?.trackingToken ? record : null;
  const target = { path: getCustomerTrackingPath(slug, usableRecord) };
  if (usableRecord) {
    target.state = {
      trackingToken: String(usableRecord.trackingToken),
      tableNumber: usableRecord.tableNumber || null,
    };
  }
  return target;
}
