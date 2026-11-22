\set ON_ERROR_STOP on
-- Called once per migration stage by registration_security_local.sh. The data,
-- roles and RLS below are a disposable approximation; no Supabase API is used.
BEGIN;
CREATE FUNCTION pg_temp.assert_true(ok boolean, description text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'assertion failed: %', description; END IF; END $$;
CREATE FUNCTION pg_temp.expect_error(statement text, expected_state text, expected_message text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE actual_state text; actual_message text;
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS actual_state=RETURNED_SQLSTATE, actual_message=MESSAGE_TEXT;
    IF actual_state IS DISTINCT FROM expected_state OR position(expected_message IN actual_message)=0 THEN
      RAISE EXCEPTION 'unexpected error for %: % % (expected % / %)',statement,actual_state,actual_message,expected_state,expected_message;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'expected error % for %, but command succeeded', expected_state, statement;
END $$;

-- A profileless Auth identity, not an Auth API call. The same UUIDs are safe to
-- reuse at each stage because the complete test is rolled back.
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES
 ('20000000-0000-0000-0000-000000000002','spoof@example.test',now(),'{"tenant_id":"00000000-0000-0000-0000-000000000001","role":"admin"}'),
 ('20000000-0000-0000-0000-000000000003','new@example.test',now(),'{"tenant_id":"00000000-0000-0000-0000-000000000001","role":"cashier","store_name":" New Place ","store_slug":" NEW-PLACE ","full_name":"New Manager","phone":" 050 ","currency":" SAR "}'),
 ('20000000-0000-0000-0000-000000000004','linked@example.test',now(),'{"tenant_id":"00000000-0000-0000-0000-000000000001","role":"admin","store_name":"Wrong Place","store_slug":"wrong-place","full_name":"Spoofed Name"}'),
 ('20000000-0000-0000-0000-000000000005','invalid@example.test',now(),'{"tenant_id":"not-a-uuid","role":"admin","store_name":"Bad","store_slug":"bad slug"}'),
 ('20000000-0000-0000-0000-000000000006','duplicate@example.test',now(),'{"role":"admin","store_name":"Duplicate","store_slug":"starter"}'),
 ('20000000-0000-0000-0000-000000000007','reserved@example.test',now(),'{"store_name":"Reserved","store_slug":"owner-console"}');
INSERT INTO public.cashiers(tenant_id,branch_id,auth_user_id,full_name,is_active,username,pin_hash)
SELECT tenant_id,id,'20000000-0000-0000-0000-000000000004','Real Cashier',true,'linked-test','unused'
FROM public.branches WHERE tenant_id='00000000-0000-0000-0000-000000000002' AND slug='main';
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.profiles WHERE id::text LIKE '20000000-%' AND id <> '20000000-0000-0000-0000-000000000009'), 'Auth insert must not provision a forged profile');

-- Effective ACLs and PUBLIC inheritance, not just textual GRANT statements.
SELECT pg_temp.assert_true(has_function_privilege('authenticated','public.ensure_profile_for_current_user()','EXECUTE')
 AND NOT has_function_privilege('anon','public.ensure_profile_for_current_user()','EXECUTE')
 AND NOT has_function_privilege('service_role','public.ensure_profile_for_current_user()','EXECUTE')
 AND NOT EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
   WHERE p.oid='public.ensure_profile_for_current_user()'::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE'), 'registration RPC ACL');
SELECT pg_temp.assert_true(NOT has_column_privilege('authenticated','public.cashiers','auth_user_id','UPDATE')
 AND NOT has_column_privilege('authenticated','public.profiles','tenant_id','UPDATE')
 AND NOT has_column_privilege('authenticated','public.profiles','role','UPDATE'), 'client cannot change trusted cashier binding or profile authority');
\if :wrapper
SELECT pg_temp.assert_true(position('servio_subscription_private.ensure_profile_for_current_user' IN pg_get_functiondef('public.ensure_profile_for_current_user()'::regprocedure))>0,
 'public registration is the subscription wrapper');
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM (VALUES ('anon'),('authenticated'),('service_role')) r(role_name)
 WHERE has_schema_privilege(r.role_name,'servio_subscription_private','USAGE')
 OR has_function_privilege(r.role_name,'servio_subscription_private.ensure_profile_for_current_user()','EXECUTE')),
 'private registration body has no effective API schema or function privilege');
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) r(role_name)
 WHERE n.nspname='servio_subscription_private' AND has_function_privilege(r.role_name,p.oid,'EXECUTE')),
 'all private copied bodies deny effective API execution');
