-- Apply after the owner audit table and subscription/date migrations. Every
-- successful owner_set_subscription call, including direct RPC, records its
-- completion in the same transaction. No trusted identity is supplied by a caller.
BEGIN;

-- A still-running old Edge version used this service RPC to audit subscription
-- attempts separately. Disable that action here: it cannot forge or duplicate
-- a completion, and its old preflight fails closed until Edge is upgraded.
CREATE OR REPLACE FUNCTION public.platform_owner_audit_event(
  p_actor_id uuid, p_user_id uuid, p_tenant_id uuid, p_action text, p_outcome text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_action = 'set_subscription' THEN
    RAISE EXCEPTION 'Subscription audit is recorded by the owner RPC' USING ERRCODE = '42501';
  END IF;
  PERFORM public.platform_require_owner(p_actor_id);
  INSERT INTO public.platform_owner_audit(actor_id, target_user_id, target_tenant_id, action, outcome)
  VALUES (p_actor_id, p_user_id, p_tenant_id, p_action, p_outcome);
END;
$$;
REVOKE ALL ON FUNCTION public.platform_owner_audit_event(uuid,uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_owner_audit_event(uuid,uuid,uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.owner_set_subscription(
  p_tenant_id uuid, p_plan text, p_starts_at timestamptz, p_ends_at timestamptz
)
RETURNS public.tenant_subscriptions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_result public.tenant_subscriptions;
  v_count bigint;
  v_audit_id bigint;
BEGIN
  -- Read and lock the actual Auth identity. JWT email and metadata are not
  -- authorization evidence. Keep the existing session/block protection even
  -- when invoked outside PostgREST's pre-request hook.
  IF v_actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = v_actor_id
      AND pg_catalog.lower(pg_catalog.btrim(u.email)) = 'serviotech.sa@gmail.com'
      AND u.email_confirmed_at IS NOT NULL
    FOR SHARE
  ) THEN
    RAISE EXCEPTION 'Confirmed platform owner account required' USING ERRCODE = '42501';
  END IF;
  IF public.platform_current_user_allowed() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Account unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_plan IS NULL OR p_plan NOT IN ('starter', 'pro') THEN
    RAISE EXCEPTION 'Plan must be starter or pro' USING ERRCODE = '22023';
  END IF;
  IF p_starts_at IS NULL OR NOT pg_catalog.isfinite(p_starts_at)
     OR (p_ends_at IS NOT NULL AND (NOT pg_catalog.isfinite(p_ends_at) OR p_ends_at <= p_starts_at)) THEN
    RAISE EXCEPTION 'Invalid subscription dates: starts_at is required and ends_at must be later than starts_at' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.tenants t WHERE t.id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found' USING ERRCODE = 'P0002';
  END IF;

  -- Preserve the shared tenant lock and tuple update used by the branch-limit
  -- guard, including its safe serialization behavior under REPEATABLE READ.
  UPDATE public.tenant_subscriptions s
  SET plan = p_plan, starts_at = p_starts_at, ends_at = p_ends_at
  WHERE s.tenant_id = p_tenant_id RETURNING s.* INTO v_result;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found for tenant' USING ERRCODE = 'P0002';
  END IF;
  IF p_plan = 'starter' THEN
    SELECT count(*) INTO v_count FROM public.branches b WHERE b.tenant_id = p_tenant_id;
    IF v_count > 1 THEN
      RAISE EXCEPTION 'Cannot downgrade to starter: tenant has % total branches; starter allows 1 including inactive branches', v_count
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Neither suppress audit errors nor return success if an unexpected trigger
  -- silently suppresses or rewrites the row. Any exception rolls back the update.
  INSERT INTO public.platform_owner_audit(actor_id, target_user_id, target_tenant_id, action, outcome)
  VALUES (v_actor_id, NULL, p_tenant_id, 'set_subscription', 'completed')
  RETURNING id INTO v_audit_id;
  IF v_audit_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.platform_owner_audit a
    WHERE a.id = v_audit_id AND a.actor_id = v_actor_id
      AND a.target_user_id IS NULL AND a.target_tenant_id = p_tenant_id
      AND a.action = 'set_subscription' AND a.outcome = 'completed'
  ) THEN
    RAISE EXCEPTION 'Subscription audit unavailable' USING ERRCODE = '55000';
  END IF;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.owner_set_subscription(uuid, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owner_set_subscription(uuid, text, timestamptz, timestamptz) TO authenticated;

-- Edge uses this versioned invoker entry point. If Edge is deployed first, the
-- missing RPC fails before any update. Delegation keeps auth.uid() and runs the
-- original authenticated RPC in the same database transaction. Direct callers
-- of owner_set_subscription remain fully protected by the replacement above.
CREATE FUNCTION public.owner_set_subscription_audited(
  p_tenant_id uuid, p_plan text, p_starts_at timestamptz, p_ends_at timestamptz
)
RETURNS public.tenant_subscriptions LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT public.owner_set_subscription(p_tenant_id, p_plan, p_starts_at, p_ends_at);
$$;
REVOKE ALL ON FUNCTION public.owner_set_subscription_audited(uuid,text,timestamptz,timestamptz) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owner_set_subscription_audited(uuid,text,timestamptz,timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
