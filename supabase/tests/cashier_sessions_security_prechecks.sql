\set ON_ERROR_STOP on
-- Negative controls: execute the real old bodies through the real subscription
-- wrappers. Each exploit MUST succeed here, or the suite is not testing it.
BEGIN;
-- Do not rely on the intentionally broad defense-in-depth test policy: the
-- application's original cashier_sessions_update policy itself permits fraud.
DROP POLICY fixture_other_update ON public.cashier_sessions;
SELECT set_config('request.jwt.claim.role','authenticated',true),
       set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE s public.cashier_sessions; BEGIN
  s := public.close_cashier_session('40000000-0000-0000-0000-000000000005',77,'cross tenant exploit');
  IF s.tenant_id <> '00000000-0000-0000-0000-000000000002'::uuid
     OR s.status <> 'closed' OR s.closing_cash <> 77 THEN
    RAISE EXCEPTION 'NEGATIVE CONTROL FAILED: tenant A admin did not close tenant B shift';
  END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.cashier_sessions
   WHERE id='40000000-0000-0000-0000-000000000005' AND status='closed'
     AND closing_cash=77 AND notes='cross tenant exploit') THEN
   RAISE EXCEPTION 'NEGATIVE CONTROL FAILED: cross-tenant change not persisted inside transaction';
 END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n integer; BEGIN
 UPDATE public.cashier_sessions SET total_sales=9876, notes='forged'
 WHERE id='40000000-0000-0000-0000-000000000004';
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n <> 1 THEN RAISE EXCEPTION 'NEGATIVE CONTROL FAILED: direct tampering affected % rows',n; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.cashier_sessions WHERE id='40000000-0000-0000-0000-000000000004'
   AND total_sales=9876 AND notes='forged') THEN
   RAISE EXCEPTION 'NEGATIVE CONTROL FAILED: direct write did not persist inside transaction';
 END IF;
 IF NOT has_table_privilege('authenticated','public.cashier_sessions','TRUNCATE') THEN
   RAISE EXCEPTION 'NEGATIVE CONTROL FAILED: expected inherited PUBLIC TRUNCATE grant';
 END IF;
END $$;
ROLLBACK;
