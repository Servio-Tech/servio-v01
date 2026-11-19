import test from "node:test";
import assert from "node:assert/strict";
import { buildOrderQueue } from "./orderQueue.js";

const items = [{ name: "Coffee", quantity: 1, price: 10 }];
const order = (id, status, extra = {}) => ({ id, status, items, is_completed: false, created_at: `2026-01-01T00:00:${String(id).padStart(2, "0")}Z`, ...extra });

test("keeps original status eligibility and prioritizes new orders in the combined queue", () => {
  const orders = [
    order(1, "preparing"),
    order(2, "pending"),
    order(3, "ready", { payment_status: "paid" }),
    order(4, "ready", { payment_status: "unpaid" }),
    order(5, "awaiting_payment", { payment_status: "unpaid" }),
    order(6, "awaiting_payment", { payment_status: "paid" }),
    order(7, "pending", { is_completed: true }),
    order(8, "pending", { items: [] }),
    order(9, "pending", { items: [{ name: "", quantity: 1, price: 5 }] }),
    order(10, "served"),
  ];
  const result = buildOrderQueue(orders);
  assert.deepEqual(result.allVisibleOrders.map(({ id }) => id), [2, 1, 3, 5, 6]);
  assert.deepEqual(Object.fromEntries(Object.entries(result.groupedOrders).map(([key, rows]) => [key, rows.length])), {
    pending: 1, preparing: 1, ready: 1, awaiting_payment: 2,
  });
});

test("numbers all orders chronologically as the original cards did", () => {
  const result = buildOrderQueue([order(3, "pending"), order(1, "served", { is_completed: true }), order(2, "preparing")]);
  assert.deepEqual([...result.orderNumbers.entries()], [[1, 1], [2, 2], [3, 3]]);
  assert.deepEqual(result.allVisibleOrders.map(({ id }) => id), [3, 2]);
});

test("returns empty groups for an empty queue", () => {
  const result = buildOrderQueue([]);
  assert.equal(result.allVisibleOrders.length, 0);
  assert.deepEqual(Object.values(result.groupedOrders).map((rows) => rows.length), [0, 0, 0, 0]);
});
