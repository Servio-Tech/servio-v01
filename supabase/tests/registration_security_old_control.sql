\set ON_ERROR_STOP on
BEGIN;
-- Simulate a newly-created Auth row, not an actual Auth API signup.
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data)
VALUES ('20000000-0000-0000-0000-000000000001','old-control@example.test',now(),
        '{"tenant_id":"00000000-0000-0000-0000-000000000001","role":"admin"}');
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id='20000000-0000-0000-0000-000000000001') THEN
  RAISE EXCEPTION 'removed Auth insert trigger was unexpectedly active';
 END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true),
       set_config('request.jwt.claim.role','authenticated',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE p public.profiles; BEGIN
 p:=public.ensure_profile_for_current_user();
 IF p.tenant_id<>'00000000-0000-0000-0000-000000000001'::uuid OR p.role<>'admin' THEN
  RAISE EXCEPTION 'positive control failed to reproduce historical vulnerable path';
 END IF;
 IF public.current_tenant_id() IS DISTINCT FROM p.tenant_id OR NOT public.is_current_tenant_admin() THEN
  RAISE EXCEPTION 'historical forged profile did not affect authorization helpers';
 END IF;
 IF (SELECT count(*) FROM public.store WHERE tenant_id=p.tenant_id AND store_name='Starter tenant')<>1 THEN
  RAISE EXCEPTION 'historical forged admin did not read victim store through RLS';
 END IF;
 UPDATE public.store SET store_name='forged-admin-write' WHERE tenant_id=p.tenant_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'historical forged admin did not update victim store through RLS'; END IF;
END $$;
RESET ROLE;
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data)
VALUES ('20000000-0000-0000-0000-000000000010','old-cashier-control@example.test',now(),
        '{"tenant_id":"00000000-0000-0000-0000-000000000001","role":"cashier"}');
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000010',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE p public.profiles; BEGIN
 p:=public.ensure_profile_for_current_user();
 IF p.tenant_id<>'00000000-0000-0000-0000-000000000001'::uuid OR p.role<>'cashier' THEN
  RAISE EXCEPTION 'old function failed to store attacker-selected cashier role';
 END IF;
 -- Later current_tenant_id already requires a real active cashier link.
 IF public.current_tenant_id() IS NOT NULL THEN
  RAISE EXCEPTION 'unlinked historical cashier unexpectedly has tenant authority';
 END IF;
END $$;
ROLLBACK;
