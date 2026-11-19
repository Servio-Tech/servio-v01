-- Safe branch removal is deliberately an RPC rather than a direct table delete.
-- Existing rows are never cleaned up or cascaded by this migration.
-- notification_events originally had a branch_id but no branch FK. NOT VALID
-- leaves historical rows untouched while enforcing the reference on new writes.
DO $$
BEGIN
  IF pg_catalog.to_regclass('public.notification_events') IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS c
    JOIN pg_catalog.pg_attribute AS src ON src.attrelid = c.conrelid AND src.attname = 'branch_id' AND NOT src.attisdropped
    JOIN pg_catalog.pg_attribute AS dst ON dst.attrelid = c.confrelid AND dst.attname = 'id' AND NOT dst.attisdropped
    WHERE c.contype = 'f'
      AND c.conrelid = 'public.notification_events'::pg_catalog.regclass
      AND c.confrelid = 'public.branches'::pg_catalog.regclass
      AND c.conkey = ARRAY[src.attnum]::smallint[]
      AND c.confkey = ARRAY[dst.attnum]::smallint[]
  ) THEN
    ALTER TABLE public.notification_events
      ADD CONSTRAINT notification_events_branch_guard_fkey
      FOREIGN KEY (branch_id) REFERENCES public.branches(id) NOT VALID;
  END IF;
END;
$$;

