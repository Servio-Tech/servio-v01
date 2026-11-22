\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.assert_true(value boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %',message; END IF; END $$;

-- The function accepts no tenant/user identifier and exposes no other columns.
SELECT pg_temp.assert_true((SELECT p.pronargs=0 AND p.prorettype='pg_catalog.text'::regtype AND p.prosecdef AND p.proconfig @> ARRAY['search_path=""'] FROM pg_catalog.pg_proc p WHERE p.oid='public.platform_current_subscription_status()'::regprocedure),'self-only signature and secure search path');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.platform_current_subscription_status()','EXECUTE') AND NOT has_function_privilege('service_role','public.platform_current_subscription_status()','EXECUTE') AND has_function_privilege('authenticated','public.platform_current_subscription_status()','EXECUTE'),'explicit execute grants');
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN PERFORM public.platform_current_subscription_status(); RAISE EXCEPTION 'anon status allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.platform_current_subscription_status()='active','active manager');
DO $$ BEGIN
  BEGIN EXECUTE 'SELECT public.platform_current_subscription_status(''00000000-0000-0000-0000-000000000002''::uuid)'; RAISE EXCEPTION 'tenant argument accepted'; EXCEPTION WHEN undefined_function THEN NULL; END;
END $$;
RESET ROLE;

UPDATE public.tenant_subscriptions SET starts_at=now()-interval '1 day',ends_at=now() WHERE tenant_id='00000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.platform_current_subscription_status()='expired','exclusive end boundary');
DO $$ BEGIN
  BEGIN PERFORM public.ensure_profile_for_current_user(); RAISE EXCEPTION 'expired profile RPC allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.staff_probe(); RAISE EXCEPTION 'expired staff RPC allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF EXISTS(SELECT 1 FROM public.profiles) THEN RAISE EXCEPTION 'expired RLS weakened'; END IF;
END $$;
RESET ROLE;
-- A second identity cannot see manager A's state; an unlinked identity remains
-- able to complete legitimate registration. JWT metadata is never used.
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.platform_current_subscription_status()='active','other tenant own status only');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.platform_current_subscription_status()='unlinked','unlinked ignores forged metadata');
RESET ROLE;
UPDATE public.tenant_subscriptions SET starts_at=now()-interval '1 day',ends_at=now() WHERE tenant_id='00000000-0000-0000-0000-000000000002';
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000006',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.platform_current_subscription_status()='expired','profileless cashier link');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
UPDATE public.tenant_subscriptions SET starts_at=now()+interval '1 day',ends_at=NULL WHERE tenant_id='00000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.platform_current_subscription_status()='not_started','future is not expired');
RESET ROLE;
DELETE FROM public.tenant_subscriptions WHERE tenant_id='00000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.platform_current_subscription_status()='missing','missing is not expired');
RESET ROLE;
INSERT INTO public.tenant_subscriptions(tenant_id,starts_at,ends_at) VALUES ('00000000-0000-0000-0000-000000000001',now()-interval '1 day',now());

-- Existing owner renewal remains functional and audited; access comes back.
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','starter',now(),NULL);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.platform_current_subscription_status()='active','renewal restores active status');
SELECT pg_temp.assert_true((public.ensure_profile_for_current_user()).id=auth.uid(),'renewal restores staff RPC');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.profiles WHERE id='10000000-0000-0000-0000-000000000001') AND EXISTS (SELECT 1 FROM public.store WHERE tenant_id='00000000-0000-0000-0000-000000000001') AND EXISTS (SELECT 1 FROM public.menu_items WHERE name='coffee') AND EXISTS (SELECT 1 FROM auth.users WHERE id='10000000-0000-0000-0000-000000000001'),'user profile store and data retained');

-- Both the direct helper and the pre-request guard reject a blocked identity.
INSERT INTO public.platform_user_blocks(user_id,blocked_by) VALUES ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002');
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN PERFORM public.platform_current_subscription_status(); RAISE EXCEPTION 'blocked status allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.platform_block_request_guard(); RAISE EXCEPTION 'blocked pre-request allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN PERFORM public.platform_current_subscription_status(); RAISE EXCEPTION 'missing identity allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
