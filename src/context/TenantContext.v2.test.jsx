import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { TenantProvider, useTenant } from "./TenantContext";
import supabase from "../supabase";

jest.mock("../supabase", () => ({ __esModule: true, default: { rpc: jest.fn(), auth: { onAuthStateChange: jest.fn() } } }));
function Probe() {
  const { tenant, loading } = useTenant();
  const navigate = useNavigate();
  return <><span>{loading ? "loading" : `${tenant?.id || "none"}:${tenant?.plan || "none"}`}</span><button onClick={() => navigate("/menu/other/1")}>other</button></>;
}
beforeEach(() => {
  jest.clearAllMocks();
  supabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
});

test("a stalled plan lookup does not block the public menu and later upgrades safely", async () => {
  let resolvePlan;
  supabase.rpc.mockImplementation((name) => {
    if (name === "get_public_tenant") return Promise.resolve({ data: [{ id: "t1" }] });
    if (name === "get_public_store") return Promise.resolve({ data: [{}] });
    if (name === "get_public_plan") return new Promise((resolve) => { resolvePlan = resolve; });
    throw new Error("unexpected call");
  });
  render(<MemoryRouter initialEntries={["/menu/cafe/1"]}><TenantProvider><Probe /></TenantProvider></MemoryRouter>);
  expect(await screen.findByText("t1:starter")).toBeInTheDocument();
  resolvePlan({ data: "pro", error: null });
  expect(await screen.findByText("t1:pro")).toBeInTheDocument();
});

test("a late plan response from the previous tenant cannot grant Pro to the next tenant", async () => {
  let resolveOld;
  supabase.rpc.mockImplementation((name, { p_slug }) => {
    if (name === "get_public_tenant") return Promise.resolve({ data: [{ id: p_slug === "cafe" ? "t1" : "t2" }] });
    if (name === "get_public_store") return Promise.resolve({ data: [{}] });
    if (name === "get_public_plan" && p_slug === "cafe") return new Promise((resolve) => { resolveOld = resolve; });
    if (name === "get_public_plan") return Promise.resolve({ data: "starter", error: null });
    throw new Error("unexpected call");
  });
  render(<MemoryRouter initialEntries={["/menu/cafe/1"]}><TenantProvider><Probe /></TenantProvider></MemoryRouter>);
  expect(await screen.findByText("t1:starter")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "other" }));
  expect(await screen.findByText("t2:starter")).toBeInTheDocument();
  resolveOld({ data: "pro", error: null });
  await waitFor(() => expect(screen.getByText("t2:starter")).toBeInTheDocument());
  expect(screen.queryByText("t2:pro")).not.toBeInTheDocument();
});
