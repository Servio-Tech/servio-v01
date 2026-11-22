import test from "node:test";
import assert from "node:assert/strict";
import { createOrderEventSelector, createOrderFlashQueue, getOrderType } from "./orderBellLogic.js";

const row = (id, createdAt = "2026-01-01T00:00:02Z", branch = "b") => ({ id, tenant_id: "t", branch_id: branch, created_at: createdAt });
const event = (order, eventType = "INSERT") => ({ eventType, new: order });
const startedAt = Date.parse("2026-01-01T00:00:01Z");

test("snapshot rows, duplicates, changes and other branches do not notify", () => {
  const selector = createOrderEventSelector({ tenantId: "t", branchId: "b", startedAt });
  const old = row("old", "2026-01-01T00:00:00Z");
  assert.deepEqual(selector.receive(event(old)), []);
  assert.deepEqual(selector.prime([old]), []);
  assert.deepEqual(selector.receive(event(old)), []);
  assert.deepEqual(selector.receive(event(row("update"), "UPDATE")), []);
  assert.deepEqual(selector.receive(event(row("elsewhere", undefined, "other"))), []);
  assert.deepEqual(selector.receive(event({ ...row("wrong-tenant"), tenant_id: "other" })), []);
  assert.deepEqual(selector.receive(event(row("fresh"))), [row("fresh")]);
  assert.deepEqual(selector.receive(event(row("fresh"))), []);
});

test("distinct simultaneous INSERTs during initial loading are retained once", () => {
  const selector = createOrderEventSelector({ tenantId: "t", branchId: "b", startedAt });
  const first = row("first");
  const second = row("second");
  selector.receive(event(first));
  selector.receive(event(second));
  selector.receive(event(first));
  assert.deepEqual(selector.prime([row("old", "2026-01-01T00:00:00Z"), first, second]), [first, second]);
  assert.deepEqual(selector.prime([]), []);
  assert.deepEqual(selector.receive(event(second)), []);
});

test("an INSERT delivered after its row enters the first snapshot is not lost", () => {
  const selector = createOrderEventSelector({ tenantId: "t", branchId: "b", startedAt });
  const arrivedDuringLoad = row("late-event");
  selector.prime([arrivedDuringLoad]);
  assert.deepEqual(selector.receive(event(arrivedDuringLoad)), [arrivedDuringLoad]);
  assert.deepEqual(selector.receive(event(arrivedDuringLoad)), []);
});

test("queued orders each get exactly five distinct on/off cycles", () => {
  const scheduled = [];
  const timers = { setTimeout(fn) { scheduled.push(fn); return fn; }, clearTimeout(fn) { const index = scheduled.indexOf(fn); if (index >= 0) scheduled.splice(index, 1); } };
  const states = [];
  const flashes = createOrderFlashQueue((state) => states.push(state), timers);
  flashes.enqueue(row("one"));
  flashes.enqueue(row("two"));
  while (scheduled.length) scheduled.shift()();
  for (const id of ["one", "two"]) {
    const sequence = states.filter((state) => state.order?.id === id);
    assert.deepEqual(sequence.map((state) => state.lit), [true, false, true, false, true, false, true, false, true, false]);
    assert.deepEqual(sequence.filter((state) => state.lit).map((state) => state.cycle), [1, 2, 3, 4, 5]);
  }
  assert.equal(states.at(-1).active, false);
});

test("stopping the queue cancels timers and type filters cover Arabic and English", () => {
  const scheduled = [];
  const timers = { setTimeout(fn) { scheduled.push(fn); return fn; }, clearTimeout(fn) { scheduled.splice(scheduled.indexOf(fn), 1); } };
  const states = [];
  const flashes = createOrderFlashQueue((state) => states.push(state), timers);
  flashes.enqueue(row("one"));
  flashes.stop();
  assert.equal(scheduled.length, 0);
  assert.equal(states.length, 1);
  assert.equal(getOrderType({ table_number: "محلي - 3" }), "cashier");
  assert.equal(getOrderType({ table_number: "Dine-in - 3" }), "cashier");
  assert.equal(getOrderType({ table_number: "سفري" }), "takeaway");
  assert.equal(getOrderType({ table_number: "17" }), "table");
});
