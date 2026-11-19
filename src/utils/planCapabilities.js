// TenantContext supplies tenant.plan from the get_public_plan(p_slug) RPC,
// backed by tenant_entitlements in the reviewed, unapplied migration. It must
// overwrite any raw row value and use Starter if the RPC fails or is absent.
// Never infer plan from theme_config, metadata, URL parameters or localStorage.
// This client mapping is not authorization; the server must independently
// enforce feature access and branch limits.
export function getPlanCapabilities(tenant) {
  // Unknown or malformed values receive Starter capabilities, never Pro.
  const isPro = tenant != null && Object.hasOwn(tenant, "plan") && tenant.plan === "pro";
  return {
    plan: isPro ? "pro" : "starter",
    aiWaiter: isPro,
    multiBranch: isPro,
    advancedAnalytics: true,
    maxBranches: isPro ? 3 : 1,
  };
}
