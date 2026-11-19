// Offline only: node --test src/components/manager-dashboard/branches/deletion-migration.test.js
// Uses the PGlite development dependency; never connects to Supabase.
import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migration = new URL("../../../../supabase/migrations/20261119123000_safe_branch_deletion.sql", import.meta.url);
const tenant = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const otherTenant = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const main = "00000000-0000-0000-0000-000000000001";
const target = "00000000-0000-0000-0000-000000000002";
const other = "00000000-0000-0000-0000-000000000003";
const last = "00000000-0000-0000-0000-000000000004";
const user = "cccccccc-cccc-cccc-cccc-cccccccccccc";
let db;

before(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE SCHEMA extras;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('test.uid', true), '')::uuid $$;
    CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('test.tenant', true), '')::uuid $$;
    CREATE FUNCTION public.is_current_tenant_admin() RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('test.admin', true), '')::boolean $$;
    CREATE TABLE public.branches (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, slug text NOT NULL,
      is_active boolean NOT NULL DEFAULT true, UNIQUE(tenant_id, slug));
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
    CREATE TABLE public.orders (id integer PRIMARY KEY, branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE);
    CREATE TABLE public.menu_items (id integer PRIMARY KEY, branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE);
    CREATE TABLE public."table" (id integer PRIMARY KEY, branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE);
    CREATE TABLE public.cashiers (id integer PRIMARY KEY, branch_id uuid REFERENCES public.branches(id) ON DELETE RESTRICT);
    CREATE TABLE public.promotions (id integer PRIMARY KEY, branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE);
    CREATE TABLE public.notification_subscriptions (id integer PRIMARY KEY, branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE);
    CREATE TABLE public.notification_events (id integer PRIMARY KEY, branch_id uuid NOT NULL);
    CREATE TABLE extras.different_name (id integer PRIMARY KEY, place uuid REFERENCES public.branches(id) ON DELETE CASCADE);
    CREATE TABLE extras.composite_ref (id integer PRIMARY KEY, tenant uuid, slug_ref text,
      FOREIGN KEY (tenant, slug_ref) REFERENCES public.branches(tenant_id, slug) ON DELETE CASCADE);
    INSERT INTO public.notification_events VALUES (999, '99999999-9999-9999-9999-999999999999');
  `);
  await db.exec(await readFile(migration, "utf8"));
  assert.equal((await db.query("SELECT count(*)::int AS n FROM public.notification_events WHERE id = 999")).rows[0].n, 1);
});

after(async () => { if (db) await db.close(); });

beforeEach(async () => {
  await db.exec(`RESET ROLE;
    TRUNCATE public.orders, public.menu_items, public."table", public.cashiers, public.promotions,
      public.notification_subscriptions, public.notification_events, extras.different_name,
      extras.composite_ref, public.branches;
    INSERT INTO public.branches(id, tenant_id, slug, is_active) VALUES
      ('${main}', '${tenant}', 'main', true),
      ('${target}', '${tenant}', 'second', true),
      ('${other}', '${otherTenant}', 'main', true),
      ('${last}', '${otherTenant}', 'only-nonmain', false);
    SELECT set_config('test.uid', '${user}', false), set_config('test.tenant', '${tenant}', false), set_config('test.admin', 'true', false);
  `);
});

async function rpc(branch = target) {
  return db.query("SELECT public.delete_empty_branch($1::uuid) AS deleted", [branch]);
}
async function assertRejected(branch, code) {
  await assert.rejects(rpc(branch), (err) => err.message.includes(code));
  const { rows } = await db.query("SELECT id FROM public.branches WHERE id = $1", [branch]);
  assert.equal(rows.length, 1, "the branch must survive rejection");
}

test("deletes only the selected empty branch and leaves every other branch intact", async () => {
  await db.exec("SET ROLE authenticated");
  const result = await rpc();
  await db.exec("RESET ROLE");
  assert.equal(result.rows[0].deleted, true);
  const { rows } = await db.query("SELECT id FROM public.branches ORDER BY id");
  assert.deepEqual(rows.map((row) => row.id), [main, other, last]);
});

test("each ordinary and cascading reference preserves both branch and row", async () => {
  for (const table of ["orders", "menu_items", '"table"', "cashiers", "promotions", "notification_subscriptions", "notification_events"]) {
    await db.query(`INSERT INTO public.${table} (id, branch_id) VALUES (1, $1)`, [target]);
    await assertRejected(target, "branch_has_records");
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM public.${table} WHERE branch_id = $1`, [target]);
    assert.equal(rows[0].n, 1, table);
    await db.query(`DELETE FROM public.${table} WHERE id = 1`);
  }
});

