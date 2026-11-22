// Run with: SERVIO_TEST_JSDOM_PATH=/absolute/path/to/jsdom/lib/api.js node --test src/utils/subscriptionStatus.ui.test.mjs
// jsdom is test-only; it is deliberately not installed into the application.
import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { createServer } from "vite";
import reactPlugin from "@vitejs/plugin-react";

const jsdomPath = process.env.SERVIO_TEST_JSDOM_PATH;
if (!jsdomPath) {
  test("subscription UI tests need SERVIO_TEST_JSDOM_PATH", { skip: "Install jsdom outside the project and set SERVIO_TEST_JSDOM_PATH" }, () => {});
} else {
  const { JSDOM } = await import(pathToFileURL(jsdomPath));
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/manager" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, Node: dom.window.Node, HTMLElement: dom.window.HTMLElement, MutationObserver: dom.window.MutationObserver, getComputedStyle: dom.window.getComputedStyle, IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  const React = await import("react");
  const { render, screen, fireEvent, waitFor, cleanup, act } = await import("@testing-library/react");
  const { MemoryRouter, Routes, Route } = await import("react-router-dom");
  const h = React.createElement;
  let model;
  globalThis.__subscriptionUiClient = {
    auth: {
      getSession: async () => ({ data: { session: model.session }, error: model.sessionError || null }),
      onAuthStateChange: (cb) => { model.listeners.add(cb); return { data: { subscription: { unsubscribe: () => model.listeners.delete(cb) } } }; },
      signInWithPassword: async () => { model.session = { user: { id: "u1" } }; return { data: { session: model.session }, error: null }; },
    },
    rpc: async (name) => {
      if (name === "platform_current_subscription_status") { model.statusCalls++; return model.statusError ? { data: null, error: Error("offline") } : { data: model.status, error: null }; }
      if (name === "ensure_profile_for_current_user") return { data: model.profile, error: model.profileError ? Error("denied") : null };
      throw Error(`unexpected RPC ${name}`);
    },
    from: (table) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === "tenants" ? model.tenant : model.store, error: model.rowError ? Error("offline") : null }) }) }) }),
  };
  const plugin = {
    name: "subscription-ui-mocks", enforce: "pre",
    resolveId(source) {
      if (source === "../supabase") return "\0subscription-mock-client";
      if (source.endsWith("/LanguageContext")) return "\0subscription-mock-language";
      return null;
    },
    load(id) {
      if (id === "\0subscription-mock-client") return "export default globalThis.__subscriptionUiClient";
      if (id === "\0subscription-mock-language") return "export const useLanguage = () => ({language:'en', t:(x)=>x, setLanguage:()=>{}})";
      return null;
    },
  };
  const server = await createServer({ configFile: false, root: process.cwd(), plugins: [plugin, reactPlugin()], server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  const { TenantProvider, useTenant } = await server.ssrLoadModule("/src/context/TenantContext.jsx");
  const { default: RequireSession } = await server.ssrLoadModule("/src/components/RequireSession.jsx");
  const { default: AdminLogin } = await server.ssrLoadModule("/src/pages/AdminLogin.jsx");
  const reset = () => { model = { listeners: new Set(), session: { user: { id: "u1" } }, status: "active", statusCalls: 0, profile: { id: "u1", tenant_id: "t1", role: "admin" }, tenant: { id: "t1", name: "old tenant" }, store: { id: "s1", tenant_id: "t1" } }; };
  function Observe() {
    const { tenantId, profile, storeInfo, subscriptionStatus } = useTenant();
    return h("output", { "data-testid": "context" }, JSON.stringify({ tenantId, profileId: profile?.id || null, storeId: storeInfo?.id || null, subscriptionStatus }));
  }
  function App() {
    return h(MemoryRouter, { initialEntries: ["/manager"] }, h(TenantProvider, null,
      h(Observe), h(Routes, null,
        h(Route, { path: "/manager", element: h(RequireSession, { role: "admin" }, h("input", { "aria-label": "unsaved work" })) }),
        h(Route, { path: "/login", element: h("p", null, "sign-in page") }))));
  }
  const focus = () => act(() => { window.dispatchEvent(new window.Event("focus")); });
  const observed = () => JSON.parse(screen.getByTestId("context").textContent);
  test("open dashboard keeps forms on successful focus recheck, freezes on expiry, restores on renewal and fails closed offline", async () => {
    reset(); render(h(App));
    const input = await screen.findByLabelText("unsaved work");
    fireEvent.change(input, { target: { value: "draft" } });
    const previousCalls = model.statusCalls;
    focus();
    await waitFor(() => assert.ok(model.statusCalls >= previousCalls + 2));
    assert.equal(screen.getByLabelText("unsaved work").value, "draft");
    model.status = "expired"; focus();
    assert.match((await screen.findByRole("alert")).textContent, /expired.*data are retained.*after renewal/i);
    assert.equal(screen.queryByLabelText("unsaved work"), null);
    assert.deepEqual(observed(), { tenantId: null, profileId: null, storeId: null, subscriptionStatus: "expired" });
    model.status = "active"; focus();
    await screen.findByLabelText("unsaved work");
    assert.equal(observed().tenantId, "t1");
    model.statusError = true; focus();
    assert.match((await screen.findByRole("alert")).textContent, /could not verify.*does not mean the subscription has expired/i);
    assert.equal(observed().tenantId, null);
    cleanup();
  });
  test("disappearing or denied profile clears all prior context", async () => {
    reset(); render(h(App)); await screen.findByLabelText("unsaved work");
    model.profile = null; model.profileError = true; focus();
    await screen.findByRole("alert");
    assert.deepEqual(observed(), { tenantId: null, profileId: null, storeId: null, subscriptionStatus: "profile_unavailable" });
    cleanup();
  });
  test("sign out immediately invalidates previous tenant data", async () => {
    reset(); render(h(App)); await screen.findByLabelText("unsaved work");
    model.session = null;
    act(() => { for (const cb of model.listeners) cb("SIGNED_OUT"); });
    await screen.findByText("sign-in page");
    assert.equal(observed().tenantId, null);
    assert.equal(observed().profileId, null);
    assert.equal(observed().storeId, null);
    cleanup();
  });
  test("admin sign-in reports verified expiry rather than incomplete profile", async () => {
    reset(); model.session = null; model.status = "expired";
    render(h(MemoryRouter, { initialEntries: ["/login"] }, h(AdminLogin)));
    fireEvent.change(screen.getByLabelText("email"), { target: { value: "manager@example.test" } });
    fireEvent.change(screen.getByLabelText("password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "signIn" }));
    assert.match((await screen.findByRole("alert")).textContent, /subscription has expired.*data are retained.*after renewal/i);
    assert.ok(!screen.getByRole("alert").textContent.includes("profileIncomplete"));
    cleanup();
  });
  test.after(async () => { cleanup(); await server.close(); dom.window.close(); delete globalThis.__subscriptionUiClient; });
}
