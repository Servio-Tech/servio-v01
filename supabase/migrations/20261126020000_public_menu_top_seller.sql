CREATE OR REPLACE FUNCTION public.get_public_menu_top_seller(p_slug text, p_branch_slug text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH target_branch AS (
    SELECT branch.id, branch.tenant_id
    FROM public.branches AS branch
    WHERE branch.id = public.resolve_branch_id(p_slug, p_branch_slug)
  ),
  sold_items AS (
    SELECT
      CASE
        WHEN order_item.value->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (order_item.value->>'id')::uuid
        WHEN order_item.value->>'cartItemId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (order_item.value->>'cartItemId')::uuid
        ELSE NULL
      END AS menu_item_id,
      CASE
        WHEN order_item.value->>'quantity' ~ '^[0-9]+([.][0-9]+)?$'
          THEN CASE
            WHEN (order_item.value->>'quantity')::numeric > 0
              THEN (order_item.value->>'quantity')::numeric
            ELSE 1::numeric
          END
        ELSE 1::numeric
      END AS quantity,
      CASE
        WHEN order_item.value->>'price' ~ '^[0-9]+([.][0-9]+)?$'
          THEN (order_item.value->>'price')::numeric
        ELSE 0::numeric
      END AS price
    FROM public.orders AS order_row
    JOIN target_branch
      ON target_branch.id = order_row.branch_id
      AND target_branch.tenant_id = order_row.tenant_id
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
      CASE
        WHEN pg_catalog.jsonb_typeof(order_row.items) = 'array' THEN order_row.items
        ELSE '[]'::jsonb
      END
    ) AS order_item(value)
    WHERE order_row.status IN ('ready', 'served', 'unclaimed')
      AND COALESCE(order_row.payment_status, 'unpaid') = 'paid'
  ),
  totals AS (
    SELECT
      menu_item_id,
      pg_catalog.sum(quantity) AS quantity,
      pg_catalog.round(pg_catalog.sum(quantity * price), 2) AS revenue
    FROM sold_items
    WHERE menu_item_id IS NOT NULL
    GROUP BY menu_item_id
  )
  SELECT item.id
  FROM totals
  JOIN public.menu_items AS item ON item.id = totals.menu_item_id
  JOIN public.branches AS owner_branch
    ON owner_branch.id = item.branch_id
    AND owner_branch.tenant_id = item.tenant_id
  WHERE owner_branch.id = (SELECT id FROM target_branch)
    AND owner_branch.tenant_id = (SELECT tenant_id FROM target_branch)
    AND item.available IS TRUE
    AND NOT EXISTS (
      SELECT 1
      FROM public.menu_item_ingredients AS relation
      LEFT JOIN public.menu_ingredients AS ingredient
        ON ingredient.id = relation.ingredient_id
        AND ingredient.tenant_id = relation.tenant_id
        AND ingredient.branch_id = relation.branch_id
      WHERE relation.menu_item_id = item.id
        AND (
          relation.tenant_id IS DISTINCT FROM item.tenant_id
          OR relation.branch_id IS DISTINCT FROM item.branch_id
          OR ingredient.id IS NULL
          OR ingredient.available IS NOT TRUE
        )
    )
  -- Keep the manager report's order: quantity sold, revenue, then item name.
  ORDER BY totals.quantity DESC, totals.revenue DESC, item.name ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_menu_top_seller(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_menu_top_seller(text, text) TO anon, authenticated;
