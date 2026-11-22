-- Subscription state is deliberately independent of the UI. Dates are recorded,
-- not an automatic expiration mechanism; see the test contract and deployment notes.
BEGIN;

-- Prevent a registration or branch write from slipping between the backfill and
-- installation of the triggers. This lock is released with the migration transaction.
LOCK TABLE public.tenants, public.branches IN SHARE ROW EXCLUSIVE MODE;

-- Reserve the platform owner's route on every tenant insert and slug update,
-- including legacy RPCs; fail atomically if an existing tenant occupies it.
ALTER TABLE public.tenants ADD CONSTRAINT tenants_owner_console_slug_reserved
  CHECK (pg_catalog.lower(pg_catalog.btrim(slug)) <> 'owner-console');

CREATE TABLE public.tenant_subscriptions (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro')),
  starts_at timestamptz NOT NULL DEFAULT now() CHECK (pg_catalog.isfinite(starts_at)),
  ends_at timestamptz CHECK (ends_at IS NULL OR (pg_catalog.isfinite(ends_at) AND ends_at > starts_at))
);

ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tenant_subscriptions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.tenant_subscriptions TO authenticated;
CREATE POLICY tenant_subscriptions_member_read ON public.tenant_subscriptions
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- Preserve all legacy branches, including inactive branches and tenants with >3.
INSERT INTO public.tenant_subscriptions (tenant_id, plan)
SELECT t.id, CASE WHEN count(b.id) > 1 THEN 'pro' ELSE 'starter' END
FROM public.tenants t LEFT JOIN public.branches b ON b.tenant_id = t.id
GROUP BY t.id;

-- Repair only completely branchless legacy tenants. Never add an extra 'main'
-- to a tenant already using other branch slugs, or change existing menu links.
INSERT INTO public.branches (tenant_id, name, slug)
SELECT t.id,
       CASE WHEN pg_catalog.length(pg_catalog.btrim(t.name)) >= 2
            THEN pg_catalog.left(pg_catalog.btrim(t.name), 120)
            ELSE 'الفرع الرئيسي' END,
       'main'
FROM public.tenants t
WHERE NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.tenant_id = t.id);

-- Guard every new branch and every move between tenants. Unchanged-tenant
-- updates remain possible for existing tenants grandfathered with >3 branches.
CREATE FUNCTION public.enforce_subscription_branch_limit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_plan text;
  v_limit integer;
  v_count bigint;
BEGIN
  PERFORM 1 FROM public.tenants t WHERE t.id = NEW.tenant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found' USING ERRCODE = '23503';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id THEN
    RETURN NEW;
  END IF;

  -- A tuple version change also makes REPEATABLE READ conflicts fail safely
  -- instead of counting through a stale transaction snapshot. The parent row
  -- is the common lock shared with the owner setter; values do not change here.
  UPDATE public.tenant_subscriptions s SET plan = s.plan
  WHERE s.tenant_id = NEW.tenant_id RETURNING s.plan INTO v_plan;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found for tenant' USING ERRCODE = '23514';
  END IF;
  v_limit := CASE v_plan WHEN 'pro' THEN 3 ELSE 1 END;
  SELECT count(*) INTO v_count FROM public.branches b WHERE b.tenant_id = NEW.tenant_id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Branch limit reached: % plan allows % total branch(es), including inactive branches', v_plan, v_limit
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_subscription_branch_limit() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER enforce_subscription_branch_limit_before_write
  BEFORE INSERT OR UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_subscription_branch_limit();

