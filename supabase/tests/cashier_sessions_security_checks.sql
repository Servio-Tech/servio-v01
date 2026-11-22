\set ON_ERROR_STOP on
BEGIN;
-- Verify the exact SQLSTATE and message, and fail if the operation succeeds or
-- fails for an unrelated reason. Assertions deliberately use P0001 themselves.
CREATE FUNCTION pg_temp.expect_error(command text, expected_state text, expected_message text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual_state text; actual_message text;
BEGIN
  BEGIN
    EXECUTE command;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS actual_state = RETURNED_SQLSTATE, actual_message = MESSAGE_TEXT;
    IF actual_state IS DISTINCT FROM expected_state OR
       (expected_message IS NOT NULL AND actual_message IS DISTINCT FROM expected_message) THEN
      RAISE EXCEPTION 'Unexpected error for %: [%] %, expected [%] %',command,actual_state,actual_message,expected_state,expected_message;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'SECURITY FAILURE: command unexpectedly succeeded: %',command;
END $$;

-- Effective ACLs, including grants to PUBLIC and individual columns.
DO $$ DECLARE r text; p text; a record; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  FOREACH p IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
   IF has_table_privilege(r,'public.cashier_sessions',p) THEN RAISE EXCEPTION '% retains %',r,p; END IF;
  END LOOP;
  FOR a IN SELECT attname FROM pg_attribute WHERE attrelid='public.cashier_sessions'::regclass AND attnum>0 AND NOT attisdropped LOOP
   FOREACH p IN ARRAY ARRAY['INSERT','UPDATE','REFERENCES'] LOOP
    IF has_column_privilege(r,'public.cashier_sessions',a.attname,p) THEN RAISE EXCEPTION '% retains column % on %',r,p,a.attname; END IF;
   END LOOP;
  END LOOP;
  IF has_schema_privilege(r,'servio_subscription_private','USAGE') OR
     has_function_privilege(r,'servio_subscription_private.open_cashier_session(numeric)','EXECUTE') OR
     has_function_privilege(r,'servio_subscription_private.close_cashier_session(uuid,numeric,text)','EXECUTE') OR
     has_function_privilege(r,'public.refresh_cashier_session_totals(uuid)','EXECUTE') THEN
   RAISE EXCEPTION '% can bypass public RPC or totals trigger',r;
  END IF;
 END LOOP;
 IF NOT has_table_privilege('authenticated','public.cashier_sessions','SELECT') OR
    NOT has_function_privilege('authenticated','public.open_cashier_session(numeric)','EXECUTE') OR
    NOT has_function_privilege('authenticated','public.close_cashier_session(uuid,numeric,text)','EXECUTE') OR
    has_function_privilege('anon','public.close_cashier_session(uuid,numeric,text)','EXECUTE') OR
    has_schema_privilege('service_role','servio_subscription_private','USAGE') OR
    has_function_privilege('service_role','servio_subscription_private.refresh_cashier_session_totals(uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'RPC or SELECT ACL unexpectedly changed';
 END IF;
 -- In this fixture service_role inherited every privilege via PUBLIC before the
 -- migration; the effective rights must survive the PUBLIC revoke.
 FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
  IF NOT has_table_privilege('service_role','public.cashier_sessions',p) THEN RAISE EXCEPTION 'service_role lost %',p; END IF;
 END LOOP;
 IF (SELECT count(*) FROM public.cashier_function_snapshot)<>7 OR EXISTS (
   SELECT 1 FROM public.cashier_function_snapshot s LEFT JOIN pg_proc f ON f.oid=s.oid
   WHERE f.oid IS NULL OR f.proowner<>s.proowner OR f.proacl IS DISTINCT FROM s.proacl
     OR f.prosecdef IS DISTINCT FROM s.prosecdef
     OR (s.nspname='public' AND (f.proconfig IS DISTINCT FROM s.proconfig
          OR md5(pg_get_functiondef(f.oid)) IS DISTINCT FROM s.definition))
 ) THEN RAISE EXCEPTION 'Public wrapper/trigger or function identity, ownership or ACL changed'; END IF;
END $$;

SELECT set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT public.close_cashier_session('40000000-0000-0000-0000-000000000005',77,'exploit')$q$,'P0002','Open cashier session not found');
SELECT pg_temp.expect_error($q$SELECT public.close_cashier_session('ffffffff-ffff-ffff-ffff-ffffffffffff',77,'missing')$q$,'P0002','Open cashier session not found');
SELECT pg_temp.expect_error($q$SELECT public.open_cashier_session(1)$q$,'42501','Active cashier profile not found');
SELECT pg_temp.expect_error($q$UPDATE public.cashier_sessions SET total_sales=777 WHERE id='40000000-0000-0000-0000-000000000004'$q$,'42501',NULL);
SELECT pg_temp.expect_error($q$INSERT INTO public.cashier_sessions(tenant_id,branch_id,cashier_id,auth_user_id) VALUES ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000004')$q$,'42501',NULL);
SELECT pg_temp.expect_error($q$DELETE FROM public.cashier_sessions WHERE id='40000000-0000-0000-0000-000000000004'$q$,'42501',NULL);
SELECT pg_temp.expect_error($q$TRUNCATE public.cashier_sessions$q$,'42501',NULL);
SELECT pg_temp.expect_error($q$SELECT public.refresh_cashier_session_totals('40000000-0000-0000-0000-000000000004')$q$,'42501',NULL);
SELECT pg_temp.expect_error($q$SELECT servio_subscription_private.close_cashier_session('40000000-0000-0000-0000-000000000005',2,NULL)$q$,'42501',NULL);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.list_cashier_sessions(100,NULL)) <> 1 OR
    (SELECT count(*) FROM public.list_cashier_sessions(100,'10000000-0000-0000-0000-000000000002')) <> 1 OR
    (SELECT count(*) FROM public.list_cashier_sessions(100,'10000000-0000-0000-0000-000000000003')) <> 0 THEN
  RAISE EXCEPTION 'Admin history is not tenant/branch scoped'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.cashier_sessions WHERE id='40000000-0000-0000-0000-000000000005' AND status='open' AND closing_cash IS NULL) THEN
  RAISE EXCEPTION 'Cross-tenant close changed the victim shift'; END IF;
