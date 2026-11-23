-- Apply after subscription auditing. All supported Owner Admin subscription
-- writes must use this explicit idempotent RPC. Existing RPC OIDs remain for
-- dependency compatibility, but API roles may no longer execute either legacy
-- entry point after this transaction commits.
BEGIN;

CREATE TABLE public.platform_subscription_idempotency (
  actor_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  tenant_id uuid NOT NULL,
  plan text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (actor_id, idempotency_key)
);
ALTER TABLE public.platform_subscription_idempotency ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_subscription_idempotency FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.owner_set_subscription_idempotent_v1(
  p_tenant_id uuid,
  p_plan text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_idempotency_key uuid
)
RETURNS public.tenant_subscriptions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_result public.tenant_subscriptions;
  v_existing public.platform_subscription_idempotency;
  v_claimed boolean := false;
  v_count bigint;
  v_audit_id bigint;
BEGIN
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
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Idempotency key is required' USING ERRCODE = '22023';
  END IF;

  -- An existing key is compared before new-payload validation. A key can never
  -- silently be repurposed, even if the changed payload would itself be invalid.
  SELECT d.* INTO v_existing
  FROM public.platform_subscription_idempotency d
  WHERE d.actor_id = v_actor_id AND d.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.tenant_id IS DISTINCT FROM p_tenant_id
       OR v_existing.plan IS DISTINCT FROM p_plan
       OR v_existing.starts_at IS DISTINCT FROM p_starts_at
       OR v_existing.ends_at IS DISTINCT FROM p_ends_at THEN
      RAISE EXCEPTION 'Idempotency key was already used with a different subscription payload' USING ERRCODE = '23505';
    END IF;
    PERFORM 1 FROM public.tenants t WHERE t.id = p_tenant_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Tenant not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT s.* INTO v_result FROM public.tenant_subscriptions s WHERE s.tenant_id = p_tenant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Subscription not found for tenant' USING ERRCODE = 'P0002';
    END IF;
    RETURN v_result;
  END IF;

  IF p_plan IS NULL OR p_plan NOT IN ('starter', 'pro') THEN
    RAISE EXCEPTION 'Plan must be starter or pro' USING ERRCODE = '22023';
  END IF;
  IF p_starts_at IS NULL OR NOT pg_catalog.isfinite(p_starts_at)
     OR (p_ends_at IS NOT NULL AND (NOT pg_catalog.isfinite(p_ends_at) OR p_ends_at <= p_starts_at)) THEN
    RAISE EXCEPTION 'Invalid subscription dates: starts_at is required and ends_at must be later than starts_at' USING ERRCODE = '22023';
  END IF;

  -- Serialize every new mutation and replay against branch-limit writes for the
  -- same tenant. Recheck the key after waiting, since another request may have
  -- committed it while this transaction was waiting for this lock.
  PERFORM 1 FROM public.tenants t WHERE t.id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT d.* INTO v_existing
  FROM public.platform_subscription_idempotency d
  WHERE d.actor_id = v_actor_id AND d.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.tenant_id IS DISTINCT FROM p_tenant_id
       OR v_existing.plan IS DISTINCT FROM p_plan
       OR v_existing.starts_at IS DISTINCT FROM p_starts_at
       OR v_existing.ends_at IS DISTINCT FROM p_ends_at THEN
      RAISE EXCEPTION 'Idempotency key was already used with a different subscription payload' USING ERRCODE = '23505';
    END IF;
    SELECT s.* INTO v_result FROM public.tenant_subscriptions s WHERE s.tenant_id = p_tenant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Subscription not found for tenant' USING ERRCODE = 'P0002';
    END IF;
    RETURN v_result;
  END IF;

  INSERT INTO public.platform_subscription_idempotency(actor_id, idempotency_key, tenant_id, plan, starts_at, ends_at)
  VALUES (v_actor_id, p_idempotency_key, p_tenant_id, p_plan, p_starts_at, p_ends_at)
  ON CONFLICT (actor_id, idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_claimed := v_count = 1;
  IF NOT v_claimed THEN
    -- This also covers the rare same-key race across different tenants. Under
    -- READ COMMITTED, the following statement sees the committed winner; under
    -- stronger isolation PostgreSQL may instead raise a serialization failure.
    SELECT d.* INTO v_existing
    FROM public.platform_subscription_idempotency d
    WHERE d.actor_id = v_actor_id AND d.idempotency_key = p_idempotency_key;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Concurrent idempotency claim requires retry with the same key and payload' USING ERRCODE = '40001';
    END IF;
    IF v_existing.tenant_id IS DISTINCT FROM p_tenant_id
       OR v_existing.plan IS DISTINCT FROM p_plan
       OR v_existing.starts_at IS DISTINCT FROM p_starts_at
       OR v_existing.ends_at IS DISTINCT FROM p_ends_at THEN
      RAISE EXCEPTION 'Idempotency key was already used with a different subscription payload' USING ERRCODE = '23505';
    END IF;
    SELECT s.* INTO v_result FROM public.tenant_subscriptions s WHERE s.tenant_id = p_tenant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Subscription not found for tenant' USING ERRCODE = 'P0002';
    END IF;
    RETURN v_result;
  END IF;

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
REVOKE ALL ON FUNCTION public.owner_set_subscription_idempotent_v1(uuid,text,timestamptz,timestamptz,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owner_set_subscription_idempotent_v1(uuid,text,timestamptz,timestamptz,uuid) TO authenticated;

-- Both former authenticated write entry points bypass durable deduplication.
REVOKE ALL ON FUNCTION public.owner_set_subscription(uuid,text,timestamptz,timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.owner_set_subscription_audited(uuid,text,timestamptz,timestamptz) FROM PUBLIC, anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
