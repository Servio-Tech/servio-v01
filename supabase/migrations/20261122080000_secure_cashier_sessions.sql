-- Secure shift writes without replacing the subscription-gated public RPC wrappers.
-- Managers can manage shifts in any branch of their own tenant; cashiers may
-- manage only their own shift. A cashier moved to another branch must have the
-- old open shift closed before opening there. Historical order changes continue
-- to refresh even closed shifts through the existing definer trigger.
BEGIN;

-- This migration must follow 20261122030000 and its wrapper installation. Fail
-- rather than silently discard subscription checks on a different deployment.
DO $$
DECLARE r record; v_table_owner oid; v_force boolean; v_rls boolean;
BEGIN
  IF pg_catalog.to_regprocedure('servio_subscription_private.open_cashier_session(numeric)') IS NULL
     OR pg_catalog.to_regprocedure('servio_subscription_private.close_cashier_session(uuid,numeric,text)') IS NULL
     OR pg_catalog.to_regprocedure('servio_subscription_private.refresh_cashier_session_totals(uuid)') IS NULL
     OR pg_catalog.to_regprocedure('public.open_cashier_session(numeric)') IS NULL
     OR pg_catalog.to_regprocedure('public.close_cashier_session(uuid,numeric,text)') IS NULL
     OR pg_catalog.strpos(pg_catalog.pg_get_functiondef('public.open_cashier_session(numeric)'::pg_catalog.regprocedure), 'servio_subscription_private.open_cashier_session') = 0
     OR pg_catalog.strpos(pg_catalog.pg_get_functiondef('public.close_cashier_session(uuid,numeric,text)'::pg_catalog.regprocedure), 'servio_subscription_private.close_cashier_session') = 0
     OR pg_catalog.strpos(pg_catalog.pg_get_functiondef('public.refresh_cashier_session_totals(uuid)'::pg_catalog.regprocedure), 'servio_subscription_private.refresh_cashier_session_totals') = 0
     OR pg_catalog.strpos(pg_catalog.pg_get_functiondef('public.open_cashier_session(numeric)'::pg_catalog.regprocedure), 'platform_subscription_current_user_allowed') = 0
     OR pg_catalog.strpos(pg_catalog.pg_get_functiondef('public.close_cashier_session(uuid,numeric,text)'::pg_catalog.regprocedure), 'platform_subscription_current_user_allowed') = 0 THEN
    RAISE EXCEPTION 'Expected subscription-gated shift RPC wrappers are not installed';
  END IF;
  SELECT relowner, relforcerowsecurity, relrowsecurity INTO v_table_owner,v_force,v_rls
  FROM pg_catalog.pg_class WHERE oid='public.cashier_sessions'::pg_catalog.regclass;
  IF NOT v_rls THEN
    RAISE EXCEPTION 'cashier_sessions row-level security must be enabled';
  END IF;
  FOR r IN
    SELECT p.oid,p.proowner,p.prosecdef,roles.rolsuper,roles.rolbypassrls
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_roles roles ON roles.oid=p.proowner
    WHERE p.oid IN ('servio_subscription_private.open_cashier_session(numeric)'::pg_catalog.regprocedure,
                    'servio_subscription_private.close_cashier_session(uuid,numeric,text)'::pg_catalog.regprocedure,
                    'servio_subscription_private.refresh_cashier_session_totals(uuid)'::pg_catalog.regprocedure,
                    'public.refresh_cashier_session_totals(uuid)'::pg_catalog.regprocedure,
                    'public.sync_cashier_session_totals_from_order()'::pg_catalog.regprocedure)
  LOOP
    IF NOT r.prosecdef OR NOT (r.rolsuper OR r.rolbypassrls OR (r.proowner=v_table_owner AND NOT v_force)) THEN
      RAISE EXCEPTION 'Shift definer % cannot safely bypass cashier_sessions RLS', r.oid::pg_catalog.regprocedure;
    END IF;
  END LOOP;
  IF pg_catalog.to_regprocedure('public.sync_cashier_session_totals_from_order()') IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgrelid='public.orders'::pg_catalog.regclass
      AND t.tgfoid='public.sync_cashier_session_totals_from_order()'::pg_catalog.regprocedure
      AND NOT t.tgisinternal AND t.tgenabled IN ('O','A')
      -- AFTER ROW, for INSERT, UPDATE and DELETE, without a filtering WHEN.
      AND t.tgtype=29 AND t.tgqual IS NULL
      AND (pg_catalog.cardinality(t.tgattr::smallint[])=0 OR NOT EXISTS (
        SELECT 1 FROM pg_catalog.unnest(ARRAY['status','payment_status','payment_method',
          'cash_amount','card_amount','total_price','cashier_session_id']) needed(name)
        WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a
          WHERE a.attrelid=t.tgrelid AND a.attname=needed.name AND NOT a.attisdropped
            AND a.attnum=ANY(t.tgattr::smallint[]))
      ))
  ) THEN
    RAISE EXCEPTION 'Expected enabled complete cashier totals order trigger is missing';
  END IF;
