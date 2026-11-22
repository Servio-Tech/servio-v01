\set ON_ERROR_STOP on
-- Runs only against the disposable cluster created by subscription_audit_local.sh.
CREATE FUNCTION pg_temp.assert_true(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %', message; END IF; END $$;
CREATE FUNCTION pg_temp.expect_error(statement text, expected_code text, expected_message text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual_code text; actual_message text;
BEGIN
  BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS actual_code = RETURNED_SQLSTATE, actual_message = MESSAGE_TEXT;
    IF actual_code <> expected_code OR position(expected_message IN actual_message) = 0 THEN
      RAISE EXCEPTION 'Wrong error: % %, expected % / %', actual_code, actual_message, expected_code, expected_message;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'Expected error %: %', expected_code, statement;
END $$;

SELECT pg_temp.assert_true(has_function_privilege('authenticated','public.owner_set_subscription(uuid,text,timestamp with time zone,timestamp with time zone)','EXECUTE'), 'authenticated grant retained');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.owner_set_subscription(uuid,text,timestamp with time zone,timestamp with time zone)','EXECUTE') AND NOT has_function_privilege('service_role','public.owner_set_subscription(uuid,text,timestamp with time zone,timestamp with time zone)','EXECUTE'), 'anon and service role have no RPC access');
SELECT pg_temp.assert_true(has_function_privilege('authenticated','public.owner_set_subscription_audited(uuid,text,timestamp with time zone,timestamp with time zone)','EXECUTE') AND NOT has_function_privilege('anon','public.owner_set_subscription_audited(uuid,text,timestamp with time zone,timestamp with time zone)','EXECUTE') AND NOT has_function_privilege('service_role','public.owner_set_subscription_audited(uuid,text,timestamp with time zone,timestamp with time zone)','EXECUTE'), 'versioned RPC only allows authenticated');
SELECT pg_temp.assert_true(NOT has_table_privilege('authenticated','public.platform_owner_audit','INSERT') AND NOT has_table_privilege('anon','public.platform_owner_audit','SELECT'), 'audit inaccessible to client roles');

-- Old Edge's separate preflight/completion cannot forge or duplicate a
-- subscription event after migration; other audit actions still work.
SET ROLE service_role;
SELECT pg_temp.expect_error($q$SELECT public.platform_owner_audit_event('10000000-0000-0000-0000-000000000002',NULL,'00000000-0000-0000-0000-000000000001','set_subscription','started')$q$,'42501','Subscription audit is recorded');
SELECT pg_temp.expect_error($q$SELECT public.platform_owner_audit_event('10000000-0000-0000-0000-000000000002',NULL,'00000000-0000-0000-0000-000000000001','set_subscription','completed')$q$,'42501','Subscription audit is recorded');
BEGIN;
SELECT public.platform_owner_audit_event('10000000-0000-0000-0000-000000000002',NULL,NULL,'ban_user','started');
ROLLBACK;
RESET ROLE;

-- Normal direct authenticated RPC succeeds and creates exactly one completion.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claims','{"role":"authenticated","email":"forged@example.test"}',false);
SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','pro','2027-01-01','2028-01-01');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT plan='pro' AND starts_at='2027-01-01'::timestamptz AND ends_at='2028-01-01'::timestamptz FROM public.tenant_subscriptions WHERE tenant_id='00000000-0000-0000-0000-000000000001'), 'direct update persisted');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.platform_owner_audit WHERE action='set_subscription' AND outcome='completed' AND actor_id='10000000-0000-0000-0000-000000000002' AND target_user_id IS NULL AND target_tenant_id='00000000-0000-0000-0000-000000000001'), 'direct audit uses authenticated actor and actual target');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.platform_owner_audit), 'one completion only');

-- Anonymous, service, missing, unconfirmed, and spoofed identities cannot write.
SET ROLE anon;
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','starter','2029-01-01',null)$q$,'42501','permission denied');
RESET ROLE;
SET ROLE service_role;
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','starter','2029-01-01',null)$q$,'42501','permission denied');
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','',false);
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','starter','2029-01-01',null)$q$,'42501','Confirmed platform owner');
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
SELECT set_config('request.jwt.claims','{"role":"authenticated","email":"serviotech.sa@gmail.com","user_metadata":{"is_owner":true}}',false);
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','starter','2029-01-01',null)$q$,'42501','Confirmed platform owner');
SELECT pg_temp.expect_error($q$INSERT INTO public.platform_owner_audit(actor_id,action,outcome) VALUES ('10000000-0000-0000-0000-000000000002','set_subscription','completed')$q$,'42501','permission denied');
RESET ROLE;
UPDATE auth.users SET email_confirmed_at=NULL WHERE id='10000000-0000-0000-0000-000000000002';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','starter','2029-01-01',null)$q$,'42501','Confirmed platform owner');
RESET ROLE;
UPDATE auth.users SET email_confirmed_at=now(), banned_until=now()+interval '1 day' WHERE id='10000000-0000-0000-0000-000000000002';
SET ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','starter','2029-01-01',null)$q$,'42501','Account unavailable');
RESET ROLE;
UPDATE auth.users SET banned_until=NULL WHERE id='10000000-0000-0000-0000-000000000002';
INSERT INTO public.platform_user_blocks(user_id,blocked_by) VALUES ('10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002');
SET ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','starter','2029-01-01',null)$q$,'42501','Account unavailable');
RESET ROLE;
DELETE FROM public.platform_user_blocks WHERE user_id='10000000-0000-0000-0000-000000000002';
INSERT INTO public.platform_user_session_fences(user_id) VALUES ('10000000-0000-0000-0000-000000000002');
SET ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','starter','2029-01-01',null)$q$,'42501','Account unavailable');
RESET ROLE;
INSERT INTO auth.sessions VALUES ('70000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000002');
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","session_id":"70000000-0000-0000-0000-000000000007"}',false);
SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','pro','2027-01-01','2028-01-01');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.platform_owner_audit WHERE actor_id='10000000-0000-0000-0000-000000000002' AND action='set_subscription' AND outcome='completed'), 'a valid fenced session succeeds and is audited once');
DELETE FROM public.platform_user_session_fences WHERE user_id='10000000-0000-0000-0000-000000000002';

-- Validation failures and branch-limit failures must not leave audit or updates.
SET ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','invalid','2029-01-01',null)$q$,'22023','Plan must be');
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','starter','2029-01-01','2029-01-01')$q$,'22023','Invalid subscription dates');
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000002','starter','2029-01-01',null)$q$,'23514','Cannot downgrade to starter');
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription('99999999-0000-0000-0000-000000000000','pro','2029-01-01',null)$q$,'P0002','Tenant not found');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT plan='pro' FROM public.tenant_subscriptions WHERE tenant_id='00000000-0000-0000-0000-000000000002'), 'failed downgrade rolls back');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.platform_owner_audit), 'failed attempts create no completion');