\endif

-- The separately defined legacy creator is deliberately still callable by
-- anon until 220600. Demonstrate the intermediate exposure instead of claiming
-- those stages block unbound tenant creation. Everything is rolled back.
\if :final
\else
SELECT set_config('request.jwt.claim.role','anon',true),set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
SELECT set_config('test.legacy_orphan',public.create_tenant_for_registration('Legacy orphan','legacy-orphan-stage',NULL,NULL,NULL)::text,true);
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.tenants WHERE id=current_setting('test.legacy_orphan')::uuid AND slug='legacy-orphan-stage')
 AND (SELECT count(*)=1 FROM public.store WHERE tenant_id=current_setting('test.legacy_orphan')::uuid)
 AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE tenant_id=current_setting('test.legacy_orphan')::uuid),
 'intermediate legacy RPC really permits anonymous unbound tenant creation');
\endif

SELECT set_config('request.jwt.claim.role','anon',true),set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error('SELECT public.ensure_profile_for_current_user()','42501','permission denied');
\if :wrapper
SELECT pg_temp.expect_error('SELECT servio_subscription_private.ensure_profile_for_current_user()','42501','permission denied');
SELECT pg_temp.expect_error($q$SELECT servio_subscription_private.create_tenant_for_registration('Denied','denied',NULL,NULL,NULL)$q$,'42501','permission denied');
\endif
RESET ROLE;
SELECT set_config('request.jwt.claim.role','service_role',true);
SET LOCAL ROLE service_role;
SELECT pg_temp.expect_error('SELECT public.ensure_profile_for_current_user()','42501','permission denied');
\if :wrapper
SELECT pg_temp.expect_error('SELECT servio_subscription_private.ensure_profile_for_current_user()','42501','permission denied');
SELECT pg_temp.expect_error($q$SELECT servio_subscription_private.create_tenant_for_registration('Denied','denied',NULL,NULL,NULL)$q$,'42501','permission denied');
\endif
RESET ROLE;
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE authenticated;
\if :wrapper
-- Wrapper denies an empty subject before reaching its body; both outcomes are
-- insufficient-privilege, but wrapper intentionally says Service unavailable.
SELECT pg_temp.expect_error('SELECT public.ensure_profile_for_current_user()','42501','Service unavailable');
\else
SELECT pg_temp.expect_error('SELECT public.ensure_profile_for_current_user()','42501','Unauthenticated');
\endif
RESET ROLE;

-- Attacker provides only victim tenant and elevated role: no profile, no store.
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error('SELECT public.ensure_profile_for_current_user()','22023','Tenant name is required');
SELECT pg_temp.assert_true(public.current_tenant_id() IS NULL AND NOT public.is_current_tenant_admin(), 'spoof identity has no tenant or admin authority');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.store), 'profileless attacker cannot read victim store');
\if :wrapper
SELECT pg_temp.expect_error('SELECT servio_subscription_private.ensure_profile_for_current_user()','42501','permission denied');
SELECT pg_temp.expect_error($q$SELECT servio_subscription_private.create_tenant_for_registration('Denied','denied',NULL,NULL,NULL)$q$,'42501','permission denied');
\endif
RESET ROLE;
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.profiles WHERE id='20000000-0000-0000-0000-000000000002'), 'spoof failure leaves no profile');

-- Valid registration ignores both a forged victim tenant and forged cashier
-- role, creates one independent tenant atomically, and is idempotent on return.
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE a public.profiles; b public.profiles; BEGIN
 a:=public.ensure_profile_for_current_user(); b:=public.ensure_profile_for_current_user();
 IF a.id<>'20000000-0000-0000-0000-000000000003'::uuid OR a.role<>'admin'
    OR a.tenant_id='00000000-0000-0000-0000-000000000001'::uuid OR a.tenant_id IS DISTINCT FROM b.tenant_id OR b.role<>'admin'
    OR public.current_tenant_id() IS DISTINCT FROM a.tenant_id OR NOT public.is_current_tenant_admin() THEN
   RAISE EXCEPTION 'new/returning registration or authority incorrect';
 END IF;
 PERFORM set_config('test.registration_tenant',a.tenant_id::text,true);
