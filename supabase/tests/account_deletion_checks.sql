-- Each expected failure is caught inside a subtransaction, and state is checked.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
                WHERE attrelid='auth.users'::regclass AND attname='banned_until'
                  AND atttypid='timestamptz'::regtype AND attnum>0 AND NOT attisdropped) THEN
   RAISE EXCEPTION 'fixture must expose Supabase auth.users.banned_until as timestamptz'; END IF;
 IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.cashiers'::regclass AND contype='f' AND confrelid='auth.users'::regclass) THEN
   RAISE EXCEPTION 'fixture must not have cashier Auth FK'; END IF;
 BEGIN PERFORM public.platform_prepare_user_deletion('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003');
   RAISE EXCEPTION 'last admin preflight allowed'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 IF EXISTS (SELECT 1 FROM public.platform_owner_deletion_requests WHERE user_id='10000000-0000-0000-0000-000000000003') THEN RAISE EXCEPTION 'blocked preflight created marker'; END IF;
 BEGIN DELETE FROM auth.users WHERE id='10000000-0000-0000-0000-000000000003';
   RAISE EXCEPTION 'last admin Auth deletion allowed'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN DELETE FROM public.profiles WHERE id='10000000-0000-0000-0000-000000000003';
   RAISE EXCEPTION 'last admin profile deletion allowed'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN UPDATE public.profiles SET role='cashier' WHERE id='10000000-0000-0000-0000-000000000003';
   RAISE EXCEPTION 'last admin demotion allowed'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN UPDATE public.profiles SET tenant_id='40000000-0000-0000-0000-000000000001' WHERE id='10000000-0000-0000-0000-000000000003';
   RAISE EXCEPTION 'last admin move allowed'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN DELETE FROM public.tenants WHERE id='40000000-0000-0000-0000-000000000002';
   RAISE EXCEPTION 'tenant cascade deletion allowed'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id='10000000-0000-0000-0000-000000000003') OR
    NOT EXISTS(SELECT 1 FROM public.profiles WHERE id='10000000-0000-0000-0000-000000000003' AND role='admin') OR
    NOT EXISTS(SELECT 1 FROM public.branches WHERE tenant_id='40000000-0000-0000-0000-000000000002') THEN
   RAISE EXCEPTION 'blocked admin removal changed account or activity'; END IF;
END $$;

-- Regression: the old replacement count treated any second admin as usable,
-- even if Auth had banned them. Deletion/demotion must now retain the target.
UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id='10000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 BEGIN PERFORM public.platform_prepare_user_deletion('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
   RAISE EXCEPTION 'deletion counted Auth-banned admin as replacement';
 EXCEPTION WHEN foreign_key_violation THEN IF SQLERRM<>'LAST_TENANT_ADMIN' THEN RAISE; END IF; END;
 BEGIN UPDATE public.profiles SET role='cashier' WHERE id='10000000-0000-0000-0000-000000000001';
   RAISE EXCEPTION 'demotion counted Auth-banned admin as replacement';
 EXCEPTION WHEN foreign_key_violation THEN IF SQLERRM<>'LAST_TENANT_ADMIN' THEN RAISE; END IF; END;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id='10000000-0000-0000-0000-000000000001' AND role='admin') THEN
   RAISE EXCEPTION 'banned replacement allowed last admin removal'; END IF;
END $$;
UPDATE auth.users SET banned_until=NULL WHERE id='10000000-0000-0000-0000-000000000002';

-- The same must hold for platform-blocked replacements, for both removal and
-- the owner block endpoint's ban operation.
INSERT INTO public.platform_user_blocks(user_id,blocked_by)
 VALUES ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001');
DO $$ BEGIN
 BEGIN DELETE FROM public.profiles WHERE id='10000000-0000-0000-0000-000000000001';
   RAISE EXCEPTION 'deletion counted platform-blocked admin as replacement';
 EXCEPTION WHEN foreign_key_violation THEN IF SQLERRM<>'LAST_TENANT_ADMIN' THEN RAISE; END IF; END;
 BEGIN PERFORM public.platform_begin_block_operation('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','ban_user','d0000000-0000-0000-0000-000000000001');
   RAISE EXCEPTION 'ban operation allowed last eligible admin';
 EXCEPTION WHEN foreign_key_violation THEN IF SQLERRM<>'LAST_TENANT_ADMIN' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM public.platform_user_blocks WHERE user_id='10000000-0000-0000-0000-000000000001') THEN
   RAISE EXCEPTION 'rejected final-admin ban left a block row'; END IF;
END $$;
DELETE FROM public.platform_user_blocks WHERE user_id='10000000-0000-0000-0000-000000000002';

