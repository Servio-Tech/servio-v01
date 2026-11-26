import test from "node:test";
import assert from "node:assert/strict";
import { filterCashierOrders, getCashierOrderStatusCounts, sortCashierOrdersByPriority } from "./orderFilterLogic.js";

const makeOrder = (id, status, type = "table", paymentStatus = "unpaid") => ({
  id,
  status,
  payment_status: paymentStatus,
  is_completed: false,
  table_number: type === "takeaway" ? "Takeaway" : type === "cashier" ? "محلي" : "طاولة 4",
  items: [{ name: "قهوة", quantity: 1, price: 10 }],
});

const orders = [
  makeOrder("new-table", "pending"),
  makeOrder("prep-takeaway", "preparing", "takeaway"),
  makeOrder("ready-paid", "ready", "cashier", "paid"),
  makeOrder("awaiting", "awaiting_payment", "table"),
  makeOrder("legacy-ready-unpaid", "ready", "table", "unpaid"),
  makeOrder("cancelled", "cancelled"),
  { ...makeOrder("completed", "pending"), is_completed: true },
  { ...makeOrder("bad-items", "pending"), items: [] },
];

test("filters one unified active-order set by the requested status", () => {
  assert.deepEqual(filterCashierOrders(orders, "all", "all").map(({ id }) => id), [
    "new-table", "prep-takeaway", "ready-paid", "awaiting", "legacy-ready-unpaid",
  ]);
  assert.deepEqual(filterCashierOrders(orders, "all", "pending").map(({ id }) => id), ["new-table"]);
  assert.deepEqual(filterCashierOrders(orders, "all", "preparing").map(({ id }) => id), ["prep-takeaway"]);
  assert.deepEqual(filterCashierOrders(orders, "all", "ready").map(({ id }) => id), ["ready-paid"]);
  assert.deepEqual(filterCashierOrders(orders, "all", "awaiting_payment").map(({ id }) => id), ["awaiting", "legacy-ready-unpaid"]);
});

test("keeps order-type filters composable with status filters", () => {
  assert.deepEqual(filterCashierOrders(orders, "takeaway", "all").map(({ id }) => id), ["prep-takeaway"]);
  assert.deepEqual(filterCashierOrders(orders, "cashier", "ready").map(({ id }) => id), ["ready-paid"]);
});

test("status counts preserve the single-list totals and include payment fallbacks", () => {
  assert.deepEqual(getCashierOrderStatusCounts(orders), {
    all: 5,
    pending: 1,
    preparing: 1,
    ready: 1,
    awaiting_payment: 2,
  });
});

test("sorts work by status priority and oldest order first without mutating the queue", () => {
  const queue = [
    { ...makeOrder("ready", "ready", "table", "paid"), created_at: "2026-01-01T10:00:00Z" },
    { ...makeOrder("newest-pending", "pending"), created_at: "2026-01-01T10:05:00Z" },
    { ...makeOrder("old-pending", "pending"), created_at: "2026-01-01T10:00:00Z" },
    { ...makeOrder("payment", "awaiting_payment"), created_at: "2026-01-01T09:00:00Z" },
  ];

  assert.deepEqual(sortCashierOrdersByPriority(queue).map(({ id }) => id), [
    "old-pending", "newest-pending", "payment", "ready",
  ]);
  assert.equal(queue[0].id, "ready");
});
