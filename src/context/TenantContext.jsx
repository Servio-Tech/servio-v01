import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import supabase from "../supabase";
import { resolveSubscriptionProfile, SUBSCRIPTION_RECHECK_MS, withSubscriptionTimeout } from "../utils/subscriptionStatus";

const TenantContext = createContext(null);
// هذه المسارات تخص التطبيق نفسه وليست معرف متجر؛ جميع المسارات الأخرى قد تحمل slug لمتجر عام.
const RESERVED_ROUTES = new Set(["login", "register", "dashboard", "manager", "menu", "cashier", "auth", "track", "cart", "service", "review", "owner-console"]);

function getRouteContext(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "owner-console") return { slug: null, tableNumber: null, isTracking: false, isOwner: true };
  if (parts[0] === "track") return { slug: parts[1] || null, tableNumber: null, isTracking: true };
  if (parts[0] === "menu") return { slug: parts[1] || null, tableNumber: parts[2] || null, isTracking: false };
  if (parts[0] === "cart" || parts[0] === "service" || parts[0] === "review")
    return { slug: parts[1] || null, tableNumber: parts[2] || null, isTracking: false };
  if (parts[0] && !RESERVED_ROUTES.has(parts[0])) return { slug: parts[0], tableNumber: parts[1] || null, isTracking: false };
  return {
    slug: null,
    tableNumber: null,
    isTracking: false,
    isStaff: parts[0] === "manager" || parts[0] === "dashboard",
  };
}

const emptyResolution = (key, status = "checking", loading = true) => ({ key, tenant: null, storeInfo: null, profile: null, status, loading });

export function TenantProvider({ children }) {
  const location = useLocation();
  const route = useMemo(() => getRouteContext(location.pathname), [location.pathname]);
  const [authVersion, setAuthVersion] = useState(0);
  const [checkVersion, setCheckVersion] = useState(0);
  const [resolution, setResolution] = useState(() => emptyResolution(null));
  const scope = route.isOwner
    ? "owner"
    : route.slug
      ? `public:${route.slug}`
      : `${route.isStaff ? "staff" : "public"}:${authVersion}`;
  const refreshSubscription = useCallback(() => setCheckVersion((v) => v + 1), []);
  const invalidateSession = useCallback(() => {
    // Authentication changes must immediately remove the previous identity.
    setResolution(emptyResolution(null));
    setAuthVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!route.isStaff) return undefined;
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") invalidateSession();
    });
    return () => listener.subscription.unsubscribe();
  }, [route.isStaff, invalidateSession]);

  // Only staff dashboards poll. A suspended screen also retries, so renewal can
  // restore the UI. This is not a promise of complete Realtime revocation.
  useEffect(() => {
    if (!/^\/(manager|dashboard)(?:\/|$)/.test(location.pathname)) return undefined;
    const onFocus = () => refreshSubscription();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(refreshSubscription, SUBSCRIPTION_RECHECK_MS);
    return () => { window.removeEventListener("focus", onFocus); window.clearInterval(timer); };
  }, [location.pathname, refreshSubscription]);

  useEffect(() => {
    let cancelled = false;
    const resolveTenant = async () => {
      if (route.isOwner) {
        if (!cancelled) setResolution(emptyResolution(scope, "owner", false));
        return;
      }
      if (!route.slug && !route.isStaff) {
        if (!cancelled) setResolution(emptyResolution(scope, "public", false));
        return;
      }
      // Preserve a resolved dashboard while a bounded background recheck runs;
      // successful periodic checks do not unmount forms or discard unsaved work.
      // Any negative result, timeout or error clears all private context below.
      if (!cancelled) setResolution((previous) => previous.key === scope ? previous : emptyResolution(scope));
      try {
        if (route.slug) {
          const [tenantResult, storeResult] = await withSubscriptionTimeout(() => Promise.all([
            supabase.rpc("get_public_tenant", { p_slug: route.slug }),
            supabase.rpc("get_public_store", { p_slug: route.slug }),
          ]));
          if (!cancelled) setResolution({ ...emptyResolution(scope, "public", false), tenant: tenantResult.data?.[0] || null, storeInfo: storeResult.data?.[0] || null });
          return;
        }
        const result = await resolveSubscriptionProfile(supabase);
        if (cancelled) return;
        if (result.status !== "active") {
          setResolution(emptyResolution(scope, result.status, false));
          return;
        }
        const profile = result.profile;
        const [tenantResult, storeResult] = await withSubscriptionTimeout(() => Promise.all([
          supabase.from("tenants").select("*").eq("id", profile.tenant_id).maybeSingle(),
          supabase.from("store").select("*").eq("tenant_id", profile.tenant_id).maybeSingle(),
        ]));
        if (cancelled) return;
        if (tenantResult.error || storeResult.error || !tenantResult.data || tenantResult.data.id !== profile.tenant_id) {
          setResolution(emptyResolution(scope, "unavailable", false));
          return;
        }
        setResolution({ key: scope, tenant: tenantResult.data, storeInfo: storeResult.data || null, profile, status: "active", loading: false });
      } catch {
        if (!cancelled) setResolution(emptyResolution(scope, "unavailable", false));
      }
    };
    void resolveTenant();
    return () => { cancelled = true; };
  }, [route.slug, route.isOwner, route.isStaff, scope, checkVersion]);

  // A route or authentication version change invalidates previous data even
  // before the asynchronous effect gets a chance to run.
  const current = resolution.key === scope ? resolution : emptyResolution(scope);
  const value = useMemo(() => ({
    slug: route.slug,
    tableNumber: route.tableNumber,
    isTracking: route.isTracking,
    isStaff: Boolean(route.isStaff),
    tenant: route.isOwner ? null : current.tenant,
    tenantId: route.isOwner ? null : (current.tenant?.id || current.profile?.tenant_id || null),
    storeInfo: route.isOwner ? null : current.storeInfo,
    profile: route.isOwner ? null : current.profile,
    loading: route.isOwner ? false : current.loading,
    subscriptionStatus: current.status,
    refreshSubscription,
    isPublic: Boolean(route.slug),
  }), [route, current, refreshSubscription]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) throw new Error("useTenant must be used within TenantProvider");
  return context;
};
