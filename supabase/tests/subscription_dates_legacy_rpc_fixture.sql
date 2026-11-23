-- Disposable-only simulation of a restored database whose stored SQL RPCs still
-- reference the removed helper. check_function_bodies is disabled solely so the
-- fixture can reproduce that pre-existing catalog state; the migration under
-- test must rewrite the copied private bodies to the current subscription gate.
SET check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_public_categories(p_slug text)
RETURNS SETOF public.categories
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT c.* FROM public.categories AS c
  JOIN public.tenants AS t ON t.id = c.tenant_id
  WHERE t.slug = lower(trim(p_slug))
    AND public.is_public_tenant_active(t.id)
$$;

CREATE OR REPLACE FUNCTION public.get_public_menu_items(p_slug text)
RETURNS SETOF public.menu_items
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT m.* FROM public.menu_items AS m
  JOIN public.tenants AS t ON t.id = m.tenant_id
  WHERE t.slug = lower(trim(p_slug))
    AND public.is_public_tenant_active(t.id)
$$;

CREATE OR REPLACE FUNCTION public.get_public_tables(p_slug text)
RETURNS SETOF public."table"
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT tb.* FROM public."table" AS tb
  JOIN public.tenants AS t ON t.id = tb.tenant_id
  WHERE t.slug = lower(trim(p_slug))
    AND public.is_public_tenant_active(t.id)
$$;

RESET check_function_bodies;
