import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import SmartWaiter from "./SmartWaiter";

jest.mock("../../supabase", () => ({ __esModule: true, default: { rpc: jest.fn().mockResolvedValue({ data: [], error: null }) } }));
jest.mock("../../context/CartContext", () => ({ useCart: () => ({ cartItems: [] }) }));
jest.mock("../../context/MenuContext", () => ({ useMenu: () => ({ items: [{ id: "i1", name: "قهوة", name_en: "Coffee", price: 12, available: true, tenant_id: "t1", branch_id: "b1" }], categoriesList: [], menuLoading: false }) }));
jest.mock("./ItemDetailsDrawer", () => ({ __esModule: true, default: () => <div>Details drawer</div> }));

const props = { tenant: { id: "t1" }, branch: { id: "b1", tenant_id: "t1", slug: "main" }, branchLoading: false, publicBranchSlug: "main", language: "en" };

beforeEach(() => window.sessionStorage.clear());

test("shows a suggestion on entry without requiring a form", () => {
  render(<SmartWaiter {...props} />);
  expect(screen.getByText("A suggestion for you")).toBeInTheDocument();
  expect(screen.getByText("Coffee")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View details" }));
  expect(screen.getByText("Details drawer")).toBeInTheDocument();
});

test("keeps a quiet floating button after the frequency cap and opens only on request", () => {
  window.sessionStorage.setItem("servio.smartWaiter.dismissals:t1%3Ab1", JSON.stringify({ count: 3, ids: [] }));
  render(<SmartWaiter {...props} />);
  expect(screen.queryByText("A suggestion for you")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Suggest something" }));
  expect(screen.getByLabelText("What do you prefer? (optional)")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Hide assistant" }));
  expect(screen.getByRole("button", { name: "Suggest something" })).toBeInTheDocument();
  expect(screen.queryByLabelText("What do you prefer? (optional)")).not.toBeInTheDocument();
});