END $$;

-- Anonymous has no direct table writes and no close RPC.
SELECT set_config('request.jwt.claim.role','anon',true),set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error($q$UPDATE public.cashier_sessions SET total_sales=777$q$,'42501',NULL);
SELECT pg_temp.expect_error($q$DELETE FROM public.cashier_sessions$q$,'42501',NULL);
SELECT pg_temp.expect_error($q$TRUNCATE public.cashier_sessions$q$,'42501',NULL);
SELECT pg_temp.expect_error($q$SELECT public.close_cashier_session('40000000-0000-0000-0000-000000000005',1,NULL)$q$,'42501',NULL);
RESET ROLE;

-- Even if ordinary DML table grants are accidentally reintroduced, restrictive
-- policies dominate the permissive fixture policies (TRUNCATE is not RLS-safe).
GRANT INSERT,UPDATE,DELETE ON public.cashier_sessions TO authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n integer; BEGIN
 UPDATE public.cashier_sessions SET notes='bypass' WHERE id='40000000-0000-0000-0000-000000000004';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Restrictive UPDATE policy bypassed'; END IF;
 DELETE FROM public.cashier_sessions WHERE id='40000000-0000-0000-0000-000000000004';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Restrictive DELETE policy bypassed'; END IF;
END $$;
SELECT pg_temp.expect_error($q$INSERT INTO public.cashier_sessions(tenant_id,branch_id,cashier_id,auth_user_id) VALUES ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000004')$q$,'42501',NULL);
RESET ROLE;
REVOKE INSERT,UPDATE,DELETE ON public.cashier_sessions FROM authenticated;

-- Cashier A1 can open only their own scope, cannot close A2 or B1, and receives
-- the same open shift on a repeated request. Inputs must be finite and >= 0.
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT public.open_cashier_session(NULL)$q$,'22023','Opening cash must be finite and non-negative');
SELECT pg_temp.expect_error($q$SELECT public.open_cashier_session(-1)$q$,'22023','Opening cash must be finite and non-negative');
SELECT pg_temp.expect_error($q$SELECT public.open_cashier_session('NaN'::numeric)$q$,'22023','Opening cash must be finite and non-negative');
SELECT pg_temp.expect_error($q$SELECT public.open_cashier_session('Infinity'::numeric)$q$,'22023','Opening cash must be finite and non-negative');
SELECT pg_temp.expect_error($q$SELECT public.close_cashier_session('40000000-0000-0000-0000-000000000004',NULL,NULL)$q$,'22023','Closing cash must be finite and non-negative');
SELECT pg_temp.expect_error($q$SELECT public.close_cashier_session('40000000-0000-0000-0000-000000000004','NaN'::numeric,NULL)$q$,'22023','Closing cash must be finite and non-negative');
SELECT pg_temp.expect_error($q$SELECT public.close_cashier_session('40000000-0000-0000-0000-000000000004','-Infinity'::numeric,NULL)$q$,'22023','Closing cash must be finite and non-negative');
SELECT pg_temp.expect_error($q$SELECT public.close_cashier_session('40000000-0000-0000-0000-000000000004',1,NULL)$q$,'P0002','Open cashier session not found');
SELECT pg_temp.expect_error($q$SELECT public.close_cashier_session('40000000-0000-0000-0000-000000000005',1,NULL)$q$,'P0002','Open cashier session not found');
DO $$ DECLARE a public.cashier_sessions; b public.cashier_sessions; BEGIN
 a:=public.open_cashier_session(10.126); b:=public.open_cashier_session(99);
 IF a.id IS DISTINCT FROM b.id OR a.opening_cash<>10.13 OR a.tenant_id<>'00000000-0000-0000-0000-000000000001'::uuid OR
    a.branch_id<>'10000000-0000-0000-0000-000000000001'::uuid OR a.auth_user_id<>auth.uid() THEN
  RAISE EXCEPTION 'Cashier open scope, rounding or idempotence failed'; END IF;
 PERFORM set_config('test.shift',a.id::text,true);
 IF (SELECT count(*) FROM public.list_cashier_sessions(100,NULL))<>1 THEN RAISE EXCEPTION 'Cashier history exposed another shift'; END IF;
