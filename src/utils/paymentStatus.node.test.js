import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createOrderPaymentSettlementUpdate } from "./paymentStatus.js";

const timestamp = "2026-11-27T15:00:00.000Z";
const fixedNow = () => new Date(timestamp);

describe("cashier payment settlement", () => {
  test("marks awaiting-payment orders paid and completed without returning them to ready", () => {
    const update = createOrderPaymentSettlementUpdate(
      { status: "awaiting_payment", payment_status: "unpaid", total_price: 12.5 },
      { method: "cash" },
      fixedNow,
    );
    assert.deepEqual(update, {
      payment_status: "paid",
      paid_at: timestamp,
      payment_method: "cash",
      cash_amount: 12.5,
      card_amount: 0,
      status: "served",
      is_completed: true,
      completed_at: timestamp,
    });
  });

  test("requires a method at settlement time", () => {
    assert.throws(() => createOrderPaymentSettlementUpdate(
      { status: "awaiting_payment", payment_status: "unpaid", total_price: 12.5 },
      null,
      fixedNow,
    ), /اختر طريقة الدفع/);
  });

  test("does not change the workflow status of an unpaid ready order settled at the counter", () => {
    const update = createOrderPaymentSettlementUpdate(
      { status: "ready", payment_status: "unpaid", total_price: 12.5 },
      { method: "card" },
      fixedNow,
    );
    assert.equal(update.payment_status, "paid");
    assert.equal(update.payment_method, "card");
    assert.equal("status" in update, false);
  });
});
