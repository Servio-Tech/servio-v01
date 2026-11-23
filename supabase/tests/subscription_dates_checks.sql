\set ON_ERROR_STOP on
BEGIN;
-- Stable transaction time makes boundary comparisons exact.
UPDATE public.tenant_subscriptions SET starts_at=now(),ends_at=NULL WHERE tenant_id='00000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 IF pg_catalog.strpos(pg_catalog.pg_get_functiondef('servio_subscription_private.get_public_categories(text)'::pg_catalog.regprocedure),'public.is_public_tenant_active(')>0
    OR pg_catalog.strpos(pg_catalog.pg_get_functiondef('servio_subscription_private.get_public_menu_items(text)'::pg_catalog.regprocedure),'public.is_public_tenant_active(')>0
    OR pg_catalog.strpos(pg_catalog.pg_get_functiondef('servio_subscription_private.get_public_tables(text)'::pg_catalog.regprocedure),'public.is_public_tenant_active(')>0 THEN
  RAISE EXCEPTION 'legacy public RPC copy still depends on the missing helper';
 END IF;
END $$;
SELECT set_config('request.jwt.claim.role','anon',false);
SET ROLE anon;
DO $$ DECLARE j jsonb; oid uuid; token text; BEGIN
 IF NOT public.platform_subscription_tenant_active('00000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'starts_at boundary not inclusive'; END IF;
 IF (SELECT count(*) FROM public.get_public_tenant('starter')) <> 1 OR (SELECT count(*) FROM public.get_public_store('starter')) <> 1 THEN RAISE EXCEPTION 'active tenant/store unavailable'; END IF;
 IF (SELECT count(*) FROM public.get_public_branches('starter')) <> 1 OR public.resolve_branch_id('starter','main') IS NULL THEN RAISE EXCEPTION 'active branch unavailable'; END IF;
 IF (SELECT count(*) FROM public.get_public_categories('starter')) <> 1 OR (SELECT count(*) FROM public.get_public_categories('starter','main')) <> 1 OR (SELECT count(*) FROM public.get_public_menu_items('starter')) <> 1 OR (SELECT count(*) FROM public.get_public_menu_items('starter','main')) <> 1 OR (SELECT count(*) FROM public.get_public_menu_item_details('starter','main')) <> 1 OR (SELECT count(*) FROM public.get_public_menu_item_images('starter','main',ARRAY['d0000000-0000-0000-0000-000000000001'::uuid])) <> 1 OR (SELECT count(*) FROM public.get_public_tables('starter')) <> 1 OR (SELECT count(*) FROM public.get_public_tables('starter','main')) <> 1 THEN RAISE EXCEPTION 'active menu unavailable'; END IF;
 j := public.create_public_order_with_tracking('starter','[]'::jsonb,0,'1',NULL,'main');
 oid := (j->>'order_id')::uuid; token := j->>'tracking_token';
 IF public.get_public_order_tracking('starter',oid,token) IS NULL THEN RAISE EXCEPTION 'active tracking unavailable'; END IF;
 PERFORM set_config('test.order_id',oid::text,false); PERFORM set_config('test.token',token,false);
 PERFORM public.create_public_waiter_call('starter','1','help','main');
 PERFORM public.create_public_waiter_call('starter','1','legacy');
 PERFORM public.create_public_feedback('starter','1',5,ARRAY['nice'],NULL,'main');
 IF (SELECT count(*) FROM public.claim_cashier_notification_deliveries('notify-secret','order','b0000000-0000-0000-0000-000000000001')) <> 1 THEN RAISE EXCEPTION 'active cashier notification failed'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
SET ROLE authenticated;
DO $$ BEGIN
 IF public.staff_probe() <> 'staff-data' OR (SELECT count(*) FROM public.profiles) <> 1 THEN RAISE EXCEPTION 'active staff unavailable'; END IF;
 IF (public.ensure_profile_for_current_user()).tenant_id <> '00000000-0000-0000-0000-000000000001'::uuid THEN RAISE EXCEPTION 'active profile unavailable'; END IF;
END $$;
RESET ROLE;
-- End-exclusive: immediately at ends_at the existing data must remain but be invisible.
UPDATE public.tenant_subscriptions SET starts_at=now()-interval '1 day',ends_at=now()
WHERE tenant_id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
SELECT set_config('request.jwt.claim.role','anon',false);
SET ROLE anon;
DO $$ BEGIN
 IF public.platform_subscription_tenant_active('00000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'ends_at boundary incorrectly inclusive'; END IF;
 IF (SELECT count(*) FROM public.tenants WHERE slug='starter') <> 0 OR (SELECT count(*) FROM public.get_public_tenant('starter')) <> 0 OR (SELECT count(*) FROM public.get_public_store('starter')) <> 0 OR (SELECT count(*) FROM public.get_public_branches('starter')) <> 0 OR public.resolve_branch_id('starter','main') IS NOT NULL THEN RAISE EXCEPTION 'expired public tenant exposed'; END IF;
 IF (SELECT count(*) FROM public.get_public_categories('starter')) <> 0 OR (SELECT count(*) FROM public.get_public_categories('starter','main')) <> 0 OR (SELECT count(*) FROM public.get_public_menu_items('starter')) <> 0 OR (SELECT count(*) FROM public.get_public_menu_items('starter','main')) <> 0 OR (SELECT count(*) FROM public.get_public_menu_item_details('starter','main')) <> 0 OR (SELECT count(*) FROM public.get_public_menu_item_images('starter','main',ARRAY['d0000000-0000-0000-0000-000000000001'::uuid])) <> 0 OR (SELECT count(*) FROM public.get_public_tables('starter')) <> 0 OR (SELECT count(*) FROM public.get_public_tables('starter','main')) <> 0 THEN RAISE EXCEPTION 'expired menu exposed'; END IF;
 IF (SELECT count(*) FROM public.claim_cashier_notification_deliveries('notify-secret','order','b0000000-0000-0000-0000-000000000002')) <> 0 THEN RAISE EXCEPTION 'expired tenant notification claim returned rows'; END IF;
 IF public.get_public_order_tracking('starter',current_setting('test.order_id')::uuid,current_setting('test.token')) IS NOT NULL THEN RAISE EXCEPTION 'expired tracking exposed'; END IF;
 BEGIN PERFORM public.create_public_order_with_tracking('starter','[]'::jsonb,0,'1',NULL,'main'); RAISE EXCEPTION 'expired order accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.create_public_order_with_tracking('starter','[]'::jsonb,0,'1',NULL); RAISE EXCEPTION 'legacy tracking order accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.create_public_order('starter','[]'::jsonb,0,'1',NULL,'main'); RAISE EXCEPTION 'expired direct order accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.create_public_waiter_call('starter','1','help','main'); RAISE EXCEPTION 'expired waiter accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.create_public_waiter_call('starter','1','legacy'); RAISE EXCEPTION 'legacy waiter accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.create_public_feedback('starter','1',5,ARRAY['nice'],NULL,'main'); RAISE EXCEPTION 'expired feedback accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.notification_events WHERE event_id='b0000000-0000-0000-0000-000000000002')
    OR EXISTS (SELECT 1 FROM public.notification_deliveries WHERE event_id='b0000000-0000-0000-0000-000000000002') THEN
  RAISE EXCEPTION 'expired tenant notification claim persisted data';
 END IF;
 -- Expiry is a gate, not a deletion. Check the privileged underlying data,
 -- not the intentionally empty views under anon/authenticated RLS.
 IF (SELECT count(*) FROM auth.users WHERE id IN ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004')) <> 2
    OR (SELECT count(*) FROM public.profiles WHERE id IN ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004')) <> 2
    OR (SELECT count(*) FROM public.tenants WHERE id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002')) <> 2
    OR (SELECT count(*) FROM public.branches WHERE tenant_id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002')) <> 3
    OR NOT EXISTS (SELECT 1 FROM public.cashiers WHERE auth_user_id='10000000-0000-0000-0000-000000000004' AND tenant_id='00000000-0000-0000-0000-000000000002')
    OR NOT EXISTS (SELECT 1 FROM public.notification_subscriptions WHERE id='a0000000-0000-0000-0000-000000000003')
    OR NOT EXISTS (SELECT 1 FROM public.menu_items WHERE name='coffee')
    OR NOT EXISTS (SELECT 1 FROM public.orders WHERE id=current_setting('test.order_id')::uuid) THEN
  RAISE EXCEPTION 'expiry removed account or retained business data';
 END IF;
END $$;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SET ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.profiles) <> 0 THEN RAISE EXCEPTION 'expired staff RLS exposed'; END IF;
 BEGIN PERFORM public.staff_probe(); RAISE EXCEPTION 'definer staff RPC exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.ensure_profile_for_current_user(); RAISE EXCEPTION 'profile definer exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
DO $$ BEGIN
 BEGIN
  INSERT INTO public.orders(tenant_id,items,total_price,table_number,status)
  VALUES('00000000-0000-0000-0000-000000000001','[]'::jsonb,0,'1','pending');
  RAISE EXCEPTION 'expired tenant direct order insert allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
-- Future and missing subscriptions fail closed. No deletion of business data.
UPDATE public.tenant_subscriptions SET starts_at=now()+interval '1 day',ends_at=NULL WHERE tenant_id='00000000-0000-0000-0000-000000000001';
DO $$ BEGIN IF public.platform_subscription_slug_active('starter') THEN RAISE EXCEPTION 'future subscription active'; END IF; END $$;
DELETE FROM public.tenant_subscriptions WHERE tenant_id='00000000-0000-0000-0000-000000000001';
DO $$ BEGIN IF public.platform_subscription_slug_active('starter') OR NOT EXISTS (SELECT 1 FROM public.orders WHERE id=current_setting('test.order_id')::uuid) OR NOT EXISTS (SELECT 1 FROM public.menu_items WHERE name='coffee') THEN RAISE EXCEPTION 'missing subscription allowed or data lost'; END IF; END $$;
INSERT INTO public.tenant_subscriptions(tenant_id,plan,starts_at,ends_at) VALUES ('00000000-0000-0000-0000-000000000001','starter',now()-interval '1 day',now());
-- Platform owner can renew an expired tenant through the original RPC.
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
SET ROLE authenticated;
SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','starter',now(),NULL);
RESET ROLE;
SELECT set_config('request.jwt.claim.role','anon',false);
SET ROLE anon;
DO $$ BEGIN IF (SELECT count(*) FROM public.get_public_menu_item_details('starter','main')) <> 1 OR public.get_public_order_tracking('starter',current_setting('test.order_id')::uuid,current_setting('test.token')) IS NULL THEN RAISE EXCEPTION 'renewal did not restore service'; END IF; END $$;
RESET ROLE;
-- Current API replaces the row immediately; a future start is NOT a queued
-- renewal. Assert this behavior so it cannot be mistaken for scheduled periods.
SELECT set_config('request.jwt.claim.role','authenticated',false),set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
SET ROLE authenticated;
SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','starter',now()+interval '1 day',now()+interval '2 days');
RESET ROLE;
DO $$ BEGIN
 IF public.platform_subscription_slug_active('starter') OR NOT EXISTS (SELECT 1 FROM public.orders WHERE id=current_setting('test.order_id')::uuid)
 THEN RAISE EXCEPTION 'future replacement state or retained data incorrect'; END IF;
END $$;
SET ROLE authenticated;
SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','starter',now(),NULL);
RESET ROLE;
-- The actual service-key cashier verifier must itself refuse inactive tenants.
UPDATE public.tenant_subscriptions SET starts_at=now()-interval '1 day',ends_at=NULL
WHERE tenant_id='00000000-0000-0000-0000-000000000002';
SELECT set_config('request.jwt.claim.role','service_role',false);
SET ROLE service_role;
DO $$ BEGIN IF (SELECT count(*) FROM public.verify_cashier_login('pro','main','cashier','1234')) <> 1 THEN RAISE EXCEPTION 'active cashier login failed'; END IF; END $$;
RESET ROLE;
UPDATE public.tenant_subscriptions SET starts_at=now()-interval '1 day',ends_at=now() WHERE tenant_id='00000000-0000-0000-0000-000000000002';
SET ROLE service_role;
DO $$ BEGIN IF (SELECT count(*) FROM public.verify_cashier_login('pro','main','cashier','1234')) <> 0 THEN RAISE EXCEPTION 'expired cashier login accepted'; END IF; END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.role','authenticated',false),set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',false);
SET ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.ensure_profile_for_current_user(); RAISE EXCEPTION 'profileless expired cashier provisioned'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
-- Existing request hook, including block behavior, remains installed and works.
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_db_role_setting s CROSS JOIN LATERAL unnest(s.setconfig) v WHERE v='pgrst.db_pre_request=public.platform_block_request_guard') THEN RAISE EXCEPTION 'pre-request hook changed'; END IF; END $$;
INSERT INTO public.platform_user_blocks(user_id,blocked_by) VALUES ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002');
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
SET ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.platform_block_request_guard(); RAISE EXCEPTION 'block hook weakened'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF (SELECT count(*) FROM public.profiles) <> 0 THEN RAISE EXCEPTION 'block RLS weakened'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