END $$;
-- A cashier cannot insert an order in another branch against their own shift.
SELECT pg_temp.expect_error($q$INSERT INTO public.orders(tenant_id,branch_id,cashier_session_id,status,payment_status,total_price,payment_method) VALUES ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',current_setting('test.shift')::uuid,'ready','paid',4,'cash')$q$,'42501',NULL);
INSERT INTO public.orders(id,tenant_id,branch_id,cashier_session_id,status,payment_status,total_price,payment_method)
VALUES ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',current_setting('test.shift')::uuid,'ready','paid',12.35,'cash');
RESET ROLE;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.cashier_sessions WHERE id=current_setting('test.shift')::uuid AND total_sales=12.35 AND cash_sales=12.35) THEN RAISE EXCEPTION 'Authenticated order did not refresh totals'; END IF; END $$;

-- A disabled cashier cannot close an existing shift even if the JWT remains.
UPDATE public.cashiers SET is_active=false WHERE id='30000000-0000-0000-0000-000000000003';
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT public.close_cashier_session(current_setting('test.shift')::uuid,1,NULL)$q$,'P0002','Open cashier session not found');
RESET ROLE;
UPDATE public.cashiers SET is_active=true WHERE id='30000000-0000-0000-0000-000000000003';

-- Cashier moved to another branch cannot open there while the old shift is open,
-- but can close their existing shift; then the new branch must be active.
UPDATE public.cashiers SET branch_id='10000000-0000-0000-0000-000000000002' WHERE id='30000000-0000-0000-0000-000000000003';
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT public.open_cashier_session(1)$q$,'55000','Existing open shift is in a different scope; ask a manager to close it');
DO $$ DECLARE s public.cashier_sessions; BEGIN
 s:=public.close_cashier_session(current_setting('test.shift')::uuid,15.23,'  done  ');
 IF s.status<>'closed' OR s.total_sales<>12.35 OR s.cash_sales<>12.35 OR s.notes<>'done' OR s.closing_cash<>15.23 THEN RAISE EXCEPTION 'Own close totals/notes incorrect'; END IF;
