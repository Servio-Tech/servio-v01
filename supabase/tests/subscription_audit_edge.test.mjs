import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { lstatSync } from 'node:fs';

// Run only when launched by subscription_audit_local.sh with its private socket.
// No URL, TCP host, service key, or production credential is accepted here.
const socket = process.env.SERVIO_AUDIT_TEST_SOCKET || '';
const bin = process.env.SERVIO_AUDIT_TEST_PSQL || '';
const dbUser = process.env.SERVIO_AUDIT_TEST_USER || '';
const local = /^\/tmp\/servio-subscription-audit\.[A-Za-z0-9]+\/socket$/.test(socket) && /^\/usr\/lib\/postgresql\/\d+\/bin\/psql$/.test(bin) && /^[a-z_][a-z0-9_-]*$/i.test(dbUser);
const enabled = local && lstatSync(socket).isDirectory();
const beforeMigration = process.env.SERVIO_AUDIT_TEST_PHASE === 'before';
const source = (await readFile(new URL('../functions/owner-admin/index.js', import.meta.url), 'utf8')).replace(/^import .*;\s*$/gm, '');
const { createOwnerAdminHandler } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const OWNER = '10000000-0000-0000-0000-000000000002';
const ATTACKER = '10000000-0000-0000-0000-000000000003';
const TENANT = '00000000-0000-0000-0000-000000000001';
const MULTI_TENANT = '00000000-0000-0000-0000-000000000002';
const IDEMPOTENCY_KEY = '40000000-0000-0000-0000-00000000000b';
const AUDIT_FAILURE_KEY = '40000000-0000-0000-0000-00000000000c';
const BRANCH_TEST_KEY = '40000000-0000-0000-0000-00000000000d';
const LOST_RESPONSE_KEY = '40000000-0000-0000-0000-00000000000e';
const LATER_UPDATE_KEY = '40000000-0000-0000-0000-00000000000f';