END $$;

-- Preserve existing effective maintenance privileges, including those inherited
-- through PUBLIC. Only API writes/DDL privileges are removed; SELECT is intact.
CREATE TEMP TABLE cashier_session_service_acl ON COMMIT DROP AS
SELECT NULL::text AS column_name, p AS privilege
FROM pg_catalog.unnest(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
WHERE pg_catalog.has_table_privilege('service_role','public.cashier_sessions',p)
UNION ALL
SELECT a.attname::text, p
FROM pg_catalog.pg_attribute a
CROSS JOIN pg_catalog.unnest(ARRAY['INSERT','UPDATE','REFERENCES']) p
WHERE a.attrelid='public.cashier_sessions'::pg_catalog.regclass AND a.attnum>0 AND NOT a.attisdropped
  AND pg_catalog.has_column_privilege('service_role','public.cashier_sessions',a.attname,p);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.cashier_sessions FROM PUBLIC, anon, authenticated;
DO $$
DECLARE a record; r record; role_name text; priv text;
BEGIN
  FOR a IN SELECT attname FROM pg_catalog.pg_attribute
           WHERE attrelid='public.cashier_sessions'::pg_catalog.regclass AND attnum>0 AND NOT attisdropped
  LOOP
    EXECUTE pg_catalog.format('REVOKE INSERT (%1$I), UPDATE (%1$I), REFERENCES (%1$I) ON public.cashier_sessions FROM PUBLIC, anon, authenticated',a.attname);
  END LOOP;
  FOR r IN SELECT column_name,privilege FROM cashier_session_service_acl WHERE column_name IS NULL LOOP
    IF NOT pg_catalog.has_table_privilege('service_role','public.cashier_sessions',r.privilege) THEN
      EXECUTE pg_catalog.format('GRANT %s ON public.cashier_sessions TO service_role',r.privilege);
    END IF;
  END LOOP;
  FOR r IN SELECT column_name,privilege FROM cashier_session_service_acl WHERE column_name IS NOT NULL LOOP
    IF NOT pg_catalog.has_column_privilege('service_role','public.cashier_sessions',r.column_name,r.privilege) THEN
      EXECUTE pg_catalog.format('GRANT %s (%I) ON public.cashier_sessions TO service_role',r.privilege,r.column_name);
    END IF;
  END LOOP;
  -- A grant inherited through another role cannot be removed by REVOKE above.
  -- Abort rather than claim TRUNCATE (outside RLS) or other writes are blocked.
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOREACH priv IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      IF pg_catalog.has_table_privilege(role_name,'public.cashier_sessions',priv) THEN
        RAISE EXCEPTION 'Inherited % privilege on cashier_sessions remains for %',priv,role_name;
      END IF;
    END LOOP;
    FOR a IN SELECT attname FROM pg_catalog.pg_attribute
             WHERE attrelid='public.cashier_sessions'::pg_catalog.regclass AND attnum>0 AND NOT attisdropped LOOP
      FOREACH priv IN ARRAY ARRAY['INSERT','UPDATE','REFERENCES'] LOOP
        IF pg_catalog.has_column_privilege(role_name,'public.cashier_sessions',a.attname,priv) THEN
          RAISE EXCEPTION 'Inherited column % privilege on cashier_sessions remains for %',priv,role_name;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

DROP POLICY IF EXISTS cashier_sessions_insert ON public.cashier_sessions;
DROP POLICY IF EXISTS cashier_sessions_update ON public.cashier_sessions;
-- Additional restrictive policies withstand other permissive policies or later
-- accidental grants. Owner/BYPASSRLS definer functions and service maintenance
-- remain usable. The existing SELECT and block/subscription policies are kept.
CREATE POLICY cashier_sessions_no_api_insert ON public.cashier_sessions AS RESTRICTIVE
  FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY cashier_sessions_no_api_update ON public.cashier_sessions AS RESTRICTIVE
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY cashier_sessions_no_api_delete ON public.cashier_sessions AS RESTRICTIVE
  FOR DELETE TO anon, authenticated USING (false);

-- Lock in a separate SQL statement before aggregating. The old single UPDATE
-- could take its aggregate snapshot, wait for another transaction's shift
-- lock, then overwrite that transaction's totals with a stale sum. Under READ
-- COMMITTED the following UPDATE gets a fresh snapshot after the lock wait.
-- Higher isolation levels safely raise a serialization error on such a race.
-- CREATE OR REPLACE preserves the private helper's owner and ACL; the public
-- subscription wrapper and the order trigger remain untouched.
CREATE OR REPLACE FUNCTION servio_subscription_private.refresh_cashier_session_totals(p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_session_id IS NULL THEN RETURN; END IF;
  PERFORM 1 FROM public.cashier_sessions cs WHERE cs.id=p_session_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.cashier_sessions cs
  SET total_sales=s.total_sales, cash_sales=s.cash_sales, card_sales=s.card_sales,
      wallet_sales=s.wallet_sales, transfer_sales=s.transfer_sales, other_sales=s.other_sales
  FROM (
    SELECT COALESCE(pg_catalog.sum(o.total_price),0)::numeric(12,2) AS total_sales,
      COALESCE(pg_catalog.sum(CASE WHEN o.payment_method='split' THEN COALESCE(o.cash_amount,0)
        WHEN o.payment_method='cash' THEN o.total_price ELSE 0 END),0)::numeric(12,2) AS cash_sales,
      COALESCE(pg_catalog.sum(CASE WHEN o.payment_method='split' THEN COALESCE(o.card_amount,0)
        WHEN o.payment_method='card' THEN o.total_price ELSE 0 END),0)::numeric(12,2) AS card_sales,
      COALESCE(pg_catalog.sum(o.total_price) FILTER (WHERE o.payment_method='wallet'),0)::numeric(12,2) AS wallet_sales,
      COALESCE(pg_catalog.sum(o.total_price) FILTER (WHERE o.payment_method='transfer'),0)::numeric(12,2) AS transfer_sales,
      COALESCE(pg_catalog.sum(o.total_price) FILTER (WHERE o.payment_method IS NULL OR o.payment_method='other'),0)::numeric(12,2) AS other_sales
    FROM public.orders o WHERE o.cashier_session_id=p_session_id
      AND o.status IN ('ready','served','unclaimed') AND COALESCE(o.payment_status,'unpaid')='paid'
  ) s WHERE cs.id=p_session_id;
END $$;

CREATE OR REPLACE FUNCTION servio_subscription_private.open_cashier_session(p_opening_cash numeric DEFAULT 0)
RETURNS public.cashier_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant uuid; v_role text; v_cashier public.cashiers%ROWTYPE;
  v_session public.cashier_sessions%ROWTYPE;
BEGIN
  IF p_opening_cash IS NULL OR p_opening_cash < 0 OR p_opening_cash::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'Opening cash must be finite and non-negative' USING ERRCODE='22023';
  END IF;
  SELECT p.tenant_id,p.role INTO v_tenant,v_role FROM public.profiles p
  WHERE p.id=auth.uid() FOR SHARE;
  IF NOT FOUND OR v_tenant IS NULL OR v_role <> 'cashier' THEN
    RAISE EXCEPTION 'Active cashier profile not found' USING ERRCODE='42501';
  END IF;
  -- Serializes duplicate opens and the existing cashier archive guard.
  SELECT c.* INTO v_cashier FROM public.cashiers c
  WHERE c.auth_user_id=auth.uid() AND c.tenant_id=v_tenant AND c.is_active IS TRUE FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id=v_cashier.branch_id AND b.tenant_id=v_tenant) THEN
    RAISE EXCEPTION 'Active cashier profile not found' USING ERRCODE='42501';
  END IF;
  SELECT s.* INTO v_session FROM public.cashier_sessions s
  WHERE s.cashier_id=v_cashier.id AND s.status='open' FOR UPDATE;
  IF FOUND THEN
    IF v_session.auth_user_id IS DISTINCT FROM auth.uid() OR v_session.tenant_id IS DISTINCT FROM v_tenant
       OR v_session.branch_id IS DISTINCT FROM v_cashier.branch_id THEN
      RAISE EXCEPTION 'Existing open shift is in a different scope; ask a manager to close it' USING ERRCODE='55000';
    END IF;
    RETURN v_session;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id=v_cashier.branch_id AND b.tenant_id=v_tenant AND b.is_active IS TRUE) THEN
    RAISE EXCEPTION 'Active cashier branch required' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.cashier_sessions(tenant_id,branch_id,cashier_id,auth_user_id,opening_cash)
  VALUES(v_tenant,v_cashier.branch_id,v_cashier.id,auth.uid(),pg_catalog.round(p_opening_cash,2))
  RETURNING * INTO v_session;
  RETURN v_session;
