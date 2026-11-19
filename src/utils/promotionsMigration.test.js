import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(`
 CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
 CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.user', true), '')::uuid $$;
 CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.tenant', true), '')::uuid $$;
 CREATE FUNCTION public.is_current_tenant_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('test.admin', true) = 'true' $$;
 CREATE TABLE public.tenants(id uuid PRIMARY KEY);
 CREATE TABLE public.branches(id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES public.tenants(id),is_active boolean NOT NULL);
 CREATE TABLE public.menu_items(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,branch_id uuid NOT NULL,available boolean NOT NULL);
 CREATE TABLE public.menu_ingredients(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,branch_id uuid NOT NULL,available boolean NOT NULL);
 CREATE TABLE public.menu_item_ingredients(menu_item_id uuid,ingredient_id uuid,tenant_id uuid NOT NULL,branch_id uuid NOT NULL);
 INSERT INTO tenants VALUES ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
 INSERT INTO branches VALUES
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',true),
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',true);
 INSERT INTO menu_items VALUES
 ('11000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',true),
 ('22000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001',true);
 SELECT set_config('test.user','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false),set_config('test.tenant','00000000-0000-0000-0000-000000000001',false),set_config('test.admin','true',false);
`);
const sql = await readFile(new URL('../../supabase/migrations/20261119121000_promotions_management.sql', import.meta.url),'utf8');
await db.exec(sql);
const save = (item, branch='10000000-0000-0000-0000-000000000001', starts='NULL') => `SELECT public.save_branch_promotion(NULL,'${branch}','عرض','Offer','','','percentage',10,${starts},NULL,true,ARRAY['${item}'::uuid]) AS id`;
await db.exec('SET ROLE authenticated');
const offer = (await db.query(save('11000000-0000-0000-0000-000000000001'))).rows[0].id;
await assert.rejects(db.query(save('22000000-0000-0000-0000-000000000001')), /Select valid items/);
await assert.rejects(db.query(save('22000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001')), /Active branch not found/);
await db.exec("SELECT set_config('test.admin','false',false)");
await assert.rejects(db.query("SELECT * FROM public.get_branch_promotions('10000000-0000-0000-0000-000000000001')"), /Manager role required/);
await db.exec('RESET ROLE');
await db.exec('SET ROLE anon');
assert.equal((await db.query("SELECT * FROM public.get_active_promotions('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001')")).rows.length,1);
assert.equal((await db.query("SELECT * FROM public.get_active_promotions('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001')")).rows.length,0);
await assert.rejects(db.query('SELECT * FROM public.promotions'), /permission denied/);
await db.exec('RESET ROLE');
await db.exec("UPDATE public.menu_items SET available=false WHERE id='11000000-0000-0000-0000-000000000001'");
assert.equal((await db.query("SELECT * FROM public.get_active_promotions('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001')")).rows.length,0);
await db.exec("UPDATE public.menu_items SET available=true WHERE id='11000000-0000-0000-0000-000000000001'");
await db.exec(`UPDATE public.promotions SET starts_at=now()+interval '1 day' WHERE id='${offer}'`);
assert.equal((await db.query("SELECT * FROM public.get_active_promotions('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001')")).rows.length,0);
console.log('PASS: promotions RPC, tenant isolation, admin guard, direct-table denial, availability and schedules');
await db.close();
