import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BranchTabs from "../BranchTabs";
import { useBranch } from "../../../context/BranchContext";
import { useLanguage } from "../../../context/LanguageContext";

jest.mock("../../../context/BranchContext", () => ({ useBranch: jest.fn() }));
jest.mock("../../../context/LanguageContext", () => ({ useLanguage: jest.fn() }));

let branch;
beforeEach(() => {
  branch = {
    branches: [{ id: "b1", name: "Main", slug: "main" }, { id: "b2", name: "North", slug: "north" }],
    selectedBranch: { id: "b2", name: "North", slug: "north" }, selectedBranchId: "b2",
    selectBranch: jest.fn(), createBranch: jest.fn(), renameBranch: jest.fn(),
    deleteBranch: jest.fn(), reloadBranches: jest.fn(), creationReason: "allowed", loading: false, error: "",
  };
  useBranch.mockImplementation(() => branch);
  useLanguage.mockReturnValue({ language: "en" });
});

test("delete confirmation explains empty-only policy and cancel does nothing", () => {
  render(<BranchTabs />);
  fireEvent.click(screen.getByRole("button", { name: "Delete selected branch" }));
  expect(screen.getByText("Delete “North”?")).toBeInTheDocument();
  expect(screen.getByText(/Only an empty branch can be deleted/)).toHaveTextContent(/main or last branch cannot be deleted/);
  expect(branch.deleteBranch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(branch.deleteBranch).not.toHaveBeenCalled();
});

test("shows safe rejection from RPC and keeps the confirmation open", async () => {
  branch.deleteBranch.mockResolvedValue({ error: { message: "branch_has_records", code: "P0001" } });
  render(<BranchTabs />);
  fireEvent.click(screen.getByRole("button", { name: "Delete selected branch" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete empty branch" }));
  expect(await screen.findByText(/linked records and cannot be deleted/)).toBeInTheDocument();
  expect(branch.deleteBranch).toHaveBeenCalledTimes(1);
  expect(branch.deleteBranch).toHaveBeenCalledWith("b2");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reload branches" }));
  expect(branch.reloadBranches).toHaveBeenCalledTimes(1);
});

test("locks confirmation during deletion, then closes on success", async () => {
  let finish;
  branch.deleteBranch.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  render(<BranchTabs />);
  fireEvent.click(screen.getByRole("button", { name: "Delete selected branch" }));
  const button = screen.getByRole("button", { name: "Delete empty branch" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(branch.deleteBranch).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Working..." })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  finish({ data: true, error: null });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

test("Arabic dialog warns about the same empty-only restriction", () => {
  useLanguage.mockReturnValue({ language: "ar" });
  render(<BranchTabs />);
  fireEvent.click(screen.getByRole("button", { name: "حذف الفرع المحدد" }));
  expect(screen.getByText(/يمكن حذف فرع فارغ فقط/)).toBeInTheDocument();
  expect(screen.getByText(/الفرع الرئيسي أو الأخير/)).toBeInTheDocument();
});

test("switching, adding, and renaming still invoke their existing operations", async () => {
  branch.createBranch.mockResolvedValue({ data: { id: "new" }, error: null });
  branch.renameBranch.mockResolvedValue({ data: { id: "b2" }, error: null });
  render(<BranchTabs />);
  fireEvent.click(screen.getByRole("tab", { name: "Main" }));
  expect(branch.selectBranch).toHaveBeenCalledWith("b1");

  fireEvent.click(screen.getByRole("button", { name: "Add branch" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Branch name" }), { target: { value: "South" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(branch.createBranch).toHaveBeenCalledWith("South"));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: "Rename selected branch" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Branch name" }), { target: { value: "North renamed" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(branch.renameBranch).toHaveBeenCalledWith("b2", "North renamed"));
});