END $$;

CREATE OR REPLACE FUNCTION servio_subscription_private.close_cashier_session(p_session_id uuid, p_closing_cash numeric, p_notes text DEFAULT NULL)
RETURNS public.cashier_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  result public.cashier_sessions%ROWTYPE; v_tenant uuid; v_role text;
  v_total numeric; v_cash numeric; v_card numeric; v_wallet numeric; v_transfer numeric; v_other numeric;
BEGIN
  IF p_closing_cash IS NULL OR p_closing_cash < 0 OR p_closing_cash::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'Closing cash must be finite and non-negative' USING ERRCODE='22023';
  END IF;
  -- Lock the requesting profile so a concurrent role/tenant change cannot
  -- authorize a stale close. Inaccessible and non-existent shifts are identical.
  SELECT p.tenant_id,p.role INTO v_tenant,v_role FROM public.profiles p
  WHERE p.id=auth.uid() AND p.role IN ('admin','cashier') FOR SHARE;
  IF NOT FOUND OR v_tenant IS NULL THEN
    RAISE EXCEPTION 'Open cashier session not found' USING ERRCODE='P0002';
  END IF;
  SELECT cs.* INTO result FROM public.cashier_sessions cs
  WHERE cs.id=p_session_id AND cs.tenant_id=v_tenant AND cs.status='open'
    AND EXISTS (SELECT 1 FROM public.branches b WHERE b.id=cs.branch_id AND b.tenant_id=cs.tenant_id)
    AND EXISTS (SELECT 1 FROM public.cashiers c WHERE c.id=cs.cashier_id AND c.tenant_id=cs.tenant_id
      AND (v_role='admin' OR (v_role='cashier' AND cs.auth_user_id=auth.uid()
                            AND c.auth_user_id=auth.uid() AND c.is_active IS TRUE)))
  FOR UPDATE OF cs;
  IF NOT FOUND THEN RAISE EXCEPTION 'Open cashier session not found' USING ERRCODE='P0002'; END IF;
  SELECT COALESCE(pg_catalog.sum(o.total_price),0),
    COALESCE(pg_catalog.sum(CASE WHEN o.payment_method='cash' THEN o.total_price WHEN o.payment_method='split' THEN COALESCE(o.cash_amount,0) ELSE 0 END),0),
    COALESCE(pg_catalog.sum(CASE WHEN o.payment_method='card' THEN o.total_price WHEN o.payment_method='split' THEN COALESCE(o.card_amount,0) ELSE 0 END),0),
    COALESCE(pg_catalog.sum(o.total_price) FILTER (WHERE o.payment_method='wallet'),0),
    COALESCE(pg_catalog.sum(o.total_price) FILTER (WHERE o.payment_method='transfer'),0),
    COALESCE(pg_catalog.sum(o.total_price) FILTER (WHERE o.payment_method='other' OR o.payment_method IS NULL),0)
  INTO v_total,v_cash,v_card,v_wallet,v_transfer,v_other
  FROM public.orders o WHERE o.cashier_session_id=result.id
    AND o.status IN ('ready','served','unclaimed') AND COALESCE(o.payment_status,'unpaid')='paid';
  IF v_total <> v_cash+v_card+v_wallet+v_transfer+v_other THEN
    RAISE EXCEPTION 'SHIFT_PAYMENT_RECONCILIATION_MISMATCH';
  END IF;
  UPDATE public.cashier_sessions cs SET status='closed',closed_at=pg_catalog.now(),closing_cash=p_closing_cash,
    notes=NULLIF(pg_catalog.btrim(p_notes),''),total_sales=v_total,cash_sales=v_cash,card_sales=v_card,
    wallet_sales=v_wallet,transfer_sales=v_transfer,other_sales=v_other
  WHERE cs.id=result.id RETURNING cs.* INTO result;
  RETURN result;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
