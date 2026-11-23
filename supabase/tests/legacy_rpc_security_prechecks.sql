\set ON_ERROR_STOP on
-- The earlier subscription migration must actually have wrapped both public
-- functions; its private schema must remain unreachable to API roles.
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['create_tenant_for_registration(text,text,text,text,text)', 'refresh_cashier_session_totals(uuid)'] LOOP
    IF NOT has_function_privilege('anon', 'public.' || f, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', 'public.' || f, 'EXECUTE')
       OR NOT has_function_privilege('service_role', 'public.' || f, 'EXECUTE') THEN
      RAISE EXCEPTION 'unexpected pre-hardening ACL for %', f;
    END IF;
    IF position('servio_subscription_private.' in pg_get_functiondef(('public.' || f)::regprocedure)) = 0
       OR to_regprocedure('servio_subscription_private.' || f) IS NULL THEN
      RAISE EXCEPTION 'subscription wrapper missing for %', f;
    END IF;
    IF has_schema_privilege('anon','servio_subscription_private','USAGE')
       OR has_schema_privilege('authenticated','servio_subscription_private','USAGE')
       OR has_schema_privilege('service_role','servio_subscription_private','USAGE')
       OR has_function_privilege('anon', 'servio_subscription_private.' || f, 'EXECUTE')
       OR has_function_privilege('authenticated', 'servio_subscription_private.' || f, 'EXECUTE')
       OR has_function_privilege('service_role', 'servio_subscription_private.' || f, 'EXECUTE') THEN
      RAISE EXCEPTION 'private clone exposed: %', f;
    END IF;
  END LOOP;
END $$;
-- Snapshot guard bodies/identities/ACLs and public service rights for comparison.
CREATE TABLE public.legacy_rpc_security_snapshot AS
SELECT p.oid,p.proname,p.prosrc,p.proowner,p.proacl,p.prosecdef,p.proconfig
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('guard_ready_order_payment_state','guard_unpaid_completion_state');
CREATE TABLE public.legacy_rpc_security_triggers AS
SELECT t.oid,t.tgname,t.tgfoid,pg_get_triggerdef(t.oid) AS definition,t.tgenabled
FROM pg_trigger t WHERE t.tgrelid='public.orders'::regclass AND NOT t.tgisinternal;
-- Demonstrate the legacy anon paths are genuinely exploitable before the fix.
BEGIN;
UPDATE public.cashier_sessions SET total_sales=321 WHERE id='f0000000-0000-0000-0000-000000000001';
SELECT set_config('request.jwt.claim.role','anon',true),set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
SELECT public.create_tenant_for_registration('Legacy orphan','legacy-orphan');
SELECT public.refresh_cashier_session_totals('f0000000-0000-0000-0000-000000000001');
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE slug='legacy-orphan')
    OR NOT EXISTS (SELECT 1 FROM public.store WHERE store_slug='legacy-orphan') THEN
   RAISE EXCEPTION 'legacy anon creation was not reproduced';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.cashier_sessions WHERE id='f0000000-0000-0000-0000-000000000001' AND total_sales=0) THEN
   RAISE EXCEPTION 'legacy anon totals write was not reproduced';
 END IF;
END $$;
ROLLBACK;
