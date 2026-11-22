\set ON_ERROR_STOP on
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

SELECT pg_temp.assert_true(has_function_privilege('authenticated','public.owner_set_subscription_idempotent_v1(uuid,text,timestamp with time zone,timestamp with time zone,uuid)','EXECUTE'), 'authenticated can call the explicit v1 RPC');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.owner_set_subscription_idempotent_v1(uuid,text,timestamp with time zone,timestamp with time zone,uuid)','EXECUTE') AND NOT has_function_privilege('service_role','public.owner_set_subscription_idempotent_v1(uuid,text,timestamp with time zone,timestamp with time zone,uuid)','EXECUTE'), 'new RPC is limited to authenticated');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.owner_set_subscription(uuid,text,timestamp with time zone,timestamp with time zone)','EXECUTE') AND NOT has_function_privilege('authenticated','public.owner_set_subscription(uuid,text,timestamp with time zone,timestamp with time zone)','EXECUTE') AND NOT has_function_privilege('service_role','public.owner_set_subscription(uuid,text,timestamp with time zone,timestamp with time zone)','EXECUTE'), 'legacy write RPC cannot execute on application roles');
SELECT pg_temp.assert_true(NOT has_function_privilege('authenticated','public.owner_set_subscription_audited(uuid,text,timestamp with time zone,timestamp with time zone)','EXECUTE'), 'legacy audited wrapper cannot execute on application roles');
SELECT pg_temp.assert_true(NOT has_table_privilege('authenticated','public.platform_subscription_idempotency','SELECT') AND NOT has_table_privilege('authenticated','public.platform_subscription_idempotency','INSERT') AND NOT has_table_privilege('anon','public.platform_subscription_idempotency','SELECT'), 'dedupe table is not directly exposed to API roles');
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.platform_subscription_idempotency'::regclass), 'dedupe table has RLS enabled');

-- A first call commits one change, one durable key row and one audit completion.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claims','{"role":"authenticated"}',false);
SELECT public.owner_set_subscription_idempotent_v1('00000000-0000-0000-0000-000000000001','pro','2030-01-01','2030-12-31','40000000-0000-0000-0000-000000000001');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT plan='pro' AND starts_at='2030-01-01'::timestamptz AND ends_at='2030-12-31'::timestamptz FROM public.tenant_subscriptions WHERE tenant_id='00000000-0000-0000-0000-000000000001'), 'first mutation applied');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.platform_subscription_idempotency WHERE actor_id='10000000-0000-0000-0000-000000000002' AND idempotency_key='40000000-0000-0000-0000-000000000001'), 'first key is durably recorded');
SELECT pg_temp.assert_true((SELECT count(*)=3 FROM public.platform_owner_audit WHERE action='set_subscription' AND outcome='completed'), 'first mutation adds one audit event');

-- A later, different key updates the row. Replaying the old key returns the
-- current row, not a stale snapshot, and emits neither a mutation nor an audit.
SET ROLE authenticated;
SELECT public.owner_set_subscription_idempotent_v1('00000000-0000-0000-0000-000000000001','starter','2031-01-01','2031-12-31','40000000-0000-0000-0000-000000000002');
SELECT pg_temp.assert_true((SELECT (public.owner_set_subscription_idempotent_v1('00000000-0000-0000-0000-000000000001','pro','2030-01-01','2030-12-31','40000000-0000-0000-0000-000000000001')).plan='starter'), 'old key replay returns the latest subscription state');
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription_idempotent_v1('00000000-0000-0000-0000-000000000001','pro','2032-01-01','2032-12-31','40000000-0000-0000-0000-000000000001')$q$,'23505','different subscription payload');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT plan='starter' AND starts_at='2031-01-01'::timestamptz AND ends_at='2031-12-31'::timestamptz FROM public.tenant_subscriptions WHERE tenant_id='00000000-0000-0000-0000-000000000001'), 'replay and key conflict leave later update intact');
SELECT pg_temp.assert_true((SELECT count(*)=4 FROM public.platform_owner_audit WHERE action='set_subscription' AND outcome='completed'), 'replay and conflict add no audit event');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.platform_subscription_idempotency WHERE tenant_id='00000000-0000-0000-0000-000000000001'), 'one durable record per successful key');

-- A caller transaction rollback removes the update, audit and key claim together;
-- the exact same key can then safely be used for a fresh successful attempt.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claims','{"role":"authenticated"}',true);
SELECT public.owner_set_subscription_idempotent_v1('00000000-0000-0000-0000-000000000001','pro','2032-01-01','2032-12-31','40000000-0000-0000-0000-000000000003');
ROLLBACK;
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.platform_subscription_idempotency WHERE idempotency_key='40000000-0000-0000-0000-000000000003'), 'rolled back key claim is absent');
SELECT pg_temp.assert_true((SELECT count(*)=4 FROM public.platform_owner_audit WHERE action='set_subscription' AND outcome='completed'), 'rollback removes completion event');
SELECT pg_temp.assert_true((SELECT plan='starter' AND starts_at='2031-01-01'::timestamptz FROM public.tenant_subscriptions WHERE tenant_id='00000000-0000-0000-0000-000000000001'), 'rollback restores subscription');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claims','{"role":"authenticated"}',false);
SELECT public.owner_set_subscription_idempotent_v1('00000000-0000-0000-0000-000000000001','pro','2032-01-01','2032-12-31','40000000-0000-0000-0000-000000000003');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.platform_subscription_idempotency WHERE idempotency_key='40000000-0000-0000-0000-000000000003'), 'rolled back key can be claimed on retry');
SELECT pg_temp.assert_true((SELECT count(*)=5 FROM public.platform_owner_audit WHERE action='set_subscription' AND outcome='completed'), 'fresh retry emits exactly one completion');

-- Legacy RPCs are not an alternate executable path after the migration.
SET ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription('00000000-0000-0000-0000-000000000001','starter','2033-01-01',NULL)$q$,'42501','permission denied');
SELECT pg_temp.expect_error($q$SELECT public.owner_set_subscription_audited('00000000-0000-0000-0000-000000000001','starter','2033-01-01',NULL)$q$,'42501','permission denied');
RESET ROLE;
