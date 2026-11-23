#!/usr/bin/env bash
set -euo pipefail
# Local-only isolated cluster; no production URL or credentials are used.
BIN=${PG_BIN:-/usr/lib/postgresql/16/bin}
ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
TMP=$(mktemp -d /tmp/servio-owner-test.XXXXXX)
cleanup() { "$BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$BIN/initdb" -D "$TMP/data" -A trust -U postgres >"$TMP/init.log"
"$BIN/pg_ctl" -D "$TMP/data" -o "-k $TMP -c listen_addresses=''" -l "$TMP/server.log" start >/dev/null
PSQL=("$BIN/psql" -X -v ON_ERROR_STOP=1 -h "$TMP" -U postgres -d postgres)
"${PSQL[@]}" <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator NOLOGIN;
CREATE ROLE supabase_storage_admin NOLOGIN;
CREATE ROLE supabase_realtime_admin NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE SCHEMA realtime;
GRANT USAGE ON SCHEMA auth, public, storage, realtime TO anon, authenticated, service_role;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz);
CREATE TABLE auth.sessions (id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users ON DELETE CASCADE);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid
$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role'
$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb
$$;
CREATE TABLE public.tenants (id uuid PRIMARY KEY, name text, slug text);
CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE, tenant_id uuid REFERENCES public.tenants, role text);
CREATE TABLE public.tenant_subscriptions (tenant_id uuid PRIMARY KEY REFERENCES public.tenants, plan text, starts_at timestamptz, ends_at timestamptz);
CREATE TABLE public.branches (id uuid PRIMARY KEY, tenant_id uuid REFERENCES public.tenants);
CREATE TABLE public.docs (id int PRIMARY KEY, body text);
ALTER TABLE public.docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY docs_read ON public.docs FOR SELECT TO authenticated USING (true);
CREATE POLICY docs_public_read ON public.docs FOR SELECT TO anon USING (true);
GRANT SELECT ON public.docs TO anon, authenticated;
INSERT INTO public.docs VALUES (1, 'private');
CREATE TABLE storage.objects (id int PRIMARY KEY, owner_id text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY storage_read ON storage.objects FOR SELECT TO authenticated USING (true);
CREATE TABLE realtime.messages (id int PRIMARY KEY);
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY realtime_read ON realtime.messages FOR SELECT TO authenticated USING (true);
ALTER TABLE storage.objects OWNER TO supabase_storage_admin;
ALTER TABLE realtime.messages OWNER TO supabase_realtime_admin;
CREATE FUNCTION public.reject_system_schema_policy_ddl() RETURNS event_trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TAG IN ('CREATE POLICY','ALTER POLICY','DROP POLICY')
     AND pg_catalog.current_query() ~* '(storage\\.objects|realtime\\.messages)' THEN
    RAISE EXCEPTION 'migration attempted policy DDL on admin-owned system table';
  END IF;
END $$;
CREATE EVENT TRIGGER reject_system_schema_policy_ddl
  ON ddl_command_start EXECUTE FUNCTION public.reject_system_schema_policy_ddl();
CREATE TABLE public.cashier_sessions (id int PRIMARY KEY, auth_user_id uuid REFERENCES auth.users ON DELETE RESTRICT);
-- Production has a unique auth_user_id but no Auth FK: exercise that case.
CREATE TABLE public.cashiers (id int PRIMARY KEY, auth_user_id uuid UNIQUE);
CREATE TABLE public.notification_subscriptions (id int PRIMARY KEY, user_id uuid REFERENCES auth.users ON DELETE CASCADE);
CREATE TABLE public.notification_deliveries (id int PRIMARY KEY, subscription_id int REFERENCES public.notification_subscriptions ON DELETE CASCADE, status text);
CREATE FUNCTION public.sensitive_rpc() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$ SELECT body FROM public.docs LIMIT 1 $$;
GRANT EXECUTE ON FUNCTION public.sensitive_rpc() TO authenticated;
INSERT INTO auth.users VALUES
 ('10000000-0000-0000-0000-000000000001','serviotech.sa@gmail.com',now()),
 ('20000000-0000-0000-0000-000000000002','user@example.com',now()),
 ('30000000-0000-0000-0000-000000000003','cashier@example.com',now()),
 ('40000000-0000-0000-0000-000000000004','safe@example.com',now()),
 ('50000000-0000-0000-0000-000000000000','cashier2@example.com',now());
ALTER TABLE auth.users ADD COLUMN banned_until timestamptz;
INSERT INTO public.tenants VALUES ('50000000-0000-0000-0000-000000000005','Tenant','tenant');
INSERT INTO public.profiles VALUES
 ('20000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000005','admin'),
 ('30000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000005','cashier'),
 ('40000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000005','admin');
INSERT INTO public.tenant_subscriptions VALUES ('50000000-0000-0000-0000-000000000005','starter',now(),null);
INSERT INTO public.branches VALUES ('60000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000005');
INSERT INTO auth.sessions VALUES ('70000000-0000-0000-0000-000000000007','20000000-0000-0000-0000-000000000002');
INSERT INTO public.cashier_sessions VALUES (1,'30000000-0000-0000-0000-000000000003');
INSERT INTO public.cashiers VALUES (2,'50000000-0000-0000-0000-000000000000');
INSERT INTO public.notification_subscriptions VALUES (1,'20000000-0000-0000-0000-000000000002');
INSERT INTO public.notification_deliveries VALUES (1,1,'pending');
SQL
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261122020000_owner_user_blocks.sql" >/dev/null
"${PSQL[@]}" <<'SQL'
DO $$ BEGIN
 IF (SELECT relowner FROM pg_catalog.pg_class WHERE oid='storage.objects'::regclass)
      <> (SELECT oid FROM pg_catalog.pg_roles WHERE rolname='supabase_storage_admin')
    OR (SELECT relowner FROM pg_catalog.pg_class WHERE oid='realtime.messages'::regclass)
      <> (SELECT oid FROM pg_catalog.pg_roles WHERE rolname='supabase_realtime_admin') THEN
   RAISE EXCEPTION 'system table owner changed';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies
   WHERE (schemaname='storage' AND tablename='objects' OR schemaname='realtime' AND tablename='messages')
     AND policyname='platform_user_not_blocked') THEN
   RAISE EXCEPTION 'migration installed unsupported system-schema policy';
 END IF;
