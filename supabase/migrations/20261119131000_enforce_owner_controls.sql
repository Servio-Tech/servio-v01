-- Server-side enforcement for the owner control plane.
-- Apply only after 20261119130000_owner_control_plane.sql in isolated staging.

CREATE OR REPLACE FUNCTION public.is_public_tenant_active(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenants AS t
    LEFT JOIN public.tenant_controls AS c ON c.tenant_id = t.id
    WHERE t.id = p_tenant_id
      AND COALESCE(c.status, 'active') = 'active'
      AND (c.plan_expires_at IS NULL OR c.plan_expires_at > now())
  )
$$;

REVOKE ALL ON FUNCTION public.is_public_tenant_active(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_active_tenant_for_order()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_public_tenant_active(NEW.tenant_id) THEN
    RAISE EXCEPTION 'TENANT_NOT_ACTIVE' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_active_tenant_for_order() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS orders_owner_control_guard ON public.orders;
CREATE TRIGGER orders_owner_control_guard
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_active_tenant_for_order();

CREATE OR REPLACE FUNCTION public.get_public_tenant(p_slug text)
RETURNS SETOF public.tenants
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.*
  FROM public.tenants AS t
  WHERE t.slug = lower(trim(p_slug))
    AND public.is_public_tenant_active(t.id)
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_public_store(p_slug text)
RETURNS SETOF public.store
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.*
  FROM public.store AS s
  JOIN public.tenants AS t ON t.id = s.tenant_id
  WHERE t.slug = lower(trim(p_slug))
    AND public.is_public_tenant_active(t.id)
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_public_categories(p_slug text)
RETURNS SETOF public.categories
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.*
  FROM public.categories AS c
  JOIN public.tenants AS t ON t.id = c.tenant_id
  WHERE t.slug = lower(trim(p_slug))
    AND public.is_public_tenant_active(t.id)
$$;

CREATE OR REPLACE FUNCTION public.get_public_menu_items(p_slug text)
RETURNS SETOF public.menu_items
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.*
  FROM public.menu_items AS m
  JOIN public.tenants AS t ON t.id = m.tenant_id
  WHERE t.slug = lower(trim(p_slug))
    AND public.is_public_tenant_active(t.id)
$$;

CREATE OR REPLACE FUNCTION public.get_public_tables(p_slug text)
RETURNS SETOF public."table"
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT tb.*
  FROM public."table" AS tb
  JOIN public.tenants AS t ON t.id = tb.tenant_id
  WHERE t.slug = lower(trim(p_slug))
    AND public.is_public_tenant_active(t.id)
$$;

CREATE OR REPLACE FUNCTION public.get_public_plan(p_slug text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT CASE
    WHEN COALESCE(c.status, 'active') = 'active'
      AND (c.plan_expires_at IS NULL OR c.plan_expires_at > now())
    THEN COALESCE(e.plan, c.plan, 'starter')
    ELSE 'starter'
  END
  FROM public.tenants AS t
  LEFT JOIN public.tenant_entitlements AS e ON e.tenant_id = t.id
  LEFT JOIN public.tenant_controls AS c ON c.tenant_id = t.id
  WHERE t.slug = lower(trim(p_slug))
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_public_plan(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_plan(text) TO anon, authenticated;