-- Existing RLS permits an admin write policy, but no app role may delete a
-- branch directly and bypass the RPC's checks (including inherited PUBLIC grants).
REVOKE DELETE ON TABLE public.branches FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_empty_branch(p_branch_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
SET row_security = off
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_slug text;
  v_relation record;
  v_reference record;
  v_exists boolean;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR public.is_current_tenant_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'branch_unauthorized' USING ERRCODE = '42501';
  END IF;
  IF p_branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.branches AS b WHERE b.id = p_branch_id AND b.tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'branch_not_found' USING ERRCODE = 'P0001';
  END IF;
  -- A repeatable-read/serializable transaction may have a stale snapshot after
  -- waiting for other writers. Never make an emptiness decision in that case.
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'branch_isolation_unsupported' USING ERRCODE = 'P0001';
  END IF;

  -- Serialize branch inserts, moves and deletes as well as FK DDL. This protects
  -- the last-branch count. Then lock referencing tables in a deterministic order
  -- before taking the target row lock: uncommitted writers finish first and new
  -- writers wait. The row FOR UPDATE also conflicts with FK key-share checks.
  LOCK TABLE public.branches IN SHARE ROW EXCLUSIVE MODE;

  -- Reject an unprotected public branch_id, even if currently empty: otherwise
  -- a waiting insert could create an orphan immediately after this commit.
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS r
    JOIN pg_catalog.pg_namespace AS n ON n.oid = r.relnamespace
    JOIN pg_catalog.pg_attribute AS a ON a.attrelid = r.oid AND a.attname = 'branch_id' AND a.attnum > 0 AND NOT a.attisdropped
    WHERE n.nspname = 'public' AND r.relkind IN ('r', 'p', 'f')
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint AS fk
        JOIN pg_catalog.pg_attribute AS target ON target.attrelid = fk.confrelid AND target.attname = 'id' AND NOT target.attisdropped
        WHERE fk.contype = 'f' AND fk.conrelid = r.oid
          AND fk.confrelid = 'public.branches'::pg_catalog.regclass
          AND fk.conkey = ARRAY[a.attnum]::smallint[]
          AND fk.confkey = ARRAY[target.attnum]::smallint[]
      )
  ) THEN
    RAISE EXCEPTION 'branch_reference_unprotected' USING ERRCODE = 'P0001';
  END IF;

  FOR v_relation IN
    SELECT DISTINCT n.nspname, r.relname, r.oid
    FROM pg_catalog.pg_class AS r
    JOIN pg_catalog.pg_namespace AS n ON n.oid = r.relnamespace
    WHERE r.relkind IN ('r', 'p', 'f') AND (
      EXISTS (SELECT 1 FROM pg_catalog.pg_constraint AS fk
              WHERE fk.contype = 'f' AND fk.conrelid = r.oid
                AND fk.confrelid = 'public.branches'::pg_catalog.regclass)
      OR (n.nspname = 'public' AND EXISTS (
        SELECT 1 FROM pg_catalog.pg_attribute AS a
        WHERE a.attrelid = r.oid AND a.attname = 'branch_id' AND a.attnum > 0 AND NOT a.attisdropped
      ))
    )
    ORDER BY n.nspname, r.relname, r.oid
  LOOP
    EXECUTE pg_catalog.format('LOCK TABLE %I.%I IN SHARE MODE', v_relation.nspname, v_relation.relname);
  END LOOP;

  SELECT b.slug INTO v_slug
  FROM public.branches AS b
  WHERE b.id = p_branch_id AND b.tenant_id = v_tenant
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'branch_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_slug = 'main' THEN
    RAISE EXCEPTION 'branch_main' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.branches AS b WHERE b.tenant_id = v_tenant) <= 1 THEN
    RAISE EXCEPTION 'branch_last' USING ERRCODE = 'P0001';
  END IF;

  -- Check every FK to branches, including non-public tables and composite or
  -- differently named keys, regardless of ON DELETE action or tenant value.
  FOR v_reference IN
    SELECT n.nspname, r.relname,
      pg_catalog.string_agg(pg_catalog.format('child.%I = parent.%I', child.attname, parent.attname), ' AND ' ORDER BY keys.ord) AS predicate
    FROM pg_catalog.pg_constraint AS fk
    JOIN pg_catalog.pg_class AS r ON r.oid = fk.conrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = r.relnamespace
    CROSS JOIN LATERAL pg_catalog.unnest(fk.conkey) WITH ORDINALITY AS keys(child_num, ord)
    JOIN LATERAL pg_catalog.unnest(fk.confkey) WITH ORDINALITY AS target_keys(parent_num, ord) ON target_keys.ord = keys.ord
    JOIN pg_catalog.pg_attribute AS child ON child.attrelid = fk.conrelid AND child.attnum = keys.child_num
    JOIN pg_catalog.pg_attribute AS parent ON parent.attrelid = fk.confrelid AND parent.attnum = target_keys.parent_num
    WHERE fk.contype = 'f' AND fk.confrelid = 'public.branches'::pg_catalog.regclass
    GROUP BY fk.oid, n.nspname, r.relname
    ORDER BY n.nspname, r.relname, fk.oid
  LOOP
    EXECUTE pg_catalog.format(
      'SELECT EXISTS (SELECT 1 FROM %I.%I AS child JOIN public.branches AS parent ON %s WHERE parent.id = $1)',
      v_reference.nspname, v_reference.relname, v_reference.predicate
    ) INTO v_exists USING p_branch_id;
    IF v_exists THEN
      RAISE EXCEPTION 'branch_has_records' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- Also inspect every public branch_id independently: a composite FK can be
  -- NULL or contain a mismatched tenant, and historical NOT VALID rows can exist.
  FOR v_relation IN
    SELECT n.nspname, r.relname
    FROM pg_catalog.pg_class AS r
    JOIN pg_catalog.pg_namespace AS n ON n.oid = r.relnamespace
    JOIN pg_catalog.pg_attribute AS a ON a.attrelid = r.oid AND a.attname = 'branch_id' AND a.attnum > 0 AND NOT a.attisdropped
    WHERE n.nspname = 'public' AND r.relkind IN ('r', 'p', 'f')
    ORDER BY n.nspname, r.relname, r.oid
  LOOP
    EXECUTE pg_catalog.format('SELECT EXISTS (SELECT 1 FROM %I.%I WHERE branch_id = $1)', v_relation.nspname, v_relation.relname)
      INTO v_exists USING p_branch_id;
    IF v_exists THEN
      RAISE EXCEPTION 'branch_has_records' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  DELETE FROM public.branches WHERE id = p_branch_id AND tenant_id = v_tenant;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'branch_not_found' USING ERRCODE = 'P0001';
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_empty_branch(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_empty_branch(uuid) TO authenticated;
