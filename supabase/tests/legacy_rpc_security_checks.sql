\set ON_ERROR_STOP on
BEGIN;
-- Effective privileges, PUBLIC inheritance, subscription-private copies, and
-- service maintenance rights are checked separately.
DO $$
DECLARE f text; p oid;
BEGIN
 FOREACH f IN ARRAY ARRAY['create_tenant_for_registration(text,text,text,text,text)', 'refresh_cashier_session_totals(uuid)'] LOOP
  p := ('public.' || f)::regprocedure;
  IF has_function_privilege('anon',p,'EXECUTE') OR has_function_privilege('authenticated',p,'EXECUTE')
     OR NOT has_function_privilege('service_role',p,'EXECUTE')
     OR EXISTS (SELECT 1 FROM pg_proc x CROSS JOIN LATERAL aclexplode(COALESCE(x.proacl,acldefault('f',x.proowner))) a
                WHERE x.oid=p AND a.grantee=0 AND a.privilege_type='EXECUTE') THEN
    RAISE EXCEPTION 'wrong effective or PUBLIC ACL for %',f;
  END IF;
  IF position('servio_subscription_private.' in pg_get_functiondef(p))=0
     OR has_schema_privilege('anon','servio_subscription_private','USAGE')
     OR has_schema_privilege('authenticated','servio_subscription_private','USAGE')
     OR has_schema_privilege('service_role','servio_subscription_private','USAGE')
     OR has_function_privilege('anon','servio_subscription_private.' || f,'EXECUTE')
     OR has_function_privilege('authenticated','servio_subscription_private.' || f,'EXECUTE')
     OR has_function_privilege('service_role','servio_subscription_private.' || f,'EXECUTE') THEN
    RAISE EXCEPTION 'wrapper or private ACL incorrect for %',f;
  END IF;
 END LOOP;
 IF NOT has_function_privilege('authenticated','public.ensure_profile_for_current_user()','EXECUTE')
    OR NOT has_function_privilege('anon','public.create_public_order_with_tracking(text,jsonb,numeric,text,text,text)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.create_public_order_with_tracking(text,jsonb,numeric,text,text,text)','EXECUTE')
    OR NOT has_function_privilege('anon','public.get_public_menu_items(text,text)','EXECUTE') THEN
   RAISE EXCEPTION 'registration or public menu/order ACL changed';
 END IF;
 IF (SELECT count(*) FROM public.legacy_rpc_security_snapshot)<>2 OR EXISTS (
   SELECT 1 FROM public.legacy_rpc_security_snapshot s LEFT JOIN pg_proc p ON p.oid=s.oid
   WHERE p.oid IS NULL OR p.prosrc IS DISTINCT FROM s.prosrc OR p.proowner<>s.proowner
      OR p.proacl IS DISTINCT FROM s.proacl OR p.prosecdef IS DISTINCT FROM s.prosecdef
      OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
 ) THEN RAISE EXCEPTION 'guard function identity, body, owner, ACL or search_path changed incorrectly'; END IF;
 IF EXISTS (SELECT 1 FROM public.legacy_rpc_security_triggers s LEFT JOIN pg_trigger t ON t.oid=s.oid
   WHERE t.oid IS NULL OR t.tgfoid<>s.tgfoid OR pg_get_triggerdef(t.oid)<>s.definition OR t.tgenabled<>s.tgenabled) THEN
   RAISE EXCEPTION 'an order trigger binding changed';
 END IF;
