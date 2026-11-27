import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import OrderItemCard from "./OrderItemCard";
import { useOrders } from "../../../context/OrdersContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useStore } from "../../../context/StoreInfoContext";

jest.mock("../../../context/OrdersContext", () => ({ useOrders: jest.fn() }));
jest.mock("../../../context/LanguageContext", () => ({ useLanguage: jest.fn() }));
jest.mock("../../../context/StoreInfoContext", () => ({ useStore: jest.fn() }));
jest.mock("../../manager-dashboard/orders/OrderPill", () => ({ __esModule: true, default: () => null }));

const updateOrderStatus = jest.fn();
const updateOrderPaymentStatus = jest.fn();

const makeOrder = (overrides = {}) => ({
  id: "order-1",
  order_number: 17,
  table_number: "طاولة 4",
  status: "awaiting_payment",
  payment_status: "unpaid",
  payment_method: null,
  total_price: 12.5,
  items: [{ id: "item-1", name: "وجبة", quantity: 1, price: 12.5 }],
  created_at: new Date("2026-10-31T08:00:00.000Z"),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  useOrders.mockReturnValue({ updateOrderStatus, updateOrderPaymentStatus });
  useLanguage.mockReturnValue({ language: "ar", t: (key) => key });
  useStore.mockReturnValue({ storeInfo: { currency: "SAR" } });
  updateOrderPaymentStatus.mockResolvedValue({ data: { id: "order-1", payment_status: "paid" }, error: null });
  updateOrderStatus.mockResolvedValue({ data: { id: "order-1" }, error: null });
});

test("يعرض نافذة اختيار السداد حتى إذا كانت طريقة الدفع محددة مسبقًا", async () => {
  render(<OrderItemCard order={makeOrder({ status: "preparing", payment_method: "cash" })} />);

  fireEvent.click(screen.getByRole("button", { name: "مدفوع" }));
  expect(await screen.findByText("تسجيل سداد الطلب")).toBeTruthy();
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "طريقة الدفع" }));
  fireEvent.click(screen.getByRole("option", { name: "نقد" }));
  fireEvent.click(screen.getByRole("button", { name: "تأكيد السداد" }));
  await waitFor(() => expect(updateOrderPaymentStatus).toHaveBeenCalledWith("order-1", "paid", { method: "cash" }));
  expect(updateOrderStatus).not.toHaveBeenCalled();
});

test("يطلب طريقة الدفع داخل نافذة تسجيل السداد ولا يشترط اختيارها مسبقًا", async () => {
  render(<OrderItemCard order={makeOrder()} />);

  expect(screen.queryByRole("button", { name: "مدفوع" })).toBeNull();
  expect(screen.queryByRole("button", { name: "غير مدفوع" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "تسجيل السداد" }));
  expect(await screen.findByText("تسجيل سداد الطلب")).toBeTruthy();
  const paymentSelect = screen.getByRole("combobox", { name: "طريقة الدفع" });
  fireEvent.mouseDown(paymentSelect);
  expect(screen.getAllByRole("option").map((option) => option.textContent)).toContain("نقد");
  fireEvent.click(screen.getByRole("option", { name: "نقد" }));
  expect(updateOrderPaymentStatus).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "تأكيد السداد" }));
  await waitFor(() => expect(updateOrderPaymentStatus).toHaveBeenCalledWith("order-1", "paid", { method: "cash" }));
  expect(updateOrderStatus).not.toHaveBeenCalled();
});

test("يسمح بتغيير الدفع إلى غير مدفوع", async () => {
  render(<OrderItemCard order={makeOrder({
    status: "preparing",
    payment_status: "paid",
    payment_method: "cash",
  })} />);

  fireEvent.click(screen.getByRole("button", { name: "غير مدفوع" }));
  await waitFor(() => expect(updateOrderPaymentStatus).toHaveBeenCalledWith("order-1", "unpaid"));
});

test("يعيد تفعيل إجراءات الطلب ويعرض خطأ عند فشل تحديث الحالة", async () => {
  updateOrderStatus.mockRejectedValueOnce(new Error("network unavailable"));
  render(<OrderItemCard order={makeOrder({ status: "pending" })} />);

  const startButton = screen.getByRole("button", { name: "بدء التحضير" });
  fireEvent.click(startButton);

  expect(await screen.findByText("تعذر تحديث حالة الطلب. تحقق من الاتصال ثم أعد المحاولة.")).toBeTruthy();
  expect(startButton.disabled).toBe(false);
});

test("يعرض إجراء تسجيل السداد للطلب الجاهز غير المدفوع", () => {
  render(<OrderItemCard order={makeOrder({ status: "ready", payment_status: "unpaid" })} />);

  expect(screen.getByRole("button", { name: "تسجيل السداد" })).toBeTruthy();
});
