import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = async (name, fakeClient, nonce = '') => {
  const source = (await readFile(new URL(`../${name}/index.js`, import.meta.url), 'utf8')).replace(/^import .*;\s*$/gm, '');
  let handler;
  globalThis.__ownerTestClient = fakeClient;
  globalThis.Deno = { env: { get: (name) => name === 'SUPABASE_SERVICE_ROLE_KEY' ? 'service' : 'anon' }, serve: (fn) => { handler = fn; } };
  await import(`data:text/javascript;base64,${Buffer.from(`const createClient=globalThis.__ownerTestClient;\n${source}\n// ${nonce}`).toString('base64')}`);
  return handler;
};
const req = (body) => new Request('https://test.invalid', { method: 'POST', headers: { authorization: 'Bearer token', 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('blocked manager cannot reach service-role cashier delete path', async () => {
  const calls = [];
  const user = { auth: { async getUser() { return { data: { user: { id: 'manager' } }, error: null }; } }, async rpc() { calls.push('rpc'); return {}; } };
  const service = { from(table) { calls.push(table); return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { user_id: 'manager' }, error: null }; } }; } };
  const handler = await load('cashier-delete', (_url, key) => key === 'service' ? service : user);
  const result = await handler(req({ cashier_id: '20000000-0000-0000-0000-000000000002' }));
  assert.equal(result.status, 403);
  assert.deepEqual(calls, ['platform_user_blocks']);
});

test('revoked manager session cannot reach service-role cashier delete after unban', async () => {
  const calls = [];
  const user = { auth: { async getUser() { return { data: { user: { id: 'manager' } }, error: null }; } }, async rpc(name) { calls.push(name); return { data: false, error: null }; } };
  const service = { from(table) { calls.push(table); return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: null, error: null }; } }; } };
  const handler = await load('cashier-delete', (_url, key) => key === 'service' ? service : user, 'revoked-session');
  const result = await handler(req({ cashier_id: '20000000-0000-0000-0000-000000000002' }));
  assert.equal(result.status, 403);
  assert.deepEqual(calls, ['platform_user_blocks', 'platform_current_user_allowed']);
});

test('cashier login refuses ledger blocks and direct Auth bans before password rotation', async () => {
  for (const mode of ['ledger', 'ledger-error', 'auth-banned', 'auth-error', 'allowed']) {
    const calls = [];
    const service = {
      async rpc(name) {
        if (name === 'check_cashier_login_rate_limit') return { data: { allowed: true }, error: null };
        return { data: [{ id: 'cashier', auth_user_id: 'account', tenant_id: 'tenant', branch_id: 'branch', full_name: 'Name' }], error: null };
      },
      from() { return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: mode === 'ledger' ? { user_id: 'account' } : null, error: mode === 'ledger-error' ? {} : null }; } }; },
      auth: { admin: {
        async getUserById() { calls.push('getUserById'); return { data: { user: { banned_until: mode === 'auth-banned' ? '2099-01-01T00:00:00Z' : null } }, error: mode === 'auth-error' ? {} : null }; },
        async updateUserById() { calls.push('updateUserById'); return { error: null }; },
      } },
    };
    // Give each import a distinct URL; the source itself includes the test mode.
    const source = (await readFile(new URL('../cashier-login/index.js', import.meta.url), 'utf8')).replace(/^import .*;\s*$/gm, '');
    let handler;
    globalThis.__ownerTestClient = () => service;
    globalThis.Deno = { env: { get: () => 'local' }, serve: (fn) => { handler = fn; } };
    await import(`data:text/javascript;base64,${Buffer.from(`const createClient=globalThis.__ownerTestClient;\n${source}\n// ${mode}`).toString('base64')}`);
    const result = await handler(req({ slug: 's', branch_slug: 'b', username: 'cashier', pin: '1234' }));
    assert.equal(result.status, mode === 'allowed' ? 200 : 401, mode);
    assert.equal(calls.includes('updateUserById'), mode === 'allowed', mode);
  }
});

test('cashier login CORS allows the configured local app origins only', async () => {
  const handler = await load('cashier-login', () => {
    throw new Error('Supabase client should not be created for preflight requests');
  }, 'cors-origins');
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:3010',
    'http://127.0.0.1:3010',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];

  for (const origin of allowedOrigins) {
    const response = await handler(new Request('https://test.invalid', {
      method: 'OPTIONS',
      headers: { origin },
    }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  }

  const blockedOrigin = 'http://localhost:9999';
  const blockedResponse = await handler(new Request('https://test.invalid', {
    method: 'OPTIONS',
    headers: { origin: blockedOrigin },
  }));
  assert.notEqual(blockedResponse.headers.get('Access-Control-Allow-Origin'), blockedOrigin);
});
