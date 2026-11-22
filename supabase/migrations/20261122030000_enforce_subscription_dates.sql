-- Enforce the subscription interval without changing subscription or tenant data.
-- IMPORTANT: public Storage buckets/CDNs bypass database RLS on downloads; this
-- migration cannot revoke already-known public image URLs or cached responses.
-- PostgREST's existing platform_block_request_guard and its setting are untouched.
BEGIN;

CREATE FUNCTION public.platform_subscription_tenant_active(p_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_subscriptions s
    WHERE s.tenant_id = p_tenant_id
      AND s.starts_at <= pg_catalog.now()
      AND (s.ends_at IS NULL OR pg_catalog.now() < s.ends_at)
  );
$$;
REVOKE ALL ON FUNCTION public.platform_subscription_tenant_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_subscription_tenant_active(uuid) TO anon, authenticated, service_role;

CREATE FUNCTION public.platform_subscription_slug_active(p_slug text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenants t
    JOIN public.tenant_subscriptions s ON s.tenant_id = t.id
    WHERE pg_catalog.lower(t.slug) = pg_catalog.lower(pg_catalog.btrim(p_slug))
      AND s.starts_at <= pg_catalog.now()
      AND (s.ends_at IS NULL OR pg_catalog.now() < s.ends_at)
  );
$$;
REVOKE ALL ON FUNCTION public.platform_subscription_slug_active(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_subscription_slug_active(text) TO anon, authenticated, service_role;

-- An identity with no profile and no linked cashier is allowed to complete new
-- registration. A linked cashier without a profile is still subscription-gated.
-- The owner renewal and platform APIs are not gated by this helper. If the
-- owner also has a tenant profile, ordinary staff APIs still honor that tenant.
CREATE FUNCTION public.platform_subscription_current_user_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND (
    CASE
      WHEN EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()) THEN
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
          AND public.platform_subscription_tenant_active(p.tenant_id))
      WHEN EXISTS (SELECT 1 FROM public.cashiers c WHERE c.auth_user_id = auth.uid()) THEN
        EXISTS (SELECT 1 FROM public.cashiers c WHERE c.auth_user_id = auth.uid()
          AND public.platform_subscription_tenant_active(c.tenant_id))
      ELSE true
    END
  );
$$;
REVOKE ALL ON FUNCTION public.platform_subscription_current_user_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_subscription_current_user_allowed() TO authenticated, service_role;

-- Independent of the existing account-block restrictive policies. Only public
-- application tables are owned/managed by this migration; Storage and Realtime
-- schemas are platform-owned and require their own supported control plane.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, c.relname
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r','p') AND c.relrowsecurity
      AND n.nspname = 'public'
  LOOP
    EXECUTE pg_catalog.format(
      'CREATE POLICY subscription_staff_active ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.platform_subscription_current_user_allowed()) WITH CHECK (public.platform_subscription_current_user_allowed())',
      r.nspname, r.relname);
  END LOOP;
END $$;

-- Apply row-specific restrictions even to anonymous/direct reads. Keep owner
-- renewal metadata separately accessible via the owner/service APIs. These are
-- additional restrictive policies and never expand existing permissions.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, c.relname
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attname='tenant_id'
      AND a.atttypid='uuid'::pg_catalog.regtype AND NOT a.attisdropped
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relrowsecurity
      AND c.relname <> 'tenant_subscriptions'
  LOOP
    EXECUTE pg_catalog.format(
      'CREATE POLICY subscription_row_active ON %I.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (public.platform_subscription_tenant_active(tenant_id)) WITH CHECK (public.platform_subscription_tenant_active(tenant_id))',
      r.nspname, r.relname);
  END LOOP;
END $$;
CREATE POLICY subscription_row_active ON public.tenants AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (public.platform_subscription_tenant_active(id))
  WITH CHECK (public.platform_subscription_tenant_active(id));

