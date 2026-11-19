import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CartDrawer from "./CartDrawer";
import CartItemCard from "./CartItemCard";
import FloatingCartBar from "./FloatingCartBar";
import { useCart } from "../../context/CartContext";
import { useOrders } from "../../context/OrdersContext";
import { useTenant } from "../../context/TenantContext";
import { useBranch } from "../../context/BranchContext";
import { useMenu } from "../../context/MenuContext";
import { useLanguage } from "../../context/LanguageContext";
import supabase from "../../supabase";
import { saveCustomerOrder } from "../../utils/customerTracking";
import { useNavigate } from "react-router-dom";

jest.mock("../common/FullscreenOverlays", () => ({
  FullscreenSwipeableDrawer: ({ open, children, slotProps }) => open ? <div data-testid="cart-drawer" dir={slotProps.paper.dir}>{children}</div> : null,
}));
jest.mock("../../context/CartContext", () => ({ useCart: jest.fn() }));
jest.mock("../../context/OrdersContext", () => ({ useOrders: jest.fn() }));
jest.mock("../../context/TenantContext", () => ({ useTenant: jest.fn() }));
jest.mock("../../context/BranchContext", () => ({ useBranch: jest.fn() }));
jest.mock("../../context/MenuContext", () => ({ useMenu: jest.fn() }));
jest.mock("../../context/LanguageContext", () => ({ useLanguage: jest.fn() }));
jest.mock("../../supabase", () => ({ __esModule: true, default: { rpc: jest.fn() } }));
jest.mock("../../utils/customerTracking", () => ({ saveCustomerOrder: jest.fn() }));
jest.mock("react-router-dom", () => ({ useNavigate: jest.fn() }));

const item = {
  id: "coffee", cartItemId: "line-1", name: "قهوة", name_en: "Coffee",
  description: "ساخنة", description_en: "Hot", price: 12.5, quantity: 2,
  addon_options: ["عسل"], free_addon_item_ids: ["milk"], max_addons: 2,
  selected_addons: [],
};
const cart = {
  cartItems: [item], tableNumber: "7", clearCart: jest.fn(), updatedQuantity: jest.fn(),
  toggleCartItemAddon: jest.fn(), addSeparateCartItem: jest.fn(), separateCartLineIntoUnits: jest.fn(),
};
const addOrder = jest.fn();
const navigate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  useLanguage.mockReturnValue({ language: "en" });
  useCart.mockReturnValue(cart);
  useOrders.mockReturnValue({ addOrder });
  useTenant.mockReturnValue({ slug: "cafe" });
  useBranch.mockReturnValue({ branchSlug: "main" });
  useMenu.mockReturnValue({ items: [{ id: "milk", name: "حليب", name_en: "Milk", available: true }] });
  useNavigate.mockReturnValue(navigate);
  supabase.rpc.mockResolvedValue({ data: [], error: null });
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

test("shows the configured store currency consistently without changing totals", () => {
  render(<><FloatingCartBar currency="AED" handleCartOpen={() => {}} /><CartDrawer currency="AED" open close={() => {}} /></>);
  expect(screen.getAllByText("25 AED")).toHaveLength(2);
  expect(screen.getByText("12.5 AED")).toBeInTheDocument();
});

test("switches both cart summaries and reading direction without changing totals or entered notes", () => {
  const open = jest.fn();
  const close = jest.fn();
  const { rerender } = render(<><FloatingCartBar handleCartOpen={open} /><CartDrawer open close={close} /></>);
  expect(screen.getByRole("button", { name: "View order" }).closest('[dir]')).toHaveAttribute("dir", "ltr");
  expect(screen.getByTestId("cart-drawer")).toHaveAttribute("dir", "ltr");
  expect(screen.getByText("Items: 2")).toBeInTheDocument();
  expect(screen.getByText("Order summary (2)")).toBeInTheDocument();
  expect(screen.getAllByText("25 SAR")).toHaveLength(2);
  expect(screen.getByText("Total:")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Order notes" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View order" }));
  expect(open).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByPlaceholderText("Order notes (e.g. no sugar, extra ice...)"), { target: { value: "no sugar" } });

  useLanguage.mockReturnValue({ language: "ar" });
  rerender(<><FloatingCartBar handleCartOpen={open} /><CartDrawer open close={close} /></>);
  expect(screen.getByRole("button", { name: "عرض الطلب" }).closest('[dir]')).toHaveAttribute("dir", "rtl");
  expect(screen.getByTestId("cart-drawer")).toHaveAttribute("dir", "rtl");
  expect(screen.getByText("عدد الأصناف: 2")).toBeInTheDocument();
  expect(screen.getByText("ملخص الطلب (2)")).toBeInTheDocument();
  expect(screen.getAllByText("25 ر.س")).toHaveLength(2);
  expect(screen.getByRole("textbox", { name: "ملاحظات على الطلب" })).toBeInTheDocument();
  expect(screen.getByPlaceholderText("ملاحظات على الطلب (مثل: دون سكر، ثلج إضافي...)")).toHaveValue("no sugar");
  fireEvent.click(screen.getByRole("button", { name: "إغلاق السلة" }));
  expect(close).toHaveBeenCalledTimes(1);
});