-- A cashier's is_active flag alone is not a valid replacement when its linked
-- Auth identity is banned/blocked. Existing PIN-only (NULL Auth link) cashiers
-- remain eligible under the legacy cashier login path.
UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id='20000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 BEGIN UPDATE public.cashiers SET is_active=false WHERE id='60000000-0000-0000-0000-000000000001';
   RAISE EXCEPTION 'archive counted Auth-banned cashier as replacement';
 EXCEPTION WHEN check_violation THEN IF SQLERRM<>'LAST_ACTIVE_CASHIER' THEN RAISE; END IF; END;
 IF NOT EXISTS(SELECT 1 FROM public.cashiers WHERE id='60000000-0000-0000-0000-000000000001' AND is_active) THEN
   RAISE EXCEPTION 'banned cashier replacement allowed archive'; END IF;
END $$;
UPDATE auth.users SET banned_until=NULL WHERE id='20000000-0000-0000-0000-000000000002';
INSERT INTO public.platform_user_blocks(user_id,blocked_by)
 VALUES ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001');
DO $$ BEGIN
 BEGIN UPDATE public.cashiers SET is_active=false WHERE id='60000000-0000-0000-0000-000000000001';
   RAISE EXCEPTION 'archive counted platform-blocked cashier as replacement';
 EXCEPTION WHEN check_violation THEN IF SQLERRM<>'LAST_ACTIVE_CASHIER' THEN RAISE; END IF; END;
 BEGIN PERFORM public.platform_begin_block_operation('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','ban_user','d0000000-0000-0000-0000-000000000002');
   RAISE EXCEPTION 'ban operation allowed last eligible cashier';
 EXCEPTION WHEN check_violation THEN IF SQLERRM<>'LAST_ACTIVE_CASHIER' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM public.platform_user_blocks WHERE user_id='20000000-0000-0000-0000-000000000001') THEN
   RAISE EXCEPTION 'rejected final-cashier ban left a block row'; END IF;
END $$;
DELETE FROM public.platform_user_blocks WHERE user_id='20000000-0000-0000-0000-000000000002';

-- The owner preparation is not the only delete path: a no-FK link blocks both
-- marked and unmarked Auth deletion; notification cascades are blocked as well.
DO $$ BEGIN
 BEGIN PERFORM public.platform_prepare_user_deletion('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003');
   RAISE EXCEPTION 'linked cashier owner preflight allowed'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN DELETE FROM auth.users WHERE id='20000000-0000-0000-0000-000000000003';
   RAISE EXCEPTION 'linked cashier direct Auth deletion allowed'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN DELETE FROM public.profiles WHERE id='20000000-0000-0000-0000-000000000003';
   RAISE EXCEPTION 'linked cashier profile deletion allowed'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN UPDATE public.cashiers SET auth_user_id=NULL WHERE id='60000000-0000-0000-0000-000000000003';
   RAISE EXCEPTION 'cashier unlink allowed'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN DELETE FROM public.cashiers WHERE id='60000000-0000-0000-0000-000000000003';
   RAISE EXCEPTION 'cashier physical delete allowed'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN DELETE FROM auth.users WHERE id='30000000-0000-0000-0000-000000000002';
   RAISE EXCEPTION 'notification cascade allowed'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 IF NOT EXISTS (SELECT 1 FROM public.notification_deliveries WHERE id='90000000-0000-0000-0000-000000000002') THEN
   RAISE EXCEPTION 'notification history was lost'; END IF;
END $$;

-- Actual historical RPC under the real subscription wrapper; no writes when
-- its guard rejects a last cashier or a cashier with an open shift.
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000003"}',false);
DO $$ BEGIN
 BEGIN PERFORM public.deactivate_cashier('60000000-0000-0000-0000-000000000003');
   RAISE EXCEPTION 'last cashier RPC allowed'; EXCEPTION WHEN check_violation THEN
     IF SQLERRM <> 'LAST_ACTIVE_CASHIER' THEN RAISE; END IF; END;
 IF NOT EXISTS(SELECT 1 FROM public.cashiers WHERE id='60000000-0000-0000-0000-000000000003' AND is_active AND auth_user_id='20000000-0000-0000-0000-000000000003') OR
    NOT EXISTS(SELECT 1 FROM auth.users WHERE id='20000000-0000-0000-0000-000000000003') THEN
   RAISE EXCEPTION 'blocked cashier removal altered data'; END IF;
END $$;
INSERT INTO public.cashier_sessions VALUES ('a0000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','open');
DO $$ BEGIN
 BEGIN UPDATE public.cashiers SET is_active=false WHERE id='60000000-0000-0000-0000-000000000001';
   RAISE EXCEPTION 'direct archive with open shift allowed'; EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000001"}',false);
DO $$ BEGIN
 BEGIN PERFORM public.deactivate_cashier('60000000-0000-0000-0000-000000000001');
   RAISE EXCEPTION 'RPC archive with open shift allowed'; EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL; END;
END $$;
UPDATE public.cashier_sessions SET status='closed' WHERE id='a0000000-0000-0000-0000-000000000001';