END $$;
-- Direct calls must actually fail under both API roles (not just catalog tests).
SELECT set_config('request.jwt.claim.role','anon',true),set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM public.create_tenant_for_registration('Denied anonymous','denied-anon'); RAISE EXCEPTION 'anon tenant call succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.refresh_cashier_session_totals('f0000000-0000-0000-0000-000000000001'); RAISE EXCEPTION 'anon refresh succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.create_tenant_for_registration('Denied staff','denied-staff'); RAISE EXCEPTION 'staff tenant call succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.refresh_cashier_session_totals('f0000000-0000-0000-0000-000000000001'); RAISE EXCEPTION 'staff refresh succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.tenants WHERE slug IN ('denied-anon','denied-staff')) THEN RAISE EXCEPTION 'denied RPC wrote tenant'; END IF;
END $$;
-- Actual post-21130000 registration; a new user cannot claim metadata's old
-- tenant and repeated provisioning returns the same linked profile.
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000005',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE a public.profiles; b public.profiles; BEGIN
 a:=public.ensure_profile_for_current_user(); b:=public.ensure_profile_for_current_user();
 IF a.id <> '10000000-0000-0000-0000-000000000005'::uuid OR a.tenant_id='00000000-0000-0000-0000-000000000001'::uuid
    OR a.role<>'admin' OR a.tenant_id<>b.tenant_id THEN RAISE EXCEPTION 'identity-bound registration failed'; END IF;
 PERFORM set_config('test.registered_tenant',a.tenant_id::text,true);
END $$;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id=current_setting('test.registered_tenant')::uuid AND slug='new-restaurant')
    OR NOT EXISTS (SELECT 1 FROM public.store WHERE tenant_id=current_setting('test.registered_tenant')::uuid)
    OR NOT EXISTS (SELECT 1 FROM public.branches WHERE tenant_id=current_setting('test.registered_tenant')::uuid AND slug='main')
    OR NOT EXISTS (SELECT 1 FROM public.tenant_subscriptions WHERE tenant_id=current_setting('test.registered_tenant')::uuid) THEN
   RAISE EXCEPTION 'registration did not create all linked records'; END IF;
END $$;
-- The original menu and tracking-order code executes through the public wrapper
-- with anonymous JWT; the orders' actual guards and sync trigger remain installed.
SELECT set_config('request.jwt.claim.role','anon',true),set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
DO $$ DECLARE j jsonb; BEGIN
 IF (SELECT count(*) FROM public.get_public_menu_items('starter','main'))<>1
    OR (SELECT count(*) FROM public.get_public_categories('starter','main'))<>1 THEN
   RAISE EXCEPTION 'anonymous menu broken'; END IF;
 j:=public.create_public_order_with_tracking('starter','[]'::jsonb,0,'1',NULL,'main');
 IF j->>'status'<>'pending' OR j->>'order_id' IS NULL OR j->>'tracking_token' IS NULL
    OR public.get_public_order_tracking('starter',(j->>'order_id')::uuid,j->>'tracking_token') IS NULL THEN
   RAISE EXCEPTION 'anonymous order/tracking broken'; END IF;
 j:=public.create_public_order_with_tracking('starter','[]'::jsonb,0,'1',NULL);
 IF j->>'order_id' IS NULL THEN RAISE EXCEPTION 'legacy public order overload broken'; END IF;
END $$;
RESET ROLE;
-- Test comparisons against hostile caller search_path and prove guards still
-- rewrite unpaid ready/served on insert and update while paid orders flow.
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE j jsonb; BEGIN
 IF (SELECT count(*) FROM public.get_public_menu_items('starter','main'))<>1 THEN RAISE EXCEPTION 'authenticated public menu broken'; END IF;
 j:=public.create_public_order_with_tracking('starter','[]'::jsonb,0,'1',NULL,'main');
 IF j->>'order_id' IS NULL THEN RAISE EXCEPTION 'authenticated public order broken'; END IF;
