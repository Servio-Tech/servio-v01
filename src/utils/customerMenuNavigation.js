import { getCustomerTrackingPath } from "./customerTracking.js";

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