BEGIN;
SET LOCAL ROLE authenticated;
SELECT * FROM public.deactivate_cashier('60000000-0000-0000-0000-000000000001');
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.cashiers WHERE id='60000000-0000-0000-0000-000000000001' AND NOT is_active AND auth_user_id='20000000-0000-0000-0000-000000000001') OR
    NOT EXISTS(SELECT 1 FROM auth.users WHERE id='20000000-0000-0000-0000-000000000001') OR
    NOT EXISTS(SELECT 1 FROM public.profiles WHERE id='20000000-0000-0000-0000-000000000001') OR
    NOT EXISTS(SELECT 1 FROM public.notification_deliveries WHERE id='90000000-0000-0000-0000-000000000001') OR
    NOT EXISTS(SELECT 1 FROM public.cashier_sessions WHERE id='a0000000-0000-0000-0000-000000000001' AND auth_user_id='20000000-0000-0000-0000-000000000001') OR
    EXISTS(SELECT 1 FROM auth.sessions WHERE user_id='20000000-0000-0000-0000-000000000001') THEN
   RAISE EXCEPTION 'archive lost history or failed to revoke sessions'; END IF;
 BEGIN UPDATE public.cashiers SET is_active=false WHERE id='60000000-0000-0000-0000-000000000002';
   RAISE EXCEPTION 'final remaining cashier archived'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"20000000-0000-0000-0000-000000000001","session_id":"70000000-0000-0000-0000-000000000001"}',false);
DO $$ BEGIN
 IF public.platform_current_user_allowed() THEN RAISE EXCEPTION 'archived cashier JWT is allowed'; END IF;
 BEGIN PERFORM public.platform_block_request_guard(); RAISE EXCEPTION 'archived cashier passed request guard'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
INSERT INTO auth.sessions VALUES ('70000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001');
UPDATE public.cashiers SET is_active=true WHERE id='60000000-0000-0000-0000-000000000001';
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"20000000-0000-0000-0000-000000000001","session_id":"70000000-0000-0000-0000-000000000002"}',false);
DO $$ BEGIN IF public.platform_current_user_allowed() THEN RAISE EXCEPTION 'session revived on reactivation'; END IF; END $$;
ROLLBACK;

-- Preparation and actual deletion are separate transactions in production.
-- Simulate an intervening admin demotion: the actual DELETE must roll back.
BEGIN;
SELECT public.platform_prepare_user_deletion('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
UPDATE public.profiles SET role='cashier' WHERE id='10000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 BEGIN DELETE FROM auth.users WHERE id='10000000-0000-0000-0000-000000000001';
   RAISE EXCEPTION 'last admin delete allowed after preflight'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id='10000000-0000-0000-0000-000000000001') OR
    NOT EXISTS(SELECT 1 FROM public.platform_owner_deletion_requests WHERE user_id='10000000-0000-0000-0000-000000000001') THEN
   RAISE EXCEPTION 'unexpected state after failed actual delete'; END IF;
END $$;
ROLLBACK;

-- A retained profile FK introduced after preflight must be rechecked at the
-- actual Auth DELETE and must not be silently SET NULL.
BEGIN;
SELECT public.platform_prepare_user_deletion('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
INSERT INTO public.profile_history VALUES ('b0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
DO $$ BEGIN
 BEGIN DELETE FROM auth.users WHERE id='10000000-0000-0000-0000-000000000001';
   RAISE EXCEPTION 'profile FK introduced after preflight lost'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 IF NOT EXISTS(SELECT 1 FROM public.profile_history WHERE id='b0000000-0000-0000-0000-000000000001' AND profile_id='10000000-0000-0000-0000-000000000001') OR
    NOT EXISTS(SELECT 1 FROM auth.users WHERE id='10000000-0000-0000-0000-000000000001') THEN
   RAISE EXCEPTION 'post-preflight retained profile reference damaged'; END IF;
END $$;
ROLLBACK;

-- A truly unlinked account remains deletable. Identity links to a missing Auth
-- user or to an already archived cashier are rejected.
BEGIN;
DELETE FROM auth.users WHERE id='30000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 BEGIN INSERT INTO public.cashiers VALUES ('60000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000001','No identity','30000000-0000-0000-0000-000000000001',true);
   RAISE EXCEPTION 'dangling Auth link allowed'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN INSERT INTO public.cashiers VALUES ('60000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000001','Archived','30000000-0000-0000-0000-000000000002',false);
   RAISE EXCEPTION 'new archived Auth link allowed'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
ROLLBACK;

BEGIN ISOLATION LEVEL REPEATABLE READ;
DO $$ BEGIN
 BEGIN DELETE FROM auth.users WHERE id='30000000-0000-0000-0000-000000000001';
   RAISE EXCEPTION 'snapshot Auth deletion allowed'; EXCEPTION WHEN feature_not_supported THEN NULL; END;
 BEGIN DELETE FROM public.profiles WHERE id='10000000-0000-0000-0000-000000000001';
   RAISE EXCEPTION 'snapshot profile removal allowed'; EXCEPTION WHEN feature_not_supported THEN NULL; END;
END $$;
ROLLBACK;
SELECT 'account deletion functional checks passed' AS result;