END $$;
-- Initial authenticated access and the request-hook canary.
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"20000000-0000-0000-0000-000000000002"}',false);
SET ROLE authenticated;
DO $$ BEGIN IF (SELECT count(*) FROM public.docs) <> 1 THEN RAISE EXCEPTION 'unblocked user denied'; END IF; END $$;
BEGIN;
SELECT public.platform_block_request_guard();
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',false);
SET ROLE service_role;
DO $$ BEGIN IF NOT public.platform_block_guard_status() THEN RAISE EXCEPTION 'hook canary missing'; END IF; END $$;
COMMIT;
SELECT public.platform_begin_block_operation('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','ban_user','80000000-0000-0000-0000-000000000008');
RESET ROLE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM auth.sessions) THEN RAISE EXCEPTION 'refresh sessions still present'; END IF; END $$;
-- Already queued pending messages cannot be claimed; no new delivery is made.
UPDATE public.notification_deliveries SET status='sending' WHERE id=1;
INSERT INTO public.notification_deliveries VALUES (2,1,'pending');
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.notification_deliveries WHERE id=1 AND status='sending') OR EXISTS(SELECT 1 FROM public.notification_deliveries WHERE id=2)
 THEN RAISE EXCEPTION 'blocked push was claimed'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"20000000-0000-0000-0000-000000000002"}',false);
SET ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.docs) <> 0 THEN RAISE EXCEPTION 'blocked RLS user can read'; END IF;
 BEGIN PERFORM public.platform_block_request_guard(); RAISE EXCEPTION 'blocked RPC guard did not reject';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',false);
SET ROLE service_role;
DO $$ BEGIN
 BEGIN PERFORM public.platform_begin_block_operation('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','unban_user','90000000-0000-0000-0000-000000000009');
 RAISE EXCEPTION 'concurrent operation not rejected'; EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL; END;
