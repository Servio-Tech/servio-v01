import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { BranchProvider, useBranch } from "../../../context/BranchContext";
import supabase from "../../../supabase";
import { useTenant } from "../../../context/TenantContext";

jest.mock("../../../supabase", () => ({ __esModule: true, default: { rpc: jest.fn(), from: jest.fn() } }));
jest.mock("../../../context/TenantContext", () => ({ useTenant: jest.fn() }));

const initial = [
  { id: "main", name: "Main", slug: "main", tenant_id: "t1", is_active: true },
  { id: "north", name: "North", slug: "north", tenant_id: "t1", is_active: true },
];
let rows;
let listFailure;
let tenant;

beforeEach(() => {
  window.localStorage.clear();
  rows = [...initial]; listFailure = null;
  tenant = { tenantId: "t1", tenant: { id: "t1", plan: "pro" }, slug: null, isPublic: false, loading: false };
  useTenant.mockImplementation(() => tenant);
  supabase.from.mockImplementation(() => {
    const chain = { select: jest.fn(() => chain), eq: jest.fn(() => chain),
      order: jest.fn(async () => ({ data: rows, error: listFailure })) };
    return chain;
  });
  supabase.rpc.mockImplementation(async (name) => name === "current_user_branch_id"
    ? { data: null, error: null }
    : { data: true, error: null });
});

const wrapper = ({ children }) => <BranchProvider>{children}</BranchProvider>;
async function ready(result) {
  await waitFor(() => expect(result.current.loading).toBe(false));
  await waitFor(() => expect(result.current.branches.length).toBe(2));
}

test("uses only the scoped RPC and reloads to a valid fallback selection", async () => {
  const { result } = renderHook(() => useBranch(), { wrapper });
  await ready(result);
  act(() => result.current.selectBranch("north"));
  rows = [initial[0]];
  let response;
  await act(async () => { response = await result.current.deleteBranch("north"); });
  expect(response.error).toBeNull();
  expect(supabase.rpc).toHaveBeenCalledWith("delete_empty_branch", { p_branch_id: "north" });
  expect(result.current.branches.map((entry) => entry.id)).toEqual(["main"]);
  expect(result.current.selectedBranchId).toBe("main");
});

test("successful deletion followed by load failure clears stale state and exposes retry error", async () => {
  const { result } = renderHook(() => useBranch(), { wrapper });
  await ready(result);
  listFailure = new Error("offline");
  let response;
  await act(async () => { response = await result.current.deleteBranch("north"); });
  expect(response.error).toBeNull();
  expect(response.reloadError.message).toBe("offline");
  expect(result.current.error).toBe("offline");
  expect(result.current.branches).toEqual([]);
  expect(result.current.selectedBranchId).toBeNull();
});

test("rejects duplicate changes while waiting and does not modify a changed tenant scope", async () => {
  let complete;
  supabase.rpc.mockImplementation((name) => name === "current_user_branch_id"
    ? Promise.resolve({ data: null, error: null })
    : new Promise((resolve) => { complete = resolve; }));
  const { result, rerender } = renderHook(() => useBranch(), { wrapper });
  await ready(result);
  let first;
  act(() => { first = result.current.deleteBranch("north"); });
  let second;
  await act(async () => { second = await result.current.deleteBranch("north"); });
  expect(second.error.code).toBe("busy");
  tenant = { ...tenant, tenantId: "t2", tenant: { id: "t2", plan: "pro" } };
  rows = [{ id: "t2-main", name: "Other", slug: "main", tenant_id: "t2", is_active: true }];
  rerender();
  await waitFor(() => expect(result.current.selectedBranchId).toBe("t2-main"));
  await act(async () => { complete({ data: true, error: null }); await first; });
  expect(result.current.selectedBranchId).toBe("t2-main");
  expect(result.current.branches.map((entry) => entry.id)).toEqual(["t2-main"]);
});

test("does not delete branches not in the currently visible list", async () => {
  const { result } = renderHook(() => useBranch(), { wrapper });
  await ready(result);
  let response;
  await act(async () => { response = await result.current.deleteBranch("unknown"); });
  expect(response.error.code).toBe("unavailable");
  expect(supabase.rpc).not.toHaveBeenCalledWith("delete_empty_branch", expect.anything());
});