-- The row exists first, so the normal branch guard applies to this insert.
CREATE FUNCTION public.initialize_tenant_subscription_and_branch()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.tenant_subscriptions (tenant_id) VALUES (NEW.id);
  INSERT INTO public.branches (tenant_id, name, slug)
  VALUES (
    NEW.id,
    CASE WHEN pg_catalog.length(pg_catalog.btrim(NEW.name)) >= 2
         THEN pg_catalog.left(pg_catalog.btrim(NEW.name), 120)
         ELSE 'الفرع الرئيسي' END,
    'main'
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.initialize_tenant_subscription_and_branch() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER initialize_tenant_subscription_and_branch_after_insert
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.initialize_tenant_subscription_and_branch();

-- Auth identity is read directly, not from editable JWT claims or user metadata.
-- SET LOCAL ROLE/service credentials alone cannot impersonate the owner.
CREATE FUNCTION public.owner_set_subscription(
  p_tenant_id uuid, p_plan text, p_starts_at timestamptz, p_ends_at timestamptz
)
RETURNS public.tenant_subscriptions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_result public.tenant_subscriptions;
  v_count bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
      AND pg_catalog.lower(pg_catalog.btrim(u.email)) = 'serviotech.sa@gmail.com'
      AND u.email_confirmed_at IS NOT NULL
    FOR SHARE
  ) THEN
    RAISE EXCEPTION 'Confirmed platform owner account required' USING ERRCODE = '42501';
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

  -- Update first: under REPEATABLE READ it will abort on a concurrent branch
  -- insert which committed since this transaction's snapshot was established.
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
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.owner_set_subscription(uuid, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owner_set_subscription(uuid, text, timestamptz, timestamptz) TO authenticated;

-- Auth user metadata is only used for display/registration data, NEVER to link
-- an existing tenant or to choose a privileged role. Cashiers are linked by the
-- server-controlled cashiers.auth_user_id set by cashier-login before sign-in.
CREATE OR REPLACE FUNCTION public.ensure_profile_for_current_user()
RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_metadata jsonb;
  v_email text;
  v_profile public.profiles%ROWTYPE;
  v_cashier public.cashiers%ROWTYPE;
  v_tenant_id uuid;
  v_name text;
  v_slug text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '42501'; END IF;
  -- Serializes simultaneous login/callback calls for this identity.
  SELECT u.raw_user_meta_data, u.email INTO v_metadata, v_email
  FROM auth.users u WHERE u.id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auth user not found' USING ERRCODE = '42501'; END IF;

  SELECT p.* INTO v_profile FROM public.profiles p WHERE p.id = v_uid;
  IF FOUND THEN RETURN v_profile; END IF;

  SELECT c.* INTO v_cashier FROM public.cashiers c WHERE c.auth_user_id = v_uid;
  IF FOUND THEN
    IF NOT v_cashier.is_active THEN
      RAISE EXCEPTION 'Active cashier profile required' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.profiles (id, tenant_id, full_name, phone, role)
    VALUES (v_uid, v_cashier.tenant_id, v_cashier.full_name,
            NULLIF(pg_catalog.btrim(v_metadata->>'phone'), ''), 'cashier')
    RETURNING * INTO v_profile;
    RETURN v_profile;
  END IF;

  -- A new manager can create only a fresh tenant; user-supplied tenant_id and
  -- role are ignored, so they cannot claim any existing tenant or cashier.
  v_name := NULLIF(pg_catalog.btrim(v_metadata->>'store_name'), '');
  v_slug := pg_catalog.lower(NULLIF(pg_catalog.btrim(v_metadata->>'store_slug'), ''));
  IF v_name IS NULL OR pg_catalog.length(v_name) < 2 THEN RAISE EXCEPTION 'Tenant name is required' USING ERRCODE = '22023'; END IF;
  IF v_slug IS NULL OR v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN RAISE EXCEPTION 'Invalid slug' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.tenants (name, slug) VALUES (v_name, v_slug) RETURNING id INTO v_tenant_id;
  INSERT INTO public.store (tenant_id, store_name, store_slug, phone, email, currency)
  VALUES (v_tenant_id, v_name, v_slug, NULLIF(pg_catalog.btrim(v_metadata->>'phone'), ''),
          pg_catalog.lower(NULLIF(pg_catalog.btrim(v_email), '')),
          COALESCE(NULLIF(pg_catalog.btrim(v_metadata->>'currency'), ''), 'SAR'));
  INSERT INTO public.profiles (id, tenant_id, full_name, phone, role)
  VALUES (v_uid, v_tenant_id, COALESCE(NULLIF(v_metadata->>'full_name', ''), 'مدير'),
          NULLIF(pg_catalog.btrim(v_metadata->>'phone'), ''), 'admin')
  RETURNING * INTO v_profile;
  RETURN v_profile;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_profile_for_current_user() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_profile_for_current_user() TO authenticated;

COMMIT;