END $$;
SELECT public.platform_finish_block_operation('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','ban_user','80000000-0000-0000-0000-000000000008');
SELECT public.platform_begin_block_operation('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','unban_user','90000000-0000-0000-0000-000000000009');
SELECT public.platform_finish_block_operation('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','unban_user','90000000-0000-0000-0000-000000000009');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"20000000-0000-0000-0000-000000000002","session_id":"70000000-0000-0000-0000-000000000007"}',false);
SET ROLE authenticated;
DO $$ BEGIN IF (SELECT count(*) FROM public.docs) <> 0 THEN RAISE EXCEPTION 'old revoked JWT reactivated after unban'; END IF; END $$;
RESET ROLE;
INSERT INTO auth.sessions VALUES ('70000000-0000-0000-0000-000000000008','20000000-0000-0000-0000-000000000002');
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"20000000-0000-0000-0000-000000000002","session_id":"70000000-0000-0000-0000-000000000008"}',false);
SET ROLE authenticated;
DO $$ BEGIN IF (SELECT count(*) FROM public.docs) <> 1 THEN RAISE EXCEPTION 'new post-unban session denied'; END IF; END $$;
RESET ROLE;
UPDATE public.notification_deliveries SET status='sending' WHERE id=1;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.notification_deliveries WHERE id=1 AND status='sending') THEN RAISE EXCEPTION 'unblocked push denied'; END IF; END $$;
-- An out-of-band Auth ban must also block an existing JWT.
UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id='20000000-0000-0000-0000-000000000002';
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"20000000-0000-0000-0000-000000000002"}',false);
SET ROLE authenticated;
DO $$ BEGIN IF (SELECT count(*) FROM public.docs) <> 0 THEN RAISE EXCEPTION 'Auth-banned user can read'; END IF; END $$;
RESET ROLE;
UPDATE auth.users SET banned_until=NULL WHERE id='20000000-0000-0000-0000-000000000002';
SET ROLE anon;
DO $$ BEGIN IF (SELECT count(*) FROM public.docs) <> 1 THEN RAISE EXCEPTION 'public access broken'; END IF; END $$;
RESET ROLE;
SET ROLE service_role;
DO $$ BEGIN
 BEGIN PERFORM public.platform_prepare_user_deletion('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003');
 RAISE EXCEPTION 'restricted cashier was deletable'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN PERFORM public.platform_prepare_user_deletion('10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000000');
 RAISE EXCEPTION 'linked cashier was deletable'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN PERFORM public.platform_begin_block_operation('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','ban_user','80000000-0000-0000-0000-000000000008');
 RAISE EXCEPTION 'owner ban allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
-- Prepare passes with profile alone; a newly introduced FK is checked again in
-- the actual DELETE trigger, preserving the account and tenant rows.
SELECT public.platform_prepare_user_deletion('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000004');
RESET ROLE;
INSERT INTO public.cashier_sessions VALUES (2,'40000000-0000-0000-0000-000000000004');
DO $$ BEGIN
 BEGIN DELETE FROM auth.users WHERE id='40000000-0000-0000-0000-000000000004';
 RAISE EXCEPTION 'racing FK failed to protect account'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;
DELETE FROM public.cashier_sessions WHERE id=2;
DELETE FROM auth.users WHERE id='40000000-0000-0000-0000-000000000004';
SELECT set_config('request.jwt.claims','{"role":"service_role"}',false);
SET ROLE service_role;
SELECT public.platform_finish_user_deletion('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000004',true);
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.tenants) OR NOT EXISTS(SELECT 1 FROM public.branches) OR EXISTS(SELECT 1 FROM public.profiles WHERE id='40000000-0000-0000-0000-000000000004') THEN
  RAISE EXCEPTION 'unexpected deletion outcome'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"40000000-0000-0000-0000-000000000004"}',false);
SET ROLE authenticated;
DO $$ BEGIN IF (SELECT count(*) FROM public.docs) <> 0 THEN RAISE EXCEPTION 'deleted account JWT can read'; END IF; END $$;
RESET ROLE;
SELECT 'PostgreSQL local isolation tests passed' AS result;
SQL