-- Inject an actual database audit failure, a suppressed INSERT, and a tampered
-- row. The last two exercise fail-closed detection beyond SQL exceptions.
CREATE FUNCTION public.subscription_audit_test_interceptor() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('test.audit_mode',true) = 'error' THEN
    RAISE EXCEPTION 'injected audit failure' USING ERRCODE='55000';
  ELSIF current_setting('test.audit_mode',true) = 'skip' THEN
    RETURN NULL;
  ELSIF current_setting('test.audit_mode',true) = 'rewrite' THEN
    NEW.actor_id := '10000000-0000-0000-0000-000000000003';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER subscription_audit_test_interceptor BEFORE INSERT ON public.platform_owner_audit
FOR EACH ROW EXECUTE FUNCTION public.subscription_audit_test_interceptor();
SET ROLE authenticated;
SELECT set_config('test.audit_mode','error',false);
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','starter','2029-01-01',null)$q$,'55000','injected audit failure');
SELECT set_config('test.audit_mode','skip',false);
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','starter','2029-01-01',null)$q$,'55000','Subscription audit unavailable');
SELECT set_config('test.audit_mode','rewrite',false);
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','starter','2029-01-01',null)$q$,'55000','Subscription audit unavailable');
RESET ROLE;
SELECT set_config('test.audit_mode','',false);
SELECT pg_temp.assert_true((SELECT plan='pro' AND starts_at='2027-01-01'::timestamptz AND ends_at='2028-01-01'::timestamptz FROM public.tenant_subscriptions WHERE tenant_id='00000000-0000-0000-0000-000000000001'), 'all audit failures roll back every subscription field');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.platform_owner_audit), 'audit failure leaves no false success');

-- Success inside an enclosing transaction must roll back both the mutation and
-- the success event if the caller later rolls back the outer transaction.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','starter','2029-01-01',null);
ROLLBACK;
SELECT pg_temp.assert_true((SELECT plan='pro' AND starts_at='2027-01-01'::timestamptz AND ends_at='2028-01-01'::timestamptz FROM public.tenant_subscriptions WHERE tenant_id='00000000-0000-0000-0000-000000000001'), 'outer rollback restores update');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.platform_owner_audit), 'outer rollback removes completion');