-- Preserve original function bodies in an unexposed schema, keeping their owners
-- and ACLs. CREATE OR REPLACE keeps the public function OID, signature, defaults,
-- return shape, grants, and dependencies; the new body gates and delegates.
-- This covers every currently granted SECURITY DEFINER staff function and every
-- overload of the public slug RPCs, rather than a fragile list of signatures.
-- Future functions and replacements MUST receive the same review and protection.
CREATE SCHEMA servio_subscription_private;
REVOKE ALL ON SCHEMA servio_subscription_private FROM PUBLIC, anon, authenticated, service_role;
DO $$
DECLARE
  r record; v_definition text; v_arguments text; v_call_args text;
  v_guard text; v_return text; v_volatility text; v_owner text;
  v_is_public boolean; v_is_login boolean; v_is_claim boolean;
  v_signature text; v_orig text;
BEGIN
  FOR r IN
    SELECT p.*, n.nspname, pg_catalog.pg_get_userbyid(p.proowner) AS owner_name,
      pg_catalog.pg_get_function_arguments(p.oid) AS arguments,
      pg_catalog.pg_get_function_result(p.oid) AS result_type
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f' AND p.prosecdef
      AND p.prorettype <> 'pg_catalog.trigger'::pg_catalog.regtype
      AND (pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
           OR pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
           OR p.proname='verify_cashier_login')
      AND p.proname NOT LIKE 'platform\_%' ESCAPE '\'
      AND p.proname <> 'owner_set_subscription'
    ORDER BY p.oid
  LOOP
    IF r.provariadic <> 0 OR EXISTS (
      SELECT 1 FROM pg_catalog.unnest(COALESCE(r.proargmodes, ARRAY[]::"char"[])) m
      WHERE m NOT IN ('i','t')
    ) THEN
      RAISE EXCEPTION 'Unsupported subscription guard function signature: %', r.oid::pg_catalog.regprocedure;
    END IF;
    v_is_public := r.proname LIKE 'get\_public\_%' ESCAPE '\'
      OR r.proname LIKE 'create\_public\_%' ESCAPE '\'
      OR r.proname='resolve_branch_id';
    v_is_login := r.proname='verify_cashier_login';
    v_is_claim := r.proname='claim_cashier_notification_deliveries';
    IF (v_is_public OR v_is_login) AND (r.pronargs < 1 OR r.proargtypes[0] <> 'pg_catalog.text'::pg_catalog.regtype
       OR COALESCE(r.proargnames[1],'') NOT IN ('p_slug','p_tenant_slug')) THEN
      RAISE EXCEPTION 'Unrecognized public subscription scope: %', r.oid::pg_catalog.regprocedure;
    END IF;
    IF v_is_claim AND (r.pronargs <> 3 OR r.proargtypes[1] <> 'pg_catalog.text'::pg_catalog.regtype
                       OR r.proargtypes[2] <> 'pg_catalog.uuid'::pg_catalog.regtype OR NOT r.proretset) THEN
      RAISE EXCEPTION 'Unrecognized notification claim signature: %', r.oid::pg_catalog.regprocedure;
    END IF;
    IF r.owner_name IN ('anon','authenticated','service_role') THEN
      RAISE EXCEPTION 'Unsafe function owner for subscription wrapper: %', r.oid::pg_catalog.regprocedure;
    END IF;
    v_owner := pg_catalog.quote_ident(r.owner_name);
    EXECUTE 'GRANT USAGE ON SCHEMA servio_subscription_private TO ' || v_owner;
    v_definition := pg_catalog.pg_get_functiondef(r.oid);
    v_orig := pg_catalog.format('FUNCTION public.%I(',r.proname);
    IF pg_catalog.strpos(v_definition, v_orig) = 0 THEN
      RAISE EXCEPTION 'Cannot safely copy function: %', r.oid::pg_catalog.regprocedure;
    END IF;
    v_definition := pg_catalog.replace(v_definition,v_orig,
      pg_catalog.format('FUNCTION servio_subscription_private.%I(',r.proname));
    EXECUTE v_definition;
    v_signature := pg_catalog.format('servio_subscription_private.%I(%s)',r.proname,
      pg_catalog.oidvectortypes(r.proargtypes));
    EXECUTE 'ALTER FUNCTION ' || v_signature || ' OWNER TO ' || v_owner;
    EXECUTE 'REVOKE ALL ON FUNCTION ' || v_signature || ' FROM PUBLIC, anon, authenticated, service_role';
    SELECT COALESCE(pg_catalog.string_agg('$' || i::text, ', ' ORDER BY i), '') INTO v_call_args
      FROM pg_catalog.generate_series(1,r.pronargs) i;

    -- Public read failures are empty/NULL; write failures are explicit. Service
    -- maintenance bypasses public checks, except service-key cashier verification.
    IF v_is_public OR v_is_login THEN
      v_guard := CASE WHEN v_is_login THEN 'IF NOT public.platform_subscription_slug_active($1) THEN '
        ELSE 'IF auth.role() IN (''anon'',''authenticated'') AND NOT public.platform_subscription_slug_active($1) THEN ' END;
      IF r.proname LIKE 'create\_public\_%' ESCAPE '\' THEN
        v_guard := v_guard || 'RAISE EXCEPTION ''Service unavailable'' USING ERRCODE = ''42501''; END IF;';
      ELSIF r.proretset THEN
        v_guard := v_guard || 'RETURN; END IF;';
      ELSE
        v_guard := v_guard || 'RETURN NULL; END IF;';
      END IF;
    ELSIF v_is_claim THEN
      -- Dispatch uses the anon key plus a webhook secret and can otherwise claim
      -- an old event after expiry. Do not interfere with service_role maintenance.
      v_guard := 'IF auth.role() IN (''anon'',''authenticated'') AND NOT EXISTS ('
        || 'SELECT 1 FROM public.orders o WHERE $2 = ''order'' AND o.id = $3 AND public.platform_subscription_tenant_active(o.tenant_id) '
        || 'UNION ALL SELECT 1 FROM public.waiter_calls w WHERE $2 = ''waiter_call'' AND w.id = $3 AND public.platform_subscription_tenant_active(w.tenant_id)) THEN RETURN; END IF;';
    ELSIF r.proname='record_cashier_notification_delivery' THEN
      -- Completing an already-claimed service delivery is operational bookkeeping.
      v_guard := '';
    ELSE
      v_guard := 'IF auth.role() = ''authenticated'' AND NOT public.platform_subscription_current_user_allowed() THEN '
        || 'RAISE EXCEPTION ''Service unavailable'' USING ERRCODE = ''42501''; END IF;';
    END IF;
    IF r.proretset THEN
      v_return := pg_catalog.format('RETURN QUERY SELECT * FROM servio_subscription_private.%I(%s); RETURN;',r.proname,v_call_args);
    ELSIF r.prorettype = 'pg_catalog.void'::pg_catalog.regtype THEN
      v_return := pg_catalog.format('PERFORM servio_subscription_private.%I(%s); RETURN;',r.proname,v_call_args);
    ELSE
      v_return := pg_catalog.format('RETURN servio_subscription_private.%I(%s);',r.proname,v_call_args);
    END IF;
    v_volatility := CASE r.provolatile WHEN 's' THEN 'STABLE' ELSE 'VOLATILE' END;
    EXECUTE pg_catalog.format(
      'CREATE OR REPLACE FUNCTION public.%I(%s) RETURNS %s LANGUAGE plpgsql %s SECURITY DEFINER SET search_path = '''' AS %L',
      r.proname, r.arguments, r.result_type, v_volatility,
      'BEGIN ' || v_guard || ' ' || v_return || ' END;');
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
