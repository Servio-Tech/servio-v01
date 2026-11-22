import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OWNER_EMAIL = "serviotech.sa@gmail.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
});
const fail = (status, code, error) => json({ error, code }, status);
const validId = (value) => typeof value === "string" && UUID.test(value);
const actorEmail = (user) => typeof user?.email === "string" ? user.email.toLowerCase() : "";
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

// Dependencies are injectable for independent, offline tests; production always
// uses the standard Supabase client and Deno's server-only environment.
export function createOwnerAdminHandler({ makeClient = createClient, env = (name) => Deno.env.get(name), uuid = () => crypto.randomUUID() } = {}) {
  return async function ownerAdmin(request) {
    if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (request.method !== "POST") return fail(405, "METHOD_NOT_ALLOWED", "Method not allowed");
    const bearer = /^Bearer\s+([^\s]+)$/i.exec(request.headers.get("authorization") || "");
    if (!bearer) return fail(401, "INVALID_SESSION", "Authentication required");

    const url = env("SUPABASE_URL");
    const anonKey = env("SUPABASE_ANON_KEY");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) return fail(503, "NOT_CONFIGURED", "Service unavailable");

    try {
      const userClient = makeClient(url, anonKey, {
        ...clientOptions, global: { headers: { Authorization: `Bearer ${bearer[1]}` } },
      });
      const { data: authData, error: authError } = await userClient.auth.getUser(bearer[1]);
      const actor = authData?.user;
      if (authError || !actor) return fail(401, "INVALID_SESSION", "Invalid session");
      if (actorEmail(actor) !== OWNER_EMAIL || !actor.email_confirmed_at)
        return fail(403, "OWNER_REQUIRED", "Confirmed owner account required");
      if (actor.banned_until && (!Number.isFinite(Date.parse(actor.banned_until)) || Date.parse(actor.banned_until) > Date.now()))
        return fail(403, "ACCOUNT_UNAVAILABLE", "Account unavailable");

      const service = makeClient(url, serviceKey, clientOptions);
      // getUser validates a real bearer but may accept an unexpired banned JWT.
      // The lookup is server-side and fails closed.
      const { data: actorBlock, error: actorBlockError } = await service.from("platform_user_blocks")
        .select("user_id").eq("user_id", actor.id).maybeSingle();
      if (actorBlockError || actorBlock) return fail(403, "ACCOUNT_UNAVAILABLE", "Account unavailable");
      const actorAccess = await userClient.rpc("platform_current_user_allowed");
      if (actorAccess.error || actorAccess.data !== true)
        return fail(403, "ACCOUNT_UNAVAILABLE", "Account unavailable");

      let body;
      try { body = await request.json(); } catch { return fail(400, "INVALID_BODY", "Invalid JSON body"); }
      if (!body || typeof body !== "object" || Array.isArray(body))
        return fail(400, "INVALID_BODY", "Invalid JSON body");
      const action = body.action;
      if (action === "me") return json({ is_owner: true, user: { id: actor.id, email: actor.email, email_confirmed_at: actor.email_confirmed_at } });

      if (action === "list") {
        const page = body.page == null ? 1 : Number(body.page);
        const perPage = body.per_page == null && body.page_size == null ? 50 : Number(body.per_page ?? body.page_size);
        if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 || !Number.isSafeInteger(perPage) || perPage < 1 || perPage > 100)
          return fail(400, "INVALID_PAGE", "Invalid pagination");
        // Fetch one actual next page instead of using SDK link-header parsing
        // (some versions parse only the first digit of the next page number).
        const [current, next] = await Promise.all([
          service.auth.admin.listUsers({ page, perPage }),
          service.auth.admin.listUsers({ page: page + 1, perPage }),
        ]);
        if (current.error || next.error || !Array.isArray(current.data?.users) || !Array.isArray(next.data?.users))
          return fail(503, "LIST_UNAVAILABLE", "Unable to list accounts");
        const users = current.data.users;
        let details = [];
        if (users.length) {
          const result = await service.rpc("platform_owner_user_details", { p_user_ids: users.map((u) => u.id) });
          if (result.error || !Array.isArray(result.data)) return fail(503, "DETAILS_UNAVAILABLE", "Unable to load account details");
          details = result.data;
        }
        const byId = new Map(details.map((item) => [item.user_id, item]));
        if (users.some((u) => !byId.has(u.id))) return fail(503, "DETAILS_UNAVAILABLE", "Unable to load account details");
        return json({
          users: users.map((u) => {
            const d = byId.get(u.id);
            const authBanned = !!u.banned_until && Date.parse(u.banned_until) > Date.now();
            return {
              id: u.id, email: u.email ?? null, created_at: u.created_at ?? null,
              email_confirmed_at: u.email_confirmed_at ?? null, banned_until: u.banned_until ?? null,
              blocked: Boolean(d.blocked || authBanned), tenant_id: d.tenant_id ?? null,
              tenant_name: d.tenant_name ?? null, tenant_slug: d.tenant_slug ?? null,
              role: d.role ?? null, plan: d.plan ?? null, starts_at: d.starts_at ?? null,
              ends_at: d.ends_at ?? null, branch_count: d.branch_count == null ? null : Number(d.branch_count),
            };
          }), page, has_more: next.data.users.length > 0,
        });
      }

      const audit = (actionName, outcome, userId = null, tenantId = null) => service.rpc("platform_owner_audit_event", {
        p_actor_id: actor.id, p_user_id: userId, p_tenant_id: tenantId, p_action: actionName, p_outcome: outcome,
      });
      const guardReady = async () => {
        const status = await service.rpc("platform_block_guard_status");
        return !status.error && status.data === true;
      };

      if (action === "set_subscription") {
        const { tenant_id: tenantId, plan, starts_at: startsAt, ends_at: endsAt, idempotency_key: idempotencyKey } = body;
        if (!validId(tenantId) || !["starter", "pro"].includes(plan) || typeof startsAt !== "string" || !Number.isFinite(Date.parse(startsAt)) ||
            (endsAt != null && (typeof endsAt !== "string" || !Number.isFinite(Date.parse(endsAt)) || Date.parse(endsAt) <= Date.parse(startsAt))) || !validId(idempotencyKey))
          return fail(400, "INVALID_SUBSCRIPTION", "Invalid subscription details");
        // This versioned RPC is the only supported entry point: its database
        // transaction deduplicates retries, compares the complete payload and
        // returns the current subscription. Never fall back to legacy RPCs.
        const result = await userClient.rpc("owner_set_subscription_idempotent_v1", {
          p_tenant_id: tenantId, p_plan: plan, p_starts_at: startsAt, p_ends_at: endsAt ?? null,
          p_idempotency_key: idempotencyKey,
        });
        if (result.error) {
          if (result.error.code === "23505")
            return fail(409, "IDEMPOTENCY_KEY_CONFLICT", "Idempotency key was already used with a different subscription payload");
          const conflict = ["23514", "P0002", "22023"].includes(result.error.code);
          return fail(conflict ? 409 : 503, conflict ? "SUBSCRIPTION_REJECTED" : "SUBSCRIPTION_UNCERTAIN", conflict ? "Subscription change rejected" : "Subscription outcome uncertain; retry only with the same key and payload");
        }
        // A missing or malformed response is not proof of failure: the RPC may
        // already have committed. Do not claim success or emit a false failure.
        // PostgREST can represent a composite result as an object or one row.
        const subscription = Array.isArray(result.data) && result.data.length === 1 ? result.data[0] : result.data;
        if (!subscription || typeof subscription !== "object" || Array.isArray(subscription) ||
            typeof subscription.tenant_id !== "string" || subscription.tenant_id.toLowerCase() !== tenantId.toLowerCase() || !["starter", "pro"].includes(subscription.plan))
          return fail(503, "SUBSCRIPTION_UNCERTAIN", "Subscription outcome uncertain; retry only with the same key and payload");
        return json({ success: true, subscription: result.data });
      }

      if (!["ban_user", "unban_user", "delete_user"].includes(action))
        return fail(400, "UNKNOWN_ACTION", "Unknown action");
      const userId = body.user_id;
      if (!validId(userId)) return fail(400, "INVALID_USER", "Invalid user ID");
      const targetResult = await service.auth.admin.getUserById(userId);
      if (targetResult.error || !targetResult.data?.user) return fail(404, "USER_NOT_FOUND", "Account unavailable");
      const target = targetResult.data.user;
      if (userId.toLowerCase() === actor.id.toLowerCase() || actorEmail(target) === OWNER_EMAIL)
        return fail(403, "OWNER_PROTECTED", "The owner account is protected");
      // Catch an unapplied/overridden PostgREST pre-request hook before mutation.
      if (!await guardReady()) return fail(503, "GUARD_UNAVAILABLE", "Account protection is not active; no change made");

      if (action === "ban_user" || action === "unban_user") {
        const operationId = uuid();
        const params = { p_actor_id: actor.id, p_user_id: userId, p_operation: action, p_operation_id: operationId };
        const started = await service.rpc("platform_begin_block_operation", params);
        if (started.error) {
          const status = ["55000", "23505"].includes(started.error.code) ? 409 : 503;
          return fail(status, "BLOCK_NOT_STARTED", "Account operation could not be started");
        }
        // A failed or ambiguous Auth call leaves the DB block and operation lock
        // in place; it must be reconciled by an operator, never silently unlocked.
        const changed = await service.auth.admin.updateUserById(userId, {
          ban_duration: action === "ban_user" ? "876000h" : "none",
        });
        const changedUntil = changed.data?.user?.banned_until;
        const authStateConfirmed = action === "ban_user"
          ? typeof changedUntil === "string" && Date.parse(changedUntil) > Date.now()
          : !changedUntil || Date.parse(changedUntil) <= Date.now();
        if (changed.error || !changed.data?.user || !authStateConfirmed) {
          await audit(action, "partial", userId);
          return fail(503, "BLOCK_RECONCILIATION_REQUIRED", "Account remains blocked; Auth state is uncertain and requires operator reconciliation");
        }
        const finished = await service.rpc("platform_finish_block_operation", params);
        if (finished.error) return fail(503, "BLOCK_RECONCILIATION_REQUIRED", "Auth changed but the block record requires operator reconciliation");
        if (action === "ban_user") {
          // Existing Realtime channels and already-enqueued Web Push cannot be
          // guaranteed revoked by Auth or PostgREST. Never claim complete success.
          return json({ success: false, blocked: true, code: "BAN_PARTIALLY_ENFORCED", error: "Auth and database blocked; existing Realtime and push channels require additional enforcement" }, 503);
        }
        return json({ success: true, blocked: false });
      }

      const prepared = await service.rpc("platform_prepare_user_deletion", { p_actor_id: actor.id, p_user_id: userId });
      if (prepared.error) {
        if (["23503", "23505", "55000"].includes(prepared.error.code))
          return fail(409, "DELETION_BLOCKED", "Account has retained data, a linked cashier record, or a pending operation; use the safe cashier workflow if applicable");
        return fail(503, "DELETION_NOT_STARTED", "Account deletion could not be started");
      }
      const deleted = await service.auth.admin.deleteUser(userId);
      if (deleted.error) {
        await audit(action, "partial", userId);
        return fail(503, "DELETION_RECONCILIATION_REQUIRED", "Deletion outcome requires operator reconciliation; tenant data was not intentionally removed");
      }
      const finished = await service.rpc("platform_finish_user_deletion", { p_actor_id: actor.id, p_user_id: userId, p_success: true });
      if (finished.error) return fail(503, "AUDIT_INCOMPLETE", "Account deleted but completion audit failed; verify before retrying");
      return json({ success: true });
    } catch {
      // Do not log tokens, request bodies, e-mail addresses, or upstream errors.
      console.error("owner-admin request failed");
      return fail(503, "SERVICE_UNAVAILABLE", "Service unavailable; verify account state before retrying");
    }
  };
}

if (typeof Deno !== "undefined" && Deno.serve) Deno.serve(createOwnerAdminHandler());
