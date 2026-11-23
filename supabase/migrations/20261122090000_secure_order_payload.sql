-- Canonicalise display/routing labels on INSERT and when staff edit items.
-- Both public order RPCs eventually insert into orders (including the
-- subscription-private wrappers), as do staff clients. Do not change pricing,
-- totals, quantities, discounts, payment fields, notes, or add-on rules.
-- Historical rows are not backfilled; status/payment-only and no-op item
-- updates retain their existing snapshots. An actual item edit refreshes labels
-- for the whole edited payload from the current menu. Existing validation
-- triggers remain authoritative.
BEGIN;

CREATE OR REPLACE FUNCTION public.canonicalize_new_order_labels()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_line jsonb;
  v_addon jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_addons jsonb;
  v_item public.menu_items%ROWTYPE;
  v_addon_name text;
  v_id text;
BEGIN
  -- The earlier compaction trigger can remove legacy image/metadata fields
  -- even on a no-op UPDATE; compare to its compacted historical snapshot.
  IF TG_OP = 'UPDATE' AND NEW.items IS NOT DISTINCT FROM public.compact_order_items_payload(OLD.items) THEN
    RETURN NEW;
  END IF;
  -- Existing validation triggers reject malformed input; do not silently fix it.
  IF pg_catalog.jsonb_typeof(NEW.items) IS DISTINCT FROM 'array' THEN
    RETURN NEW;
  END IF;

  FOR v_line IN SELECT value FROM pg_catalog.jsonb_array_elements(NEW.items) WITH ORDINALITY AS x(value, n) ORDER BY n
  LOOP
    IF pg_catalog.jsonb_typeof(v_line) = 'object' THEN
      v_id := COALESCE(NULLIF(v_line ->> 'id', ''), NULLIF(v_line ->> 'menu_item_id', ''));
      -- The earlier availability trigger has already validated UUIDs on INSERT.
      SELECT mi.* INTO v_item FROM public.menu_items mi
      WHERE mi.id = v_id::uuid AND mi.tenant_id = NEW.tenant_id AND mi.branch_id = NEW.branch_id
      LIMIT 1;
      IF FOUND THEN
        v_line := pg_catalog.jsonb_set(v_line, '{name}', COALESCE(pg_catalog.to_jsonb(v_item.name), 'null'::jsonb), true);
        -- The printing code falls back to categoryId, so discard that alias too.
        v_line := pg_catalog.jsonb_set(v_line - 'categoryId', '{category_id}', COALESCE(pg_catalog.to_jsonb(v_item.category_id), 'null'::jsonb), true);
        IF pg_catalog.jsonb_typeof(v_line -> 'selected_addons') = 'array' THEN
          v_addons := '[]'::jsonb;
          FOR v_addon IN SELECT value FROM pg_catalog.jsonb_array_elements(v_line -> 'selected_addons') WITH ORDINALITY AS x(value, n) ORDER BY n
          LOOP
            IF pg_catalog.jsonb_typeof(v_addon) = 'object' THEN
              v_id := COALESCE(NULLIF(v_addon ->> 'id', ''), NULLIF(v_addon ->> 'menu_item_id', ''));
              v_addon_name := NULL;
              IF v_id IS NOT NULL THEN
                -- Exactly the same tenant scope as the existing add-on validator.
                SELECT mi.name INTO v_addon_name FROM public.menu_items mi
                WHERE mi.id = v_id::uuid AND mi.tenant_id = NEW.tenant_id LIMIT 1;
              ELSE
                SELECT opt.name INTO v_addon_name
                FROM pg_catalog.unnest(COALESCE(v_item.addon_options, ARRAY[]::text[])) WITH ORDINALITY AS opt(name, n)
                WHERE pg_catalog.lower(pg_catalog.btrim(opt.name)) = pg_catalog.lower(pg_catalog.btrim(v_addon ->> 'name'))
                ORDER BY opt.n LIMIT 1;
              END IF;
              -- Do not preserve client-supplied labels when the authoritative
              -- name is NULL (or ceases to exist between validation and lookup).
              v_addon := pg_catalog.jsonb_set(v_addon, '{name}', COALESCE(pg_catalog.to_jsonb(v_addon_name), 'null'::jsonb), true);
            END IF;
            v_addons := v_addons || pg_catalog.jsonb_build_array(v_addon);
          END LOOP;
          v_line := pg_catalog.jsonb_set(v_line, '{selected_addons}', v_addons, true);
        END IF;
      END IF;
    END IF;
    v_lines := v_lines || pg_catalog.jsonb_build_array(v_line);
  END LOOP;
  NEW.items := v_lines;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.canonicalize_new_order_labels() FROM PUBLIC, anon, authenticated, service_role;

-- Trigger names order alphabetically: compaction, availability/add-on validation,
-- canonicalisation, pricing. Only an UPDATE that explicitly changes items can
-- refresh historical labels; status/payment-only updates never invoke this.
DROP TRIGGER IF EXISTS orders_secure_insert_item_labels ON public.orders;
CREATE TRIGGER orders_secure_insert_item_labels
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.canonicalize_new_order_labels();
DROP TRIGGER IF EXISTS orders_secure_update_item_labels ON public.orders;
CREATE TRIGGER orders_secure_update_item_labels
  BEFORE UPDATE OF items ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.canonicalize_new_order_labels();

COMMIT;
