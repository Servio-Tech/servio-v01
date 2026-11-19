import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const cleanEmail = (value) => String(value || "").trim().toLowerCase();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getClients(request) {
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token || !url || !anonKey || !serviceRoleKey) throw new Error("owner_service_not_configured");
  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) throw new Error("invalid_session");
  const service = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: owner, error } = await service.from("owner_members").select("user_id,email,is_active").eq("user_id", authData.user.id).maybeSingle();
  if (error || !owner?.is_active) throw new Error("owner_forbidden");
  return { service, user: authData.user, owner };
}

async function audit(service, userId, action, tenantId, metadata = {}) {
  await service.from("owner_audit_log").insert({ owner_user_id: userId, action, tenant_id: tenantId || null, metadata });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const { service, user, owner } = await getClients(request);
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "overview");
    if (action === "me") return json({ owner });

    if (action === "overview") {
      const [{ data: tenants, error: tenantsError }, { data: controls }, { data: orders }] = await Promise.all([
        service.from("tenants").select("id,name,slug,created_at").order("created_at", { ascending: false }).limit(500),
        service.from("tenant_controls").select("tenant_id,status,plan,plan_expires_at,approved_at,updated_at"),
        service.from("orders").select("tenant_id,status,total_price,created_at").limit(10000),
      ]);
      if (tenantsError) throw tenantsError;
      const controlByTenant = new Map((controls || []).map((row) => [row.tenant_id, row]));
      const metrics = new Map();
      for (const order of orders || []) {
        const current = metrics.get(order.tenant_id) || { orders: 0, completed: 0, revenue: 0 };
        current.orders += 1;
        if (["served", "ready"].includes(order.status)) current.completed += 1;
        current.revenue += Number(order.total_price || 0);
        metrics.set(order.tenant_id, current);
      }
      return json({ owner, tenants: (tenants || []).map((tenant) => ({ ...tenant, control: controlByTenant.get(tenant.id) || { status: "pending", plan: "starter" }, metrics: metrics.get(tenant.id) || { orders: 0, completed: 0, revenue: 0 } })) });
    }

    if (action === "set_tenant") {
      const tenantId = String(body?.tenant_id || "");
      const status = String(body?.status || "pending");
      const plan = String(body?.plan || "starter");
      if (!uuid.test(tenantId) || !["pending", "active", "suspended", "blocked", "archived"].includes(status) || !["starter", "pro"].includes(plan)) return json({ error: "invalid_tenant_control" }, 400);
      const expires = body?.plan_expires_at ? new Date(body.plan_expires_at).toISOString() : null;
      const { error } = await service.from("tenant_controls").upsert({ tenant_id: tenantId, status, plan, plan_expires_at: expires, approved_at: status === "active" ? new Date().toISOString() : null, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "tenant_id" });
      if (error) throw error;
      await service.from("tenant_entitlements").upsert({ tenant_id: tenantId, plan, updated_at: new Date().toISOString() }, { onConflict: "tenant_id" });
      await audit(service, user.id, "tenant_control_updated", tenantId, { status, plan, plan_expires_at: expires });
      return json({ ok: true });
    }

    if (action === "create_owner") {
      const email = cleanEmail(body?.email);
      const password = String(body?.password || "");
      if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 10) return json({ error: "owner_credentials_invalid" }, 400);
      const { data: created, error: createError } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { owner_account: true } });
      if (createError || !created.user) return json({ error: createError?.message || "owner_create_failed" }, 400);
      const { error: memberError } = await service.from("owner_members").insert({ user_id: created.user.id, email, is_active: true });
      if (memberError) { await service.auth.admin.deleteUser(created.user.id); throw memberError; }
      await audit(service, user.id, "owner_created", null, { email });
      return json({ ok: true, email });
    }

    if (action === "set_owner_status") {
      const email = cleanEmail(body?.email);
      const isActive = body?.is_active === true;
      if (!email) return json({ error: "owner_email_required" }, 400);
      const { error } = await service.from("owner_members").update({ is_active: isActive, updated_at: new Date().toISOString() }).eq("email", email);
      if (error) throw error;
      await audit(service, user.id, isActive ? "owner_activated" : "owner_deactivated", null, { email });
      return json({ ok: true });
    }
    return json({ error: "unknown_action" }, 400);
  } catch (error) {
    const code = String(error?.message || "");
    if (code === "invalid_session") return json({ error: "invalid_session" }, 401);
    if (code === "owner_forbidden") return json({ error: "owner_forbidden" }, 403);
    if (code === "owner_service_not_configured") return json({ error: "owner_service_not_configured" }, 500);
    console.error(error);
    return json({ error: "owner_request_failed" }, 500);
  }
});