END $$;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.store WHERE tenant_id=current_setting('test.registration_tenant')::uuid), 'new admin reads own store');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.store WHERE tenant_id='00000000-0000-0000-0000-000000000001'), 'new admin cannot read victim store');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.branches WHERE tenant_id=current_setting('test.registration_tenant')::uuid)
 AND (SELECT count(*)=0 FROM public.branches WHERE tenant_id='00000000-0000-0000-0000-000000000001'), 'branch RLS isolates new tenant');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.tenant_subscriptions WHERE tenant_id=current_setting('test.registration_tenant')::uuid AND plan='starter')
 AND (SELECT count(*)=0 FROM public.tenant_subscriptions WHERE tenant_id='00000000-0000-0000-0000-000000000001'), 'subscription RLS isolates new tenant');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.profiles WHERE id='20000000-0000-0000-0000-000000000003')
 AND (SELECT count(*)=0 FROM public.profiles WHERE id='10000000-0000-0000-0000-000000000001'), 'profile RLS hides victim');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.cashiers WHERE tenant_id='00000000-0000-0000-0000-000000000002'), 'cashier RLS hides other tenant');
WITH changed AS (UPDATE public.store SET store_name='attacker wrote' WHERE tenant_id='00000000-0000-0000-0000-000000000001' RETURNING 1)
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM changed), 'cross-tenant store update affects no rows');
SELECT pg_temp.expect_error($q$INSERT INTO public.store(tenant_id,store_name) VALUES ('00000000-0000-0000-0000-000000000001','intrusion')$q$,'42501','row-level security');
SELECT pg_temp.expect_error($q$UPDATE public.profiles SET role='admin' WHERE id='20000000-0000-0000-0000-000000000003'$q$,'42501','permission denied');
SELECT pg_temp.expect_error($q$UPDATE public.cashiers SET auth_user_id='20000000-0000-0000-0000-000000000003'$q$,'42501','permission denied');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.tenants WHERE id=current_setting('test.registration_tenant')::uuid AND name='New Place' AND slug='new-place')
 AND (SELECT count(*)=1 FROM public.store WHERE tenant_id=current_setting('test.registration_tenant')::uuid AND store_slug='new-place' AND email='new@example.test' AND phone='050' AND currency='SAR')
 AND (SELECT count(*)=1 FROM public.branches WHERE tenant_id=current_setting('test.registration_tenant')::uuid AND slug='main')
 AND (SELECT count(*)=1 FROM public.tenant_subscriptions WHERE tenant_id=current_setting('test.registration_tenant')::uuid AND plan='starter')
 AND (SELECT count(*)=1 FROM public.profiles WHERE id='20000000-0000-0000-0000-000000000003'), 'exactly one complete linked registration');
SELECT pg_temp.assert_true((SELECT store_name='Starter tenant' FROM public.store WHERE tenant_id='00000000-0000-0000-0000-000000000001'), 'victim store unchanged');

-- The original manager can still return to their own tenant, but cannot read
-- or update the freshly registered tenant. Test isolation in both directions.
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE p public.profiles; BEGIN p:=public.ensure_profile_for_current_user();
 IF p.id<>'10000000-0000-0000-0000-000000000001'::uuid OR p.tenant_id<>'00000000-0000-0000-0000-000000000001'::uuid
    OR p.role<>'admin' OR NOT public.is_current_tenant_admin() THEN RAISE EXCEPTION 'existing manager return failed'; END IF; END $$;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.store WHERE tenant_id='00000000-0000-0000-0000-000000000001')
 AND (SELECT count(*)=0 FROM public.store WHERE tenant_id=current_setting('test.registration_tenant')::uuid), 'existing manager cannot read new tenant');
WITH changed AS (UPDATE public.store SET store_name='reverse intrusion' WHERE tenant_id=current_setting('test.registration_tenant')::uuid RETURNING 1)
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM changed), 'existing manager cannot write new tenant');
RESET ROLE;

-- Updating Auth metadata cannot retarget the existing profile or elevate it.
UPDATE auth.users SET raw_user_meta_data='{"tenant_id":"00000000-0000-0000-0000-000000000002","role":"cashier","full_name":"Changed","phone":"123"}'
WHERE id='20000000-0000-0000-0000-000000000003';
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE p public.profiles; BEGIN p:=public.ensure_profile_for_current_user();
 IF p.tenant_id IS DISTINCT FROM current_setting('test.registration_tenant')::uuid OR p.role<>'admin' OR p.full_name<>'Changed' THEN
  RAISE EXCEPTION 'metadata update retargeted returning profile'; END IF; END $$;
