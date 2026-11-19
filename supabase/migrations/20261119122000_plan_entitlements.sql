-- Review and test against an isolated development project before applying.
-- No payment integration is changed. Only a trusted service role can assign plans.
CREATE TABLE IF NOT EXISTS public.tenant_entitlements (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tenant_entitlements FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenant_entitlements TO service_role;

-- A visitor needs only the plan name to determine whether the local waiter is available.
-- Unknown tenants return NULL; tenants without an explicit assignment are Starter.
CREATE OR REPLACE FUNCTION public.get_public_plan(p_slug text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE(e.plan, 'starter')
  FROM public.tenants AS t
  LEFT JOIN public.tenant_entitlements AS e ON e.tenant_id = t.id
  WHERE t.slug = lower(trim(p_slug))
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_public_plan(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_plan(text) TO anon, authenticated;

-- Serialize changes on the tenant row so concurrent branch creation cannot exceed
-- the allowance. Existing branches and all existing data are left untouched.
CREATE OR REPLACE FUNCTION public.enforce_servio_branch_limit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_limit integer;
  v_existing integer;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.tenant_id = NEW.tenant_id THEN
    RETURN NEW;
  END IF;

  PERFORM 1 FROM public.tenants WHERE id = NEW.tenant_id FOR UPDATE;
  SELECT CASE WHEN e.plan = 'pro' THEN 3 ELSE 1 END INTO v_limit
  FROM public.tenants AS t
  LEFT JOIN public.tenant_entitlements AS e ON e.tenant_id = t.id
  WHERE t.id = NEW.tenant_id;
  IF v_limit IS NULL THEN
    RAISE EXCEPTION 'Invalid tenant' USING ERRCODE = '23503';
  END IF;

  SELECT count(*) INTO v_existing FROM public.branches AS b
  WHERE b.tenant_id = NEW.tenant_id AND b.id IS DISTINCT FROM NEW.id;
  IF v_existing >= v_limit THEN
    RAISE EXCEPTION 'Branch limit reached for this plan' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_servio_branch_limit() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS servio_branch_plan_limit ON public.branches;
CREATE TRIGGER servio_branch_plan_limit
BEFORE INSERT OR UPDATE OF tenant_id ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.enforce_servio_branch_limit();
