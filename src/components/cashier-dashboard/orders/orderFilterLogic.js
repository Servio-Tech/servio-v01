import { getOrderType } from "./orderBellLogic.js";

const LIVE_ORDER_STATUSES = new Set(["pending", "preparing", "ready", "awaiting_payment"]);

const isRenderableOrder = (order) => (
  order &&
  LIVE_ORDER_STATUSES.has(order.status) &&
  !order.is_completed &&
  Array.isArray(order.items) &&
  order.items.length > 0 &&
  order.items.every((item) => item && String(item.name || "").trim() && item.quantity != null && item.price != null)
);

export function getActiveCashierOrders(orders = []) {
  return orders.filter(isRenderableOrder);
}

export function matchesCashierOrderStatus(order, statusFilter = "all") {
  if (statusFilter === "all") return true;
  if (statusFilter === "awaiting_payment") {
    return order.status === "awaiting_payment" || (order.status === "ready" && order.payment_status !== "paid");
  }
  if (statusFilter === "ready") {
    return order.status === "ready" && order.payment_status === "paid";
  }
  return order.status === statusFilter;
}

export function filterCashierOrders(orders = [], orderTypeFilter = "all", statusFilter = "all") {
  return getActiveCashierOrders(orders).filter((order) => (
    (orderTypeFilter === "all" || getOrderType(order) === orderTypeFilter) &&
    matchesCashierOrderStatus(order, statusFilter)
  ));
}

export function sortCashierOrdersByPriority(orders = []) {
  const priority = (order) => {
    if (order.status === "pending") return 0;
    if (order.status === "preparing") return 1;
    if (order.status === "awaiting_payment" || (order.status === "ready" && order.payment_status !== "paid")) return 2;
    return 3;
  };
  return [...orders].sort((a, b) => {
    const priorityDifference = priority(a) - priority(b);
    if (priorityDifference) return priorityDifference;
    const aCreatedAt = Date.parse(a.created_at || "");
    const bCreatedAt = Date.parse(b.created_at || "");
    const aTime = Number.isFinite(aCreatedAt) ? aCreatedAt : Number.MAX_SAFE_INTEGER;
    const bTime = Number.isFinite(bCreatedAt) ? bCreatedAt : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });
}

export function getCashierOrderStatusCounts(orders = []) {
  const active = getActiveCashierOrders(orders);
  return {
    all: active.length,
    pending: active.filter((order) => matchesCashierOrderStatus(order, "pending")).length,
    preparing: active.filter((order) => matchesCashierOrderStatus(order, "preparing")).length,
    ready: active.filter((order) => matchesCashierOrderStatus(order, "ready")).length,
    awaiting_payment: active.filter((order) => matchesCashierOrderStatus(order, "awaiting_payment")).length,
  };
}