END $$;
SELECT pg_temp.expect_error($q$SELECT public.close_cashier_session(current_setting('test.shift')::uuid,1,NULL)$q$,'P0002','Open cashier session not found');
RESET ROLE;
UPDATE public.branches SET is_active=false WHERE id='10000000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT public.open_cashier_session(1)$q$,'42501','Active cashier branch required');
RESET ROLE;
UPDATE public.branches SET is_active=true WHERE id='10000000-0000-0000-0000-000000000002';
UPDATE public.cashiers SET is_active=false WHERE id='30000000-0000-0000-0000-000000000003';
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT public.open_cashier_session(1)$q$,'42501','Active cashier profile not found');
RESET ROLE;
UPDATE public.cashiers SET is_active=true WHERE id='30000000-0000-0000-0000-000000000003';
SET LOCAL ROLE authenticated;
DO $$ DECLARE s public.cashier_sessions; BEGIN
 s:=public.open_cashier_session(1);
 IF s.branch_id<>'10000000-0000-0000-0000-000000000002'::uuid OR s.id=current_setting('test.shift')::uuid THEN RAISE EXCEPTION 'New branch shift incorrect'; END IF;
 PERFORM set_config('test.new_shift',s.id::text,true);
END $$;
RESET ROLE;
-- A profile and linked cashier with different tenant IDs cannot open a shift.
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000008',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT public.open_cashier_session(1)$q$,'42501','Active cashier profile not found');
RESET ROLE;

-- Individually valid foreign keys do not guarantee the session's branch belongs
-- to its tenant. Neither its cashier nor that tenant's admin may close it.
INSERT INTO public.cashier_sessions(id,tenant_id,branch_id,cashier_id,auth_user_id) VALUES
 ('40000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000007','20000000-0000-0000-0000-000000000007');
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000007',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT public.open_cashier_session(1)$q$,'55000','Existing open shift is in a different scope; ask a manager to close it');
SELECT pg_temp.expect_error($q$SELECT public.close_cashier_session('40000000-0000-0000-0000-000000000007',1,NULL)$q$,'P0002','Open cashier session not found');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT public.close_cashier_session('40000000-0000-0000-0000-000000000007',1,NULL)$q$,'P0002','Open cashier session not found');
SELECT pg_temp.expect_error($q$SELECT public.close_cashier_session('40000000-0000-0000-0000-000000000004',1,NULL)$q$,'P0002','Open cashier session not found');
RESET ROLE;
DELETE FROM public.cashier_sessions WHERE id='40000000-0000-0000-0000-000000000007';

-- Exercise each supported payment bucket and paid/status filters through the
-- actual order trigger, then close A2 as same-tenant manager from another branch.
INSERT INTO public.orders(id,tenant_id,branch_id,cashier_session_id,status,payment_status,total_price,payment_method,cash_amount,card_amount) VALUES
 ('50000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000004','ready','paid',20,'cash',NULL,NULL),
 ('50000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000004','served','paid',7,'card',NULL,NULL),
 ('50000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000004','unclaimed','paid',8,'split',3,5),
 ('50000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000004','ready','paid',6,'wallet',NULL,NULL),
 ('50000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000004','ready','paid',8,'transfer',NULL,NULL),
 ('50000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000004','ready','paid',9,'other',NULL,NULL),
 ('50000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000004','ready','paid',2,NULL,NULL,NULL),
 ('50000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000004','pending','unpaid',999,'cash',NULL,NULL);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.cashier_sessions WHERE id='40000000-0000-0000-0000-000000000004'
   AND total_sales=60 AND cash_sales=23 AND card_sales=12 AND wallet_sales=6 AND transfer_sales=8 AND other_sales=11) THEN RAISE EXCEPTION 'Trigger payment bucket totals incorrect'; END IF;
