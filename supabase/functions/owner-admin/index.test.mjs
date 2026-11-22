import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Node cannot import the Deno HTTPS module, so strip only its import declarations
// and inject a fake Supabase client. This does not contact any remote service.
const source = (await readFile(new URL('./index.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\s*$/gm, '');
const { createOwnerAdminHandler } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const OWNER = '10000000-0000-0000-0000-000000000001';
const USER = '20000000-0000-0000-0000-000000000002';
const TENANT = '30000000-0000-0000-0000-000000000003';
const OP = '40000000-0000-0000-0000-000000000004';

function harness(options = {}) {
  const calls = [];
  const actor = options.actor === undefined ? { id: OWNER, email: 'serviotech.sa@gmail.com', email_confirmed_at: '2026-01-01T00:00:00Z' } : options.actor;
  const target = options.target ?? { id: USER, email: 'user@example.com' };
  const service = {
    from(table) {
      calls.push(['from', table]);
      return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: options.actorBlocked ? { user_id: OWNER } : null, error: options.blockError ? {} : null }; } };
    },
    auth: { admin: {
      async getUserById(id) { calls.push(['getUserById', id]); return { data: { user: target }, error: null }; },
      async updateUserById(id, body) { calls.push(['updateUserById', id, body]); return options.updateError ? { error: { code: 'server_error' }, data: { user: null } } : { error: null, data: { user: { id, banned_until: body.ban_duration === 'none' ? null : '2099-01-01T00:00:00Z' } } }; },
      async deleteUser(id) { calls.push(['deleteUser', id]); return { error: options.deleteError ? {} : null, data: {} }; },
      async listUsers(params) { calls.push(['listUsers', params]); const users = params.page === (options.page ?? 12) ? [{ ...target, created_at: '2026-01-01T00:00:00Z', user_metadata: { secret: 'not-for-response' } }] : (options.hasMore ? [{ id: 'next' }] : []); return { data: { users }, error: null }; },
    } },
    async rpc(name, params) {
      calls.push(['serviceRpc', name, params]);
      if (name === 'platform_block_guard_status') return { data: options.guard !== false, error: null };
      if (name === 'platform_owner_user_details') return { data: [{ user_id: USER, blocked: false, tenant_id: TENANT, tenant_name: 'T', tenant_slug: 't', role: 'admin', plan: 'starter', starts_at: '2026-01-01T00:00:00Z', ends_at: null, branch_count: 1 }], error: null };
      if (name === 'platform_prepare_user_deletion' && options.deletionBlocked) return { data: null, error: { code: '23503' } };
      return { data: null, error: null };
    },
  };
  const authenticated = {
    auth: { async getUser(token) { calls.push(['getUser', token]); return { data: { user: actor }, error: options.authError ? {} : null }; } },
    async rpc(name, params) { calls.push(['userRpc', name, params]); if (name === 'platform_current_user_allowed') return { data: options.sessionAllowed !== false, error: null }; if (options.subscriptionError) return { data: null, error: options.subscriptionError }; return { data: options.subscriptionData === undefined ? { tenant_id: params.p_tenant_id, plan: params.p_plan } : options.subscriptionData, error: null }; },
  };
  const makeClient = (url, key, opts) => {
    calls.push(['createClient', key, opts]);
    return key === 'service' ? service : authenticated;
  };
  const env = (name) => ({ SUPABASE_URL: 'local', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' })[name];
  const handler = createOwnerAdminHandler({ makeClient, env, uuid: () => OP });
  const request = (body, authorization = 'Bearer real-jwt') => handler(new Request('https://test.invalid', { method: 'POST', headers: { authorization, 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  return { request, calls };
}

test('requires real bearer and confirmed owner from getUser, ignores editable metadata', async () => {
  const bad = harness({ actor: { id: USER, email: 'person@example.com', email_confirmed_at: '2026-01-01', user_metadata: { email: 'serviotech.sa@gmail.com', is_owner: true } } });
  assert.equal((await bad.request({ action: 'me' }, 'not-bearer')).status, 401);
  assert.equal((await bad.request({ action: 'me' })).status, 403);
  assert.equal((await harness({ actor: { id: OWNER, email: 'serviotech.sa@gmail.com', email_confirmed_at: null } }).request({ action: 'me' })).status, 403);
  assert.equal((await harness({ authError: true }).request({ action: 'me' })).status, 401);
  assert.equal((await harness({ actorBlocked: true }).request({ action: 'me' })).status, 403);
  assert.equal((await harness({ blockError: true }).request({ action: 'me' })).status, 403);
  assert.equal((await harness({ sessionAllowed: false }).request({ action: 'me' })).status, 403);
  const ok = harness();
  assert.equal((await ok.request({ action: 'me' })).status, 200);
  assert.ok(ok.calls.some((x) => x[0] === 'getUser' && x[1] === 'real-jwt'));
});

test('list reads real requested and next Auth pages beyond page nine, aggregates without metadata', async () => {
  const h = harness({ page: 12, hasMore: true });
  const response = await h.request({ action: 'list', page: 12, per_page: 20 });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.page, 12);
  assert.equal(result.has_more, true);
  assert.equal(result.users.length, 1);
  assert.equal(result.users[0].branch_count, 1);
  assert.equal(result.users[0].tenant_id, TENANT);
  assert.equal('user_metadata' in result.users[0], false);
  assert.deepEqual(h.calls.filter((c) => c[0] === 'listUsers').map((c) => c[1]), [{ page: 12, perPage: 20 }, { page: 13, perPage: 20 }]);
  assert.equal((await h.request({ action: 'list', page: 0 })).status, 400);
});

test('subscription idempotent v1 RPC uses the real user client and validates date bounds and UUID key', async () => {
  const h = harness();
  const body = { action: 'set_subscription', tenant_id: TENANT, plan: 'pro', starts_at: '2026-01-01T00:00:00Z', ends_at: '2027-01-01T00:00:00Z', idempotency_key: OP };
  assert.equal((await h.request(body)).status, 200);
  assert.ok(h.calls.some((c) => c[0] === 'userRpc' && c[1] === 'owner_set_subscription_idempotent_v1' && c[2].p_tenant_id === TENANT && c[2].p_idempotency_key === OP));
  assert.ok(!h.calls.some((c) => c[0] === 'serviceRpc' && c[1].startsWith('owner_set_subscription')));
  assert.ok(h.calls.some((c) => c[0] === 'createClient' && c[1] === 'anon' && c[2].global.headers.Authorization === 'Bearer real-jwt'));
  assert.ok(!h.calls.some((c) => c[0] === 'serviceRpc' && c[1] === 'platform_owner_audit_event' && c[2].p_action === 'set_subscription'));
  assert.equal((await h.request({ ...body, idempotency_key: 'invalid' })).status, 400);
  assert.equal((await h.request({ ...body, ends_at: '2025-01-01T00:00:00Z' })).status, 400);
});

test('subscription accepts one composite row when PostgREST returns an array', async () => {
  const h = harness({ subscriptionData: [{ tenant_id: TENANT, plan: 'pro' }] });
  const res = await h.request({ action: 'set_subscription', tenant_id: TENANT, plan: 'pro', starts_at: '2026-01-01T00:00:00Z', idempotency_key: OP });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).subscription, [{ tenant_id: TENANT, plan: 'pro' }]);
  const current = harness({ subscriptionData: { tenant_id: TENANT, plan: 'starter', starts_at: '2030-01-01T00:00:00Z' } });
  const replay = await current.request({ action: 'set_subscription', tenant_id: TENANT, plan: 'pro', starts_at: '2026-01-01T00:00:00Z', idempotency_key: OP });
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).subscription.plan, 'starter');
});

test('subscription errors or malformed responses never claim success or fabricate failure events', async () => {
  const body = { action: 'set_subscription', tenant_id: TENANT, plan: 'pro', starts_at: '2026-01-01T00:00:00Z', ends_at: null, idempotency_key: OP };
  for (const [options, status] of [[{ subscriptionError: { code: 'PGRST202' } }, 503], [{ subscriptionError: { code: '55000' } }, 503], [{ subscriptionError: { code: '23514' } }, 409], [{ subscriptionData: null }, 503], [{ subscriptionData: [] }, 503], [{ subscriptionData: { tenant_id: USER, plan: 'pro' } }, 503]]) {
    const h = harness(options);
    const response = await h.request(body);
    assert.equal(response.status, status);
    assert.notEqual((await response.json()).success, true);
    assert.ok(!h.calls.some((c) => c[0] === 'serviceRpc' && c[1] === 'platform_owner_audit_event' && c[2].p_action === 'set_subscription'));
    assert.ok(!h.calls.some((c) => c[0] === 'userRpc' && c[1] === 'owner_set_subscription'));
  }
});

test('reusing an idempotency key with a different payload is a 409 and never falls back', async () => {
  const h = harness({ subscriptionError: { code: '23505' } });
  const res = await h.request({ action: 'set_subscription', tenant_id: TENANT, plan: 'pro', starts_at: '2026-01-01T00:00:00Z', idempotency_key: OP });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'IDEMPOTENCY_KEY_CONFLICT');
  assert.ok(h.calls.some((c) => c[0] === 'userRpc' && c[1] === 'owner_set_subscription_idempotent_v1'));
  assert.ok(!h.calls.some((c) => c[0] === 'userRpc' && ['owner_set_subscription', 'owner_set_subscription_audited'].includes(c[1])));
});

