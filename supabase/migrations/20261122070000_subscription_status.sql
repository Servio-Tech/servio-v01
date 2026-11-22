-- A narrowly scoped diagnostic, not an access-control bypass. Apply after the
-- subscription and account-block migrations. No tenant identifier is accepted
-- or returned. Existing RLS, RPC wrappers and the PostgREST hook stay unchanged.
BEGIN;

CREATE FUNCTION public.platform_current_subscription_status()
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant_id uuid;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
BEGIN
  -- Enforce account bans, deletion and session fencing even outside PostgREST.
  IF v_uid IS NULL OR NOT public.platform_current_user_allowed() THEN
    RAISE EXCEPTION 'Account unavailable' USING ERRCODE = '42501';
  END IF;

  -- Match the precedence used by platform_subscription_current_user_allowed:
  -- a profile wins over a cashier link; only a profileless identity uses cashier.
  SELECT p.tenant_id INTO v_tenant_id FROM public.profiles p WHERE p.id = v_uid;
  IF NOT FOUND THEN
    SELECT c.tenant_id INTO v_tenant_id FROM public.cashiers c WHERE c.auth_user_id = v_uid;
    IF NOT FOUND THEN RETURN 'unlinked'; END IF;
  END IF;

  SELECT s.starts_at, s.ends_at INTO v_starts_at, v_ends_at
  FROM public.tenant_subscriptions s WHERE s.tenant_id = v_tenant_id;
  IF NOT FOUND THEN RETURN 'missing'; END IF;
  IF v_starts_at > pg_catalog.now() THEN RETURN 'not_started'; END IF;
  IF v_ends_at IS NOT NULL AND v_ends_at <= pg_catalog.now() THEN RETURN 'expired'; END IF;
  RETURN 'active';
END;
$$;
REVOKE ALL ON FUNCTION public.platform_current_subscription_status() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_current_subscription_status() TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
