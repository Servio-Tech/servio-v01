-- Test-only extensions to the existing isolated subscription fixtures.
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)
$$;
-- The neighboring account-deletion migration installs a shift guard. None of
-- the subscription tests needs shift rows, but the relation must exist.
CREATE TABLE public.cashier_sessions(id uuid PRIMARY KEY, cashier_id uuid, status text);
