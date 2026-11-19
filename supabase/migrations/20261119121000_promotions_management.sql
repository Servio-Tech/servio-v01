-- Promotions are managed only by a tenant admin through the RPCs below.
-- Tenant admins in the existing app may manage every branch of their own tenant.
CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  title_ar text NOT NULL DEFAULT '',
  title_en text NOT NULL DEFAULT '',
  description_ar text NOT NULL DEFAULT '',
  description_en text NOT NULL DEFAULT '',
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric(12, 2) NOT NULL CHECK (discount_value > 0 AND (discount_type <> 'percentage' OR discount_value <= 100)),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(btrim(title_ar)) > 0 OR length(btrim(title_en)) > 0),
  CHECK (length(title_ar) <= 120 AND length(title_en) <= 120),
  CHECK (length(description_ar) <= 2000 AND length(description_en) <= 2000),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE public.promotion_items (
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, menu_item_id)
);

CREATE INDEX promotions_scope_idx ON public.promotions (tenant_id, branch_id, created_at DESC);
CREATE INDEX promotion_items_menu_item_idx ON public.promotion_items (menu_item_id);
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_items ENABLE ROW LEVEL SECURITY;
-- No direct table privileges or permissive policies: reads/writes use purpose-built RPCs.
REVOKE ALL ON TABLE public.promotions, public.promotion_items FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.get_branch_promotions(p_branch_id uuid)
RETURNS TABLE (
  id uuid, title_ar text, title_en text, description_ar text, description_en text,
  target_item_ids uuid[], discount_type text, discount_value numeric,
  starts_at timestamptz, ends_at timestamptz, is_active boolean, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tenant uuid := public.current_tenant_id();
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR NOT public.is_current_tenant_admin() THEN
    RAISE EXCEPTION 'Manager role required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id = p_branch_id AND b.tenant_id = v_tenant AND b.is_active) THEN
    RAISE EXCEPTION 'Active branch not found' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.title_ar, p.title_en, p.description_ar, p.description_en,
      ARRAY(SELECT pi.menu_item_id FROM public.promotion_items pi
        JOIN public.menu_items m ON m.id = pi.menu_item_id AND m.tenant_id = p.tenant_id AND m.branch_id = p.branch_id
        WHERE pi.promotion_id = p.id ORDER BY pi.menu_item_id),
      p.discount_type, p.discount_value, p.starts_at, p.ends_at, p.is_active, p.created_at
    FROM public.promotions p
    WHERE p.tenant_id = v_tenant AND p.branch_id = p_branch_id
    ORDER BY p.created_at DESC, p.id;
END;
$$;

-- Replaces the complete set of item links in the same transaction as the offer.
CREATE FUNCTION public.save_branch_promotion(
  p_id uuid, p_branch_id uuid, p_title_ar text, p_title_en text,
  p_description_ar text, p_description_en text, p_discount_type text,
  p_discount_value numeric, p_starts_at timestamptz, p_ends_at timestamptz,
  p_is_active boolean, p_target_item_ids uuid[]
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tenant uuid := public.current_tenant_id(); v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR NOT public.is_current_tenant_admin() THEN
    RAISE EXCEPTION 'Manager role required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id = p_branch_id AND b.tenant_id = v_tenant AND b.is_active) THEN
    RAISE EXCEPTION 'Active branch not found' USING ERRCODE = '42501';
  END IF;
  IF p_target_item_ids IS NULL OR cardinality(p_target_item_ids) = 0
     OR cardinality(p_target_item_ids) > 500
     OR EXISTS (SELECT 1 FROM unnest(p_target_item_ids) x(id) WHERE x.id IS NULL)
     OR cardinality(p_target_item_ids) <> (SELECT count(DISTINCT x.id) FROM unnest(p_target_item_ids) x(id))
     OR EXISTS (
       SELECT 1 FROM unnest(p_target_item_ids) x(id)
       WHERE NOT EXISTS (SELECT 1 FROM public.menu_items m WHERE m.id = x.id AND m.tenant_id = v_tenant AND m.branch_id = p_branch_id)
     ) THEN
    RAISE EXCEPTION 'Select valid items from this branch' USING ERRCODE = '22023';
  END IF;
  IF p_discount_type NOT IN ('percentage', 'fixed') OR p_discount_type IS NULL
     OR p_discount_value IS NULL OR p_discount_value <= 0 OR p_discount_value > 9999999999.99
     OR p_discount_value <> round(p_discount_value, 2)
     OR (p_discount_type = 'percentage' AND p_discount_value > 100)
     OR p_is_active IS NULL THEN
    RAISE EXCEPTION 'Invalid discount' USING ERRCODE = '22023';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.promotions (tenant_id, branch_id, title_ar, title_en, description_ar, description_en,
      discount_type, discount_value, starts_at, ends_at, is_active)
    VALUES (v_tenant, p_branch_id, btrim(coalesce(p_title_ar, '')), btrim(coalesce(p_title_en, '')),
      btrim(coalesce(p_description_ar, '')), btrim(coalesce(p_description_en, '')),
      p_discount_type, p_discount_value, p_starts_at, p_ends_at, p_is_active)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.promotions p SET title_ar = btrim(coalesce(p_title_ar, '')), title_en = btrim(coalesce(p_title_en, '')),
      description_ar = btrim(coalesce(p_description_ar, '')), description_en = btrim(coalesce(p_description_en, '')),
      discount_type = p_discount_type, discount_value = p_discount_value, starts_at = p_starts_at,
      ends_at = p_ends_at, is_active = p_is_active, updated_at = now()
    WHERE p.id = p_id AND p.tenant_id = v_tenant AND p.branch_id = p_branch_id
    RETURNING p.id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Promotion not found in this branch' USING ERRCODE = '42501'; END IF;
    DELETE FROM public.promotion_items pi WHERE pi.promotion_id = v_id;
  END IF;
  INSERT INTO public.promotion_items (promotion_id, menu_item_id)
    SELECT v_id, x.id FROM unnest(p_target_item_ids) x(id);
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.set_branch_promotion_active(p_id uuid, p_branch_id uuid, p_is_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tenant uuid := public.current_tenant_id();
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR NOT public.is_current_tenant_admin() OR p_is_active IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id = p_branch_id AND b.tenant_id = v_tenant AND b.is_active) THEN
    RAISE EXCEPTION 'Manager and active branch required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.promotions p SET is_active = p_is_active, updated_at = now()
    WHERE p.id = p_id AND p.tenant_id = v_tenant AND p.branch_id = p_branch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Promotion not found in this branch' USING ERRCODE = '42501'; END IF;
END;
$$;

CREATE FUNCTION public.delete_branch_promotion(p_id uuid, p_branch_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tenant uuid := public.current_tenant_id();
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR NOT public.is_current_tenant_admin()
     OR NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id = p_branch_id AND b.tenant_id = v_tenant AND b.is_active) THEN
    RAISE EXCEPTION 'Manager and active branch required' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.promotions p WHERE p.id = p_id AND p.tenant_id = v_tenant AND p.branch_id = p_branch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Promotion not found in this branch' USING ERRCODE = '42501'; END IF;
END;
$$;

-- Public callers can only see the explicit offer fields and currently orderable targets.
-- A missing/deleted/unavailable target is never exposed; an offer with no visible targets is omitted.
CREATE FUNCTION public.get_active_promotions(p_tenant_id uuid, p_branch_id uuid)
RETURNS TABLE (
  id uuid, title_ar text, title_en text, description_ar text, description_en text,
  target_item_ids uuid[], discount_type text, discount_value numeric,
  starts_at timestamptz, ends_at timestamptz, is_active boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id, p.title_ar, p.title_en, p.description_ar, p.description_en,
    targets.item_ids, p.discount_type, p.discount_value, p.starts_at, p.ends_at, p.is_active
  FROM public.promotions p
  JOIN public.branches b ON b.id = p.branch_id AND b.tenant_id = p.tenant_id AND b.is_active
  CROSS JOIN LATERAL (
    SELECT array_agg(m.id ORDER BY m.id) AS item_ids
    FROM public.promotion_items pi
    JOIN public.menu_items m ON m.id = pi.menu_item_id AND m.tenant_id = p.tenant_id AND m.branch_id = p.branch_id
    WHERE pi.promotion_id = p.id AND m.available IS TRUE
      AND NOT EXISTS (
        SELECT 1 FROM public.menu_item_ingredients rel
        LEFT JOIN public.menu_ingredients ingredient ON ingredient.id = rel.ingredient_id
          AND ingredient.tenant_id = rel.tenant_id AND ingredient.branch_id = rel.branch_id
        WHERE rel.menu_item_id = m.id
          AND (rel.tenant_id IS DISTINCT FROM m.tenant_id OR rel.branch_id IS DISTINCT FROM m.branch_id
            OR ingredient.id IS NULL OR ingredient.available IS NOT TRUE)
      )
  ) targets
  WHERE p.tenant_id = p_tenant_id AND p.branch_id = p_branch_id
    AND p.is_active IS TRUE
    AND (p.starts_at IS NULL OR p.starts_at <= now())
    AND (p.ends_at IS NULL OR p.ends_at > now())
    AND cardinality(targets.item_ids) > 0
  ORDER BY p.created_at DESC, p.id;
$$;

REVOKE ALL ON FUNCTION public.get_branch_promotions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_branch_promotion(uuid,uuid,text,text,text,text,text,numeric,timestamptz,timestamptz,boolean,uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_branch_promotion_active(uuid,uuid,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_branch_promotion(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_active_promotions(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_branch_promotions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_branch_promotion(uuid,uuid,text,text,text,text,text,numeric,timestamptz,timestamptz,boolean,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_branch_promotion_active(uuid,uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_branch_promotion(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_promotions(uuid,uuid) TO anon, authenticated;