END $$;
-- Mismatched split must reject close without changing the row.
UPDATE public.orders SET cash_amount=1 WHERE id='50000000-0000-0000-0000-000000000004';
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT public.close_cashier_session('40000000-0000-0000-0000-000000000004',20,NULL)$q$,'P0001','SHIFT_PAYMENT_RECONCILIATION_MISMATCH');
RESET ROLE;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.cashier_sessions WHERE id='40000000-0000-0000-0000-000000000004' AND status='open') THEN RAISE EXCEPTION 'Mismatch closed session'; END IF; END $$;
UPDATE public.orders SET cash_amount=3 WHERE id='50000000-0000-0000-0000-000000000004';
SET LOCAL ROLE authenticated;
DO $$ DECLARE s public.cashier_sessions; BEGIN
 s:=public.close_cashier_session('40000000-0000-0000-0000-000000000004',20,'   ');
 IF s.status<>'closed' OR s.closed_at IS NULL OR s.closing_cash<>20 OR s.notes IS NOT NULL OR
    s.total_sales<>60 OR s.cash_sales<>23 OR s.card_sales<>12 OR s.wallet_sales<>6 OR s.transfer_sales<>8 OR s.other_sales<>11 THEN
   RAISE EXCEPTION 'Same-tenant admin close or reconciled totals incorrect'; END IF;
END $$;
RESET ROLE;
UPDATE public.orders SET total_price=22 WHERE id='50000000-0000-0000-0000-000000000002';
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.cashier_sessions WHERE id='40000000-0000-0000-0000-000000000004' AND status='closed' AND total_sales=62 AND cash_sales=25) THEN RAISE EXCEPTION 'Closed shift totals not refreshed by order trigger'; END IF; END $$;
DELETE FROM public.orders WHERE id='50000000-0000-0000-0000-000000000002';
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.cashier_sessions WHERE id='40000000-0000-0000-0000-000000000004' AND total_sales=40 AND cash_sales=3) THEN RAISE EXCEPTION 'Order deletion did not refresh totals'; END IF; END $$;

-- Expired, not-yet-started and missing subscription are blocked by the public
-- wrappers, not merely by RLS. Reactivation restores the legitimate RPC.
UPDATE public.tenant_subscriptions SET ends_at=now()-interval '1 second' WHERE tenant_id='00000000-0000-0000-0000-000000000001';
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT public.close_cashier_session(current_setting('test.new_shift')::uuid,1,NULL)$q$,'42501','Service unavailable');
SELECT pg_temp.expect_error($q$SELECT public.open_cashier_session(1)$q$,'42501','Service unavailable');
DO $$ BEGIN IF (SELECT count(*) FROM public.cashier_sessions)<>0 THEN RAISE EXCEPTION 'Expired subscription exposed sessions'; END IF; END $$;
RESET ROLE;
UPDATE public.tenant_subscriptions SET starts_at=now()+interval '1 day',ends_at=NULL WHERE tenant_id='00000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT public.open_cashier_session(1)$q$,'42501','Service unavailable');
RESET ROLE;
DELETE FROM public.tenant_subscriptions WHERE tenant_id='00000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT public.open_cashier_session(1)$q$,'42501','Service unavailable');
RESET ROLE;
INSERT INTO public.tenant_subscriptions VALUES ('00000000-0000-0000-0000-000000000001',now()-interval '1 day',NULL);
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE s public.cashier_sessions; BEGIN s:=public.open_cashier_session(2); IF s.status<>'open' OR s.id IS DISTINCT FROM current_setting('test.new_shift')::uuid THEN RAISE EXCEPTION 'Restored subscription cannot resume the original shift'; END IF; END $$;
RESET ROLE;

-- Actual maintenance operation after preservation of privileges inherited from PUBLIC.
SELECT set_config('request.jwt.claim.role','service_role',true),set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE service_role;
UPDATE public.cashier_sessions SET notes='maintenance' WHERE id='40000000-0000-0000-0000-000000000005';
RESET ROLE;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.cashier_sessions WHERE id='40000000-0000-0000-0000-000000000005' AND notes='maintenance') THEN RAISE EXCEPTION 'Service maintenance failed'; END IF; END $$;
ROLLBACK;
