export const ORDER_STATUSES = [
  { key: "pending", title: "newOrder", accent: "#d9541e" },
  { key: "preparing", title: "preparing", accent: "#2878c8" },
  { key: "ready", title: "ready", accent: "#159a68" },
  { key: "awaiting_payment", title: "unpaidOrders", accent: "#b66a00" },
];

// These are the same eligibility rules as the original live-order columns.
export function buildOrderQueue(orders) {
  const activeOrders = orders.filter((order) => (
    !order.is_completed &&
    Array.isArray(order.items) && order.items.length > 0 &&
    order.items.every((item) => item && String(item.name || "").trim() && item.quantity != null && item.price != null)
  ));
  const orderNumbers = new Map(
    [...orders]
      .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
      .map((order, index) => [order.id, index + 1]),
  );
  const groupedOrders = Object.fromEntries(ORDER_STATUSES.map(({ key }) => [key,
    activeOrders.filter((order) => key === "awaiting_payment"
      ? order.status === "awaiting_payment"
      : order.status === key && (key !== "ready" || order.payment_status === "paid")),
  ]));
  return {
    groupedOrders,
    orderNumbers,
    allVisibleOrders: ORDER_STATUSES.flatMap(({ key }) => groupedOrders[key]),
  };
}