test("discovers differently named and composite foreign keys in another schema", async () => {
  await db.query("INSERT INTO extras.different_name VALUES (1, $1)", [target]);
  await assertRejected(target, "branch_has_records");
  await db.exec("DELETE FROM extras.different_name");
  await db.query("INSERT INTO extras.composite_ref VALUES (1, $1, 'second')", [tenant]);
  await assertRejected(target, "branch_has_records");
  assert.equal((await db.query("SELECT count(*)::int AS n FROM extras.composite_ref")).rows[0].n, 1);
});

test("does not overlook child rows hidden from the authenticated role by RLS", async () => {
  await db.query("INSERT INTO public.orders (id, branch_id) VALUES (1, $1)", [target]);
  await db.exec("ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY; GRANT SELECT ON public.orders TO authenticated; SET ROLE authenticated");
  assert.equal((await db.query("SELECT count(*)::int AS n FROM public.orders")).rows[0].n, 0);
  await assert.rejects(rpc(), /branch_has_records/);
  await db.exec("RESET ROLE; ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY");
  assert.equal((await db.query("SELECT count(*)::int AS n FROM public.orders")).rows[0].n, 1);
});

test("protects main, last and cross-tenant branches including inactive ones", async () => {
  await assertRejected(main, "branch_main");
  await assertRejected(other, "branch_not_found");
  await db.exec(`DELETE FROM public.branches WHERE id='${main}';`);
  await assertRejected(target, "branch_last");
});

test("requires authenticated tenant administrators and refuses direct DELETE", async () => {
  await db.exec("SELECT set_config('test.admin', 'false', false)");
  await assertRejected(target, "branch_unauthorized");
  await db.exec("SELECT set_config('test.admin', '', false)");
  await assertRejected(target, "branch_unauthorized");
  await db.exec("SELECT set_config('test.admin', 'true', false), set_config('test.uid', '', false)");
  await assertRejected(target, "branch_unauthorized");
  await db.exec(`SELECT set_config('test.uid', '${user}', false); SET ROLE authenticated;`);
  await assert.rejects(db.query("DELETE FROM public.branches WHERE id = $1", [target]), /permission denied/);
  await db.exec("RESET ROLE; SET ROLE anon;");
  await assert.rejects(rpc(), /permission denied/);
  await db.exec("RESET ROLE");
});

test("NOT VALID notification FK preserves historical orphan yet rejects new orphans", async () => {
  // Before the migration an orphan existed. Its NOT VALID FK creation succeeded.
  // Future inserts cannot point to a missing branch, preventing a post-delete orphan.
  await assert.rejects(db.query("INSERT INTO public.notification_events VALUES (2, $1)", ["99999999-9999-9999-9999-999999999999"]), /foreign key/);
  await rpc();
  await assert.rejects(db.query("INSERT INTO public.notification_events VALUES (3, $1)", [target]), /foreign key/);
});

test("refuses unprotected future public branch_id tables, and unsupported isolation", async () => {
  await db.exec("CREATE TABLE public.unknown_future_table (branch_id uuid)");
  await assertRejected(target, "branch_reference_unprotected");
  await db.exec("DROP TABLE public.unknown_future_table");
  await db.exec("BEGIN ISOLATION LEVEL REPEATABLE READ");
  await assert.rejects(rpc(), /branch_isolation_unsupported/);
  await db.exec("ROLLBACK");
  assert.equal((await db.query("SELECT count(*)::int AS n FROM public.branches WHERE id = $1", [target])).rows[0].n, 1);
});