function psql(sql, vars = {}) {
  const args = ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', socket, '-U', dbUser, '-d', 'postgres'];
  for (const [key, value] of Object.entries(vars)) args.push('-v', `${key}=${value}`);
  const result = spawnSync(bin, args, { input: `\\set VERBOSITY verbose\n${sql}\n`, encoding: 'utf8', env: { PATH: '/usr/bin:/bin', HOME: '/tmp', LC_ALL: 'C' } });
  if (result.error) throw result.error;
  return result;
}
function query(sql) {
  const result = psql(sql);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function snapshot() {
  return JSON.parse(query(`SELECT json_build_object(
    'plan', (SELECT plan FROM public.tenant_subscriptions WHERE tenant_id='${TENANT}'),
    'starts_at', (SELECT starts_at FROM public.tenant_subscriptions WHERE tenant_id='${TENANT}'),
    'ends_at', (SELECT ends_at FROM public.tenant_subscriptions WHERE tenant_id='${TENANT}'),
    'audit_count', (SELECT count(*) FROM public.platform_owner_audit),
    'last', (SELECT row_to_json(a) FROM (SELECT actor_id,target_user_id,target_tenant_id,action,outcome FROM public.platform_owner_audit ORDER BY id DESC LIMIT 1) a)
  )::text;`));
}
function harness({ actorId = OWNER, mode = '', lostResponse = false } = {}) {
  const calls = [];
  let loseNextResponse = lostResponse;
  const actor = { id: actorId, email: 'serviotech.sa@gmail.com', email_confirmed_at: '2026-01-01T00:00:00Z' };
  const service = {
    from(table) {
      calls.push(['from', table]);
      return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: null, error: null }; } };
    },
    async rpc(name, params) { calls.push(['serviceRpc', name, params]); throw new Error('Unexpected service RPC in subscription path'); },
  };
  const authenticated = {
    auth: { async getUser(token) { calls.push(['getUser', token]); return { data: { user: actor }, error: null }; } },
    async rpc(name, params) {
      calls.push(['userRpc', name, params]);
      if (name === 'platform_current_user_allowed') return { data: true, error: null };
      assert.equal(name, 'owner_set_subscription_idempotent_v1');
      const result = psql(`SET ROLE authenticated;
SET request.jwt.claim.sub TO :'actor';
SET request.jwt.claim.role TO 'authenticated';
SET request.jwt.claims TO '{}';
SET test.audit_mode TO :'mode';
SELECT row_to_json(s)::text FROM public.owner_set_subscription_idempotent_v1(:'tenant'::uuid, :'plan', :'starts'::timestamptz, NULLIF(:'ends','')::timestamptz, :'key'::uuid) AS s;`, {
        actor: actorId, mode, tenant: params.p_tenant_id, plan: params.p_plan, starts: params.p_starts_at, ends: params.p_ends_at ?? '', key: params.p_idempotency_key,
      });
      if (result.status !== 0) return { data: null, error: { code: /ERROR:\s+([0-9A-Z]{5}):/.exec(result.stderr)?.[1] ?? 'unknown' } };
      if (loseNextResponse) { loseNextResponse = false; return { data: null, error: { message: 'simulated lost response' } }; }
      return { data: JSON.parse(result.stdout.trim()), error: null };
    },
  };
  const makeClient = (_url, key, opts) => { calls.push(['client', key, opts]); return key === 'service' ? service : authenticated; };
  const env = (name) => ({ SUPABASE_URL: 'local-test-only', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' })[name];
  const handler = createOwnerAdminHandler({ makeClient, env });
  const request = (body) => handler(new Request('https://test.invalid', { method: 'POST', headers: { authorization: 'Bearer test-owner-token', 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  return { request, calls };
}
const body = (tenant = TENANT, plan = 'starter', key = IDEMPOTENCY_KEY) => ({ action: 'set_subscription', tenant_id: tenant, plan, starts_at: '2029-01-01T00:00:00Z', ends_at: null, idempotency_key: key });
const assertNoServiceAudit = (h) => assert.ok(!h.calls.some((c) => c[0] === 'serviceRpc' && c[1] === 'platform_owner_audit_event'));

test('new Edge deployed before the migration cannot fall back to the unaudited RPC', { skip: !enabled || !beforeMigration }, async () => {
  const before = snapshot();
  const h = harness();
  const response = await h.request(body(TENANT, 'pro'));
  assert.equal(response.status, 503);
  assert.notEqual((await response.json()).success, true);
  assert.deepEqual(snapshot(), before);
  assertNoServiceAudit(h);
  assert.ok(!h.calls.some((c) => c[0] === 'userRpc' && ['owner_set_subscription', 'owner_set_subscription_audited'].includes(c[1])));
});

test('Edge executes real idempotent v1 RPC and commits exactly one authentic success event', { skip: !enabled || beforeMigration }, async () => {
  const before = snapshot();
  const h = harness();
  const response = await h.request(body());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
  const after = snapshot();
  assert.equal(after.plan, 'starter');
  assert.equal(after.audit_count, before.audit_count + 1);
  assert.deepEqual(after.last, { actor_id: OWNER, target_user_id: null, target_tenant_id: TENANT, action: 'set_subscription', outcome: 'completed' });
  assertNoServiceAudit(h);
  assert.ok(h.calls.some((c) => c[0] === 'client' && c[1] === 'anon' && c[2].global.headers.Authorization === 'Bearer test-owner-token'));
});

test('database audit failure during Edge request rolls back all fields and emits no success', { skip: !enabled || beforeMigration }, async () => {
  for (const mode of ['error', 'skip', 'rewrite']) {
    const before = snapshot();
    const h = harness({ mode });
    const response = await h.request(body(TENANT, 'pro', AUDIT_FAILURE_KEY));
    assert.equal(response.status, 503, mode);
    assert.notEqual((await response.json()).success, true, mode);
    assert.deepEqual(snapshot(), before, mode);
    assertNoServiceAudit(h);
  }
});

test('branch validation and spoofed actor identity reject without an audit completion', { skip: !enabled || beforeMigration }, async () => {
  const before = snapshot();
  const conflict = harness();
  assert.equal((await conflict.request(body(MULTI_TENANT, 'starter', BRANCH_TEST_KEY))).status, 409);
  assertNoServiceAudit(conflict);
  const forged = harness({ actorId: ATTACKER });
  assert.equal((await forged.request(body(TENANT, 'pro', BRANCH_TEST_KEY))).status, 503);
  assertNoServiceAudit(forged);
  assert.deepEqual(snapshot(), before);
});

test('lost response replay returns current state without duplicate mutation or audit; changed payload conflicts', { skip: !enabled || beforeMigration }, async () => {
  const before = snapshot();
  const h = harness({ lostResponse: true });
  const attempt = body(TENANT, 'pro', LOST_RESPONSE_KEY);
  const response = await h.request(attempt);
  const payload = await response.json();
  assert.equal(response.status, 503);
  assert.match(payload.error, /same key and payload/i);
  const after = snapshot();
  assert.equal(after.plan, 'pro');
  assert.equal(after.audit_count, before.audit_count + 1);
  assert.equal(after.last.actor_id, OWNER);
  assert.equal(after.last.outcome, 'completed');
  const laterUpdate = await h.request(body(TENANT, 'starter', LATER_UPDATE_KEY));
  assert.equal(laterUpdate.status, 200);
  assert.equal(snapshot().audit_count, before.audit_count + 2);
  const replay = await h.request(attempt);
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).subscription.plan, 'starter');
  const replayed = snapshot();
  assert.equal(replayed.audit_count, before.audit_count + 2);
  assert.equal(replayed.plan, 'starter');
  const mismatch = await h.request(body(TENANT, 'starter', LOST_RESPONSE_KEY));
  assert.equal(mismatch.status, 409);
  assert.equal((await mismatch.json()).code, 'IDEMPOTENCY_KEY_CONFLICT');
  assert.equal(snapshot().plan, 'starter');
  assert.equal(snapshot().audit_count, before.audit_count + 2);
  assertNoServiceAudit(h);
});
