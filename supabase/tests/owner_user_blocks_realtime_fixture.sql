-- Deliberately small PostgreSQL-only stand-in for the Supabase auth and
-- realtime.messages objects needed to exercise restrictive-policy composition.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
CREATE SCHEMA realtime;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA realtime TO authenticated;

CREATE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE FUNCTION auth.jwt()
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  banned_until timestamptz
);
CREATE TABLE auth.sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id)
);
CREATE TABLE public.platform_user_blocks (
  user_id uuid PRIMARY KEY
);
CREATE TABLE public.platform_user_session_fences (
  user_id uuid PRIMARY KEY
);

CREATE TABLE realtime.messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  topic text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON realtime.messages TO authenticated;

-- Represents an existing permissive Realtime channel policy; the new policy
-- must AND with this policy rather than dropping or replacing it.
CREATE POLICY fixture_existing_channel_select
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO auth.users(id) VALUES
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002');
INSERT INTO public.platform_user_blocks(user_id)
  VALUES ('10000000-0000-0000-0000-000000000002');
INSERT INTO realtime.messages(topic, payload) VALUES
  ('tenant:active', '{"kind":"active"}'),
  ('tenant:blocked', '{"kind":"blocked"}');