END $$;
RESET ROLE;
CREATE SCHEMA legacy_rpc_security_attack;
CREATE FUNCTION legacy_rpc_security_attack.fake_eq(text,text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT false $$;
CREATE OPERATOR legacy_rpc_security_attack.= (LEFTARG=text, RIGHTARG=text, FUNCTION=legacy_rpc_security_attack.fake_eq);
GRANT USAGE ON SCHEMA legacy_rpc_security_attack TO authenticated;
SELECT set_config('test.branch',(SELECT branch_id::text FROM public.cashier_sessions WHERE id='f0000000-0000-0000-0000-000000000001'),true);
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
SET LOCAL ROLE authenticated;
SET LOCAL search_path=legacy_rpc_security_attack,pg_catalog,public;
INSERT INTO public.orders(id,tenant_id,branch_id,cashier_session_id,status,payment_status,payment_method,total_price,is_completed,completed_at) VALUES
 ('e0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',current_setting('test.branch')::uuid,'f0000000-0000-0000-0000-000000000001','ready','unpaid','cash',8,true,now()),
 ('e0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002',current_setting('test.branch')::uuid,'f0000000-0000-0000-0000-000000000001','served',NULL,'cash',9,true,now()),
 ('e0000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002',current_setting('test.branch')::uuid,'f0000000-0000-0000-0000-000000000001','ready','paid','cash',12.35,false,NULL);
RESET search_path;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.orders WHERE id IN ('e0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000002') AND status='awaiting_payment' AND is_completed=false AND completed_at IS NULL)<>2 THEN
   RAISE EXCEPTION 'unpaid guard insertion or hostile search_path failed'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id='e0000000-0000-0000-0000-000000000003' AND status='ready' AND payment_status='paid')
    OR NOT EXISTS (SELECT 1 FROM public.cashier_sessions WHERE id='f0000000-0000-0000-0000-000000000001' AND total_sales=12.35 AND cash_sales=12.35) THEN
   RAISE EXCEPTION 'paid ready order or trigger totals failed'; END IF;
END $$;
SET LOCAL ROLE authenticated;
UPDATE public.orders SET status='served' WHERE id='e0000000-0000-0000-0000-000000000003';
UPDATE public.orders SET payment_status='unpaid',is_completed=true,completed_at=now() WHERE id='e0000000-0000-0000-0000-000000000003';
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id='e0000000-0000-0000-0000-000000000003' AND status='awaiting_payment' AND is_completed=false AND completed_at IS NULL)
    OR NOT EXISTS (SELECT 1 FROM public.cashier_sessions WHERE id='f0000000-0000-0000-0000-000000000001' AND total_sales=0 AND cash_sales=0) THEN
   RAISE EXCEPTION 'update guard or recalculation failed'; END IF;
END $$;
SET LOCAL ROLE authenticated;
UPDATE public.orders SET status='ready',payment_status='paid',payment_method='split',cash_amount=5,card_amount=7.35 WHERE id='e0000000-0000-0000-0000-000000000003';
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.cashier_sessions WHERE id='f0000000-0000-0000-0000-000000000001' AND total_sales=12.35 AND cash_sales=5 AND card_sales=7.35) THEN
   RAISE EXCEPTION 'split total recalculation failed'; END IF;
END $$;
SET LOCAL ROLE authenticated;
UPDATE public.orders SET cashier_session_id='f0000000-0000-0000-0000-000000000002' WHERE id='e0000000-0000-0000-0000-000000000003';
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.cashier_sessions WHERE id='f0000000-0000-0000-0000-000000000001' AND total_sales=0 AND cash_sales=0 AND card_sales=0)
    OR NOT EXISTS (SELECT 1 FROM public.cashier_sessions WHERE id='f0000000-0000-0000-0000-000000000002' AND total_sales=12.35 AND cash_sales=5 AND card_sales=7.35) THEN
   RAISE EXCEPTION 'moving sale did not refresh both sessions'; END IF;
END $$;
SET LOCAL ROLE authenticated;
DELETE FROM public.orders WHERE id='e0000000-0000-0000-0000-000000000003';
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.cashier_sessions WHERE id='f0000000-0000-0000-0000-000000000002' AND total_sales=0 AND cash_sales=0 AND card_sales=0) THEN
   RAISE EXCEPTION 'delete trigger recalculation failed'; END IF;
END $$;
-- Preserve explicit service-role execution of the wrapper; no client-role grant.
SELECT set_config('request.jwt.claim.role','service_role',true),set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE service_role;
SELECT public.refresh_cashier_session_totals('f0000000-0000-0000-0000-000000000001');
SELECT public.create_tenant_for_registration('Service tenant','service-tenant');
RESET ROLE;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.store WHERE store_slug='service-tenant') THEN RAISE EXCEPTION 'service maintenance path failed'; END IF; END $$;
ROLLBACK;