test("localizes catalog labels and preserves quantity and canonical add-on actions", () => {
  const { rerender } = render(<CartItemCard cartItemDetails={item} />);
  expect(screen.getByText("Coffee")).toBeInTheDocument();
  expect(screen.getByText("Hot")).toBeInTheDocument();
  expect(screen.getByAltText("Coffee")).toBeInTheDocument();
  expect(screen.getByText("12.5 SAR")).toBeInTheDocument();
  expect(screen.getByText("Optional add-ons")).toBeInTheDocument();
  expect(screen.getByText("عسل")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Milk"));
  expect(cart.toggleCartItemAddon).toHaveBeenCalledWith("line-1", { key: "item:milk", id: "milk", name: "حليب" }, expect.any(Array));
  fireEvent.click(screen.getByRole("button", { name: "Decrease quantity" }));
  fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
  expect(cart.updatedQuantity.mock.calls).toEqual([["line-1", 1], ["line-1", 3]]);
  fireEvent.click(screen.getByRole("button", { name: /Separate all 2 Coffee units/ }));
  expect(cart.separateCartLineIntoUnits).toHaveBeenCalledWith("line-1");

  useLanguage.mockReturnValue({ language: "ar" });
  rerender(<CartItemCard cartItemDetails={item} />);
  expect(screen.getByText("قهوة")).toBeInTheDocument();
  expect(screen.getByText("ساخنة")).toBeInTheDocument();
  expect(screen.getByText("حليب")).toBeInTheDocument();
  expect(screen.getByText("12.5 ر.س")).toBeInTheDocument();
});

test("keeps a single unit's independent add-on action and selected add-on state", () => {
  const single = { ...item, quantity: 1, selected_addons: [{ id: "milk", name: "حليب" }] };
  render(<CartItemCard cartItemDetails={single} />);
  expect(screen.getByText("Milk").closest('[aria-pressed]')).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Order another Coffee unit with independent add-ons" }));
  expect(cart.addSeparateCartItem).toHaveBeenCalledWith("line-1");
  fireEvent.click(screen.getByText("Milk"));
  expect(cart.toggleCartItemAddon).toHaveBeenCalledWith("line-1", { key: "item:milk", id: "milk", name: "حليب" }, expect.any(Array));
});

test("uses available current catalog translations for a legacy cart snapshot and falls back when absent", () => {
  useMenu.mockReturnValue({ items: [{ id: "coffee", name_en: "Coffee", description_en: "Hot" }] });
  const legacy = { id: "coffee", name: "قهوة", description: "ساخنة", price: 3, quantity: 1 };
  const { rerender } = render(<CartItemCard cartItemDetails={legacy} />);
  expect(screen.getByText("Coffee")).toBeInTheDocument();
  expect(screen.getByText("Hot")).toBeInTheDocument();
  useMenu.mockReturnValue({ items: [] });
  rerender(<CartItemCard cartItemDetails={legacy} />);
  expect(screen.getByText("قهوة")).toBeInTheDocument();
  expect(screen.getByText("ساخنة")).toBeInTheDocument();
});

test("preserves submission payload, pending state, and successful tracking flow", async () => {
  let resolveOrder;
  addOrder.mockReturnValue(new Promise((resolve) => { resolveOrder = resolve; }));
  const close = jest.fn();
  render(<CartDrawer open close={close} />);
  fireEvent.change(screen.getByPlaceholderText("Order notes (e.g. no sugar, extra ice...)"), { target: { value: "note" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm and send order" }));
  expect(addOrder).toHaveBeenCalledWith({ items: [item], total_price: 25, table_number: "7", notes: "note" });
  expect(screen.getByRole("button", { name: "Sending..." })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Sending..." }));
  expect(addOrder).toHaveBeenCalledTimes(1);
  resolveOrder({ data: { order_id: "order-1", tracking_token: "token-1", created_at: "time" } });
  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/track/cafe/order-1", { state: { trackingToken: "token-1", tableNumber: "7" } }));
  expect(window.sessionStorage.getItem("servio.orderTracking.cafe.order-1")).toBe("token-1");
  expect(saveCustomerOrder).toHaveBeenCalledWith({ slug: "cafe", branchSlug: "main", orderId: "order-1", trackingToken: "token-1", tableNumber: "7", createdAt: "time" });
  expect(cart.clearCart).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledTimes(1);
});

test("preserves the cashier location payload and empty-cart submission guard", async () => {
  addOrder.mockResolvedValue({ error: new Error("offline") });
  const { rerender } = render(<CartDrawer open close={jest.fn()} cashierMode />);
  fireEvent.click(screen.getByRole("button", { name: "Confirm and send order" }));
  await screen.findByRole("alert");
  expect(addOrder.mock.calls[0][0].table_number).toBe("كاشير");
  useCart.mockReturnValue({ ...cart, cartItems: [] });
  rerender(<CartDrawer open close={jest.fn()} />);
  expect(screen.getByRole("button", { name: "Confirm and send order" })).toBeDisabled();
});

test.each([
  ["ORDER_ITEM_PRICE_MISMATCH", /An item price or the order total has changed/, /تغيّر سعر صنف/],
  ["ORDER_TOTAL_MISMATCH", /An item price or the order total has changed/, /تغيّر سعر صنف/],
  ["offline", /Unable to send your order right now/, /تعذر إرسال الطلب الآن/],
])("shows and dynamically translates the %s error without clearing the cart", async (message, english, arabic) => {
  addOrder.mockResolvedValue({ error: new Error(message) });
  const { rerender } = render(<CartDrawer open close={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Confirm and send order" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(english);
  expect(cart.clearCart).not.toHaveBeenCalled();
  useLanguage.mockReturnValue({ language: "ar" });
  rerender(<CartDrawer open close={jest.fn()} />);
  expect(screen.getByRole("alert")).toHaveTextContent(arabic);
});

test("translates unavailable-item details, including names, and retains items in the cart", async () => {
  addOrder.mockResolvedValue({ error: new Error("MENU_ITEM_UNAVAILABLE") });
  const { rerender } = render(<CartDrawer open close={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Confirm and send order" }));
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("“Coffee” is currently unavailable");
  expect(alert).toHaveTextContent("Your items will remain in the cart");
  expect(supabase.rpc).toHaveBeenCalledWith("get_public_menu_item_details", { p_slug: "cafe", p_branch_slug: "main" });
  expect(cart.clearCart).not.toHaveBeenCalled();
  useLanguage.mockReturnValue({ language: "ar" });
  rerender(<CartDrawer open close={jest.fn()} />);
  expect(screen.getByRole("alert")).toHaveTextContent("«قهوة» غير متاح حاليًا");
});

test("limits named unavailable items to three and indicates additional items in each language", async () => {
  const items = [item, ...[2, 3, 4].map((n) => ({ ...item, id: `id-${n}`, cartItemId: `line-${n}`, name: `صنف ${n}`, name_en: `Item ${n}` }))];
  useCart.mockReturnValue({ ...cart, cartItems: items });
  addOrder.mockResolvedValue({ error: new Error("MENU_ITEM_UNAVAILABLE") });
  const { rerender } = render(<CartDrawer open close={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Confirm and send order" }));
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("“Coffee”, “Item 2”, “Item 3”, and other items are currently unavailable");
  expect(alert).not.toHaveTextContent("Item 4");
  useLanguage.mockReturnValue({ language: "ar" });
  rerender(<CartDrawer open close={jest.fn()} />);
  expect(screen.getByRole("alert")).toHaveTextContent("«قهوة»، «صنف 2»، «صنف 3»، وأصناف أخرى غير متاح حاليًا");
});

test("translates the generic unavailable message when the refreshed menu cannot identify an item", async () => {
  addOrder.mockResolvedValue({ error: new Error("MENU_ITEM_NOT_IN_BRANCH_OR_UNAVAILABLE") });
  supabase.rpc.mockResolvedValue({ data: null, error: new Error("offline") });
  render(<CartDrawer open close={jest.fn()} />);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirm and send order" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("one or more items are no longer available");
  expect(cart.clearCart).not.toHaveBeenCalled();
});