test('owner cannot be blocked or deleted, and inactive PostgREST guard prevents all mutations', async () => {
  for (const action of ['ban_user', 'delete_user']) {
    const h = harness({ target: { id: USER, email: 'serviotech.sa@gmail.com' } });
    assert.equal((await h.request({ action, user_id: USER })).status, 403);
    assert.ok(!h.calls.some((c) => c[0] === 'updateUserById' || c[0] === 'deleteUser'));
  }
  const h = harness({ guard: false });
  assert.equal((await h.request({ action: 'ban_user', user_id: USER })).status, 503);
  assert.ok(!h.calls.some((c) => c[0] === 'updateUserById' || (c[0] === 'serviceRpc' && c[1] === 'platform_begin_block_operation')));
});

test('ban never claims complete success when realtime/push enforcement is uncertain', async () => {
  const h = harness();
  const res = await h.request({ action: 'ban_user', user_id: USER });
  const body = await res.json();
  assert.equal(res.status, 503);
  assert.equal(body.code, 'BAN_PARTIALLY_ENFORCED');
  assert.equal(body.success, false);
  const begin = h.calls.findIndex((c) => c[1] === 'platform_begin_block_operation');
  const update = h.calls.findIndex((c) => c[0] === 'updateUserById');
  const finish = h.calls.findIndex((c) => c[1] === 'platform_finish_block_operation');
  assert.ok(begin >= 0 && begin < update && update < finish);
});

test('Auth errors leave block pending; unban succeeds only after Auth and DB completion', async () => {
  const bad = harness({ updateError: true });
  const res = await bad.request({ action: 'unban_user', user_id: USER });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).code, 'BLOCK_RECONCILIATION_REQUIRED');
  assert.ok(!bad.calls.some((c) => c[1] === 'platform_finish_block_operation'));
  const good = harness();
  assert.equal((await good.request({ action: 'unban_user', user_id: USER })).status, 200);
});

test('unsafe cashier/data deletion stops before the Auth admin API', async () => {
  const h = harness({ deletionBlocked: true });
  const res = await h.request({ action: 'delete_user', user_id: USER });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'DELETION_BLOCKED');
  assert.ok(!h.calls.some((c) => c[0] === 'deleteUser'));
});
