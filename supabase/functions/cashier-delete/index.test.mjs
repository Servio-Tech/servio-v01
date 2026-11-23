import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const cashierId = '60000000-0000-0000-0000-000000000001';
const request = (id = cashierId) => new Request('https://test.invalid', {
  method: 'POST', headers: { authorization: 'Bearer local-token', 'content-type': 'application/json' },
  body: JSON.stringify({ cashier_id: id }),
});

async function handlerFor({ archiveError = null, archived = true, managerRole = 'admin' } = {}) {
  const calls = [];
  const user = {
    auth: { async getUser() { return { data: { user: { id: 'manager' } }, error: null }; } },
    async rpc(name, args) {
      calls.push(['rpc', name, args]);
      if (name === 'platform_current_user_allowed') return { data: true, error: null };
      if (name === 'deactivate_cashier') return { data: archived ? [{ id: cashierId, full_name: 'Example', auth_user_id: 'auth-id', is_active: false }] : [], error: archiveError };
      throw new Error(`unexpected RPC ${name}`);
    },
  };
  const service = {
    from(table) {
      calls.push(['from', table]);
      if (!['platform_user_blocks', 'profiles'].includes(table)) throw new Error(`unexpected table write: ${table}`);
      return { select() { return this; }, eq() { return this; }, async maybeSingle() {
        return { data: table === 'profiles' ? { role: managerRole, tenant_id: 'tenant' } : null, error: null };
      } };
    },
    auth: { admin: { async deleteUser() { calls.push(['deleteUser']); throw new Error('Auth deletion is forbidden'); } } },
  };
  const source = (await readFile(new URL('./index.js', import.meta.url), 'utf8')).replace(/^import .*;\s*$/gm, '');
  let handler;
  globalThis.__cashierTestClient = (_url, key) => key === 'service' ? service : user;
  globalThis.Deno = { env: { get: (name) => name === 'SUPABASE_SERVICE_ROLE_KEY' ? 'service' : 'anon' }, serve: (fn) => { handler = fn; } };
  await import(`data:text/javascript;base64,${Buffer.from(`const createClient=globalThis.__cashierTestClient;\n${source}\n// ${Math.random()}`).toString('base64')}`);
  return { handler, calls };
}

test('last active cashier is rejected without Auth deletion or unlink', async () => {
  const { handler, calls } = await handlerFor({ archiveError: { code: '23514', message: 'LAST_ACTIVE_CASHIER' } });
  const response = await handler(request());
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /آخر كاشير/);
  assert.deepEqual(calls.map(c => c[1]), ['platform_user_blocks', 'platform_current_user_allowed', 'profiles', 'deactivate_cashier']);
});

test('successful deletion is explicitly archival, never Auth deletion/unlink', async () => {
  const { handler, calls } = await handlerFor();
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, archived: true, auth_identity_retained: true, cashier_id: cashierId, full_name: 'Example' });
  assert.deepEqual(calls.map(c => c[1]), ['platform_user_blocks', 'platform_current_user_allowed', 'profiles', 'deactivate_cashier']);
});

test('open shift and unexpected DB failure cannot trigger a separate Auth deletion', async () => {
  for (const [error, status] of [[{code:'55000',message:'open shift'},409], [{code:'40001',message:'serialization'},500], [{code:'0A000',message:'unsupported'},500]]) {
    const { handler, calls } = await handlerFor({ archiveError: error });
    assert.equal((await handler(request())).status, status);
    assert.equal(calls.some(c => c[0] === 'deleteUser' || (c[0] === 'from' && c[1] === 'cashiers')), false);
  }
});

test('non-manager and invalid cashier ID cannot start archiving', async () => {
  const nonManager = await handlerFor({ managerRole: 'cashier' });
  assert.equal((await nonManager.handler(request())).status, 403);
  assert.equal(nonManager.calls.some(c => c[1] === 'deactivate_cashier'), false);
  const badId = await handlerFor();
  assert.equal((await badId.handler(request('bad-id'))).status, 400);
  assert.equal(badId.calls.some(c => c[1] === 'deactivate_cashier'), false);
});
