import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
await db.exec(`
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE TABLE public.tenants (id uuid PRIMARY KEY, slug text UNIQUE NOT NULL);
  CREATE TABLE public.branches (
    id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    is_active boolean NOT NULL DEFAULT true
  );
  INSERT INTO tenants VALUES
    ('00000000-0000-0000-0000-000000000001','starter-test'),
    ('00000000-0000-0000-0000-000000000002','pro-test'),
    ('00000000-0000-0000-0000-000000000003','legacy-test');
  INSERT INTO branches VALUES
    ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',true),
    ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',true),
    ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003',true),
    ('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',true);
`);
const sql = await readFile(new URL('../../supabase/migrations/20261119122000_plan_entitlements.sql', import.meta.url), 'utf8');
await db.exec(sql);
assert.equal((await db.query("SELECT public.get_public_plan('starter-test') AS plan")).rows[0].plan, 'starter');
assert.equal((await db.query("SELECT public.get_public_plan('missing') AS plan")).rows[0].plan, null);
await db.exec("INSERT INTO public.tenant_entitlements(tenant_id,plan) VALUES ('00000000-0000-0000-0000-000000000002','pro')");
assert.equal((await db.query("SELECT public.get_public_plan('pro-test') AS plan")).rows[0].plan, 'pro');
await db.exec('SET ROLE anon');
assert.equal((await db.query("SELECT public.get_public_plan('pro-test') AS plan")).rows[0].plan, 'pro');
await assert.rejects(db.query('SELECT * FROM public.tenant_entitlements'), /permission denied/);
await db.exec('RESET ROLE');
await assert.rejects(db.exec("INSERT INTO branches VALUES ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',true)"), /Branch limit reached/);
await db.exec("INSERT INTO branches VALUES ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002',true), ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002',true)");
await assert.rejects(db.exec("INSERT INTO branches VALUES ('20000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002',true)"), /Branch limit reached/);
await db.exec("UPDATE branches SET is_active=false WHERE id='20000000-0000-0000-0000-000000000003'");
await assert.rejects(db.exec("INSERT INTO branches VALUES ('20000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002',false)"), /Branch limit reached/);
await db.exec("UPDATE branches SET is_active=true WHERE id='20000000-0000-0000-0000-000000000003'");
assert.equal((await db.query("SELECT count(*)::int AS n FROM branches WHERE tenant_id='00000000-0000-0000-0000-000000000003'")).rows[0].n, 2);
await assert.rejects(db.exec("INSERT INTO branches VALUES ('30000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000003',true)"), /Branch limit reached/);
console.log('PASS: public plan, protected assignments, starter=1, pro=3 total, inactive handling and legacy preservation');
await db.close();