RESET ROLE;

-- A server-linked cashier derives tenant and role from the row, not metadata;
-- even a valid manager-like store request cannot turn it into an admin.
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE a public.profiles; b public.profiles; BEGIN
 a:=public.ensure_profile_for_current_user(); b:=public.ensure_profile_for_current_user();
 IF a.tenant_id<>'00000000-0000-0000-0000-000000000002'::uuid OR a.role<>'cashier' OR a.full_name<>'Real Cashier'
   OR b.tenant_id IS DISTINCT FROM a.tenant_id OR b.role<>'cashier'
   OR public.current_tenant_id() IS DISTINCT FROM a.tenant_id OR public.is_current_tenant_admin() THEN
   RAISE EXCEPTION 'cashier was not bound to trusted identity'; END IF; END $$;
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.store WHERE tenant_id='00000000-0000-0000-0000-000000000001'), 'cashier cannot read victim store');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.tenant_subscriptions WHERE tenant_id='00000000-0000-0000-0000-000000000002'), 'cashier can read own tenant subscription');
RESET ROLE;
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.tenants WHERE slug='wrong-place'), 'cashier metadata did not create another tenant');
UPDATE auth.users SET raw_user_meta_data='{"tenant_id":"00000000-0000-0000-0000-000000000001","role":"admin","full_name":"Renamed cashier"}'
WHERE id='20000000-0000-0000-0000-000000000004';
SET LOCAL ROLE authenticated;
DO $$ DECLARE p public.profiles; BEGIN p:=public.ensure_profile_for_current_user();
 IF p.tenant_id<>'00000000-0000-0000-0000-000000000002'::uuid OR p.role<>'cashier'
   OR public.is_current_tenant_admin() OR public.current_tenant_id() IS DISTINCT FROM p.tenant_id THEN
   RAISE EXCEPTION 'cashier metadata update elevated or retargeted existing profile'; END IF; END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000009',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error('SELECT public.ensure_profile_for_current_user()','42501','Active cashier profile required');
SELECT pg_temp.assert_true(public.current_tenant_id() IS NULL, 'inactive profileless cashier has no tenant');
RESET ROLE;
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.profiles WHERE id='20000000-0000-0000-0000-000000000009'), 'inactive cashier not provisioned');

-- Invalid name/slug, existing and reserved slug must fail without partial rows.
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000005',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error('SELECT public.ensure_profile_for_current_user()','22023','Invalid slug');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000006',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error('SELECT public.ensure_profile_for_current_user()','23505','duplicate key');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000007',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error('SELECT public.ensure_profile_for_current_user()','23514','check constraint');
RESET ROLE;
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.profiles WHERE id IN ('20000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000006','20000000-0000-0000-0000-000000000007'))
 AND NOT EXISTS(SELECT 1 FROM public.tenants WHERE slug IN ('bad slug','owner-console')), 'failed requests leave no registrations');
\if :wrapper
-- Expiring this user's own subscription must block the public RPC. A private
-- body must not be an alternate path around the guard, even for that user.
UPDATE public.tenant_subscriptions SET starts_at=now()-interval '2 days', ends_at=now()-interval '1 day'
WHERE tenant_id=current_setting('test.registration_tenant')::uuid;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error('SELECT public.ensure_profile_for_current_user()','42501','Service unavailable');
SELECT pg_temp.expect_error('SELECT servio_subscription_private.ensure_profile_for_current_user()','42501','permission denied');
SELECT pg_temp.expect_error('SELECT count(*) FROM public.tenant_subscriptions','42501','Service unavailable');
RESET ROLE;
\endif
\if :final
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.create_tenant_for_registration(text,text,text,text,text)','EXECUTE')
 AND NOT has_function_privilege('authenticated','public.create_tenant_for_registration(text,text,text,text,text)','EXECUTE')
 AND has_function_privilege('service_role','public.create_tenant_for_registration(text,text,text,text,text)','EXECUTE'), 'legacy creator ACL after 220600');
SELECT set_config('request.jwt.claim.role','anon',true),set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error($q$SELECT public.create_tenant_for_registration('Denied anon','denied-anon',NULL,NULL,NULL)$q$,'42501','permission denied');
RESET ROLE;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT public.create_tenant_for_registration('Denied','denied',NULL,NULL,NULL)$q$,'42501','permission denied');
RESET ROLE;
\endif
ROLLBACK;
