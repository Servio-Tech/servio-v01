-- Disposable, deliberately minimal approximation: the shift table constraints
-- mirror 20261006120000, 20261021050000 and 20261024120000. Orders include the
-- fields needed by the actual latest close/refresh bodies, not the full schema.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.role',true),'') $$;
GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.tenants(id uuid PRIMARY KEY, slug text NOT NULL UNIQUE);
CREATE TABLE public.tenant_subscriptions(tenant_id uuid PRIMARY KEY REFERENCES public.tenants, starts_at timestamptz NOT NULL, ends_at timestamptz);
CREATE TABLE public.branches(id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES public.tenants,is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users,tenant_id uuid NOT NULL REFERENCES public.tenants,role text NOT NULL CHECK(role IN ('admin','cashier')));
CREATE TABLE public.cashiers(id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES public.tenants,branch_id uuid NOT NULL REFERENCES public.branches,auth_user_id uuid UNIQUE,is_active boolean NOT NULL DEFAULT true,full_name text NOT NULL,username text NOT NULL);
CREATE TABLE public.cashier_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants ON DELETE CASCADE,
 cashier_id uuid NOT NULL REFERENCES public.cashiers ON DELETE RESTRICT,
 auth_user_id uuid REFERENCES auth.users ON DELETE SET NULL,
 opened_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
 opening_cash numeric(12,2) NOT NULL DEFAULT 0 CHECK(opening_cash>=0),
 closing_cash numeric(12,2), total_sales numeric(12,2) NOT NULL DEFAULT 0,
 cash_sales numeric(12,2) NOT NULL DEFAULT 0, card_sales numeric(12,2) NOT NULL DEFAULT 0,
 wallet_sales numeric(12,2) NOT NULL DEFAULT 0, transfer_sales numeric(12,2) NOT NULL DEFAULT 0,
 other_sales numeric(12,2) NOT NULL DEFAULT 0, notes text, created_at timestamptz NOT NULL DEFAULT now(),
 branch_id uuid NOT NULL REFERENCES public.branches ON DELETE RESTRICT,
 CHECK ((status='open' AND closed_at IS NULL AND closing_cash IS NULL) OR (status='closed' AND closed_at IS NOT NULL AND closing_cash IS NOT NULL))
);
CREATE UNIQUE INDEX cashier_sessions_one_open_per_cashier ON public.cashier_sessions(cashier_id) WHERE status='open';
CREATE TABLE public.orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants,
 branch_id uuid NOT NULL REFERENCES public.branches, cashier_session_id uuid REFERENCES public.cashier_sessions ON DELETE SET NULL,
 status text, payment_status text, total_price numeric, payment_method text, cash_amount numeric,card_amount numeric,
 is_completed boolean DEFAULT false,completed_at timestamptz);
ALTER TABLE public.cashier_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
-- Model wide deployment grants and also PUBLIC inheritance and column grants.
GRANT ALL ON public.cashier_sessions TO PUBLIC,anon,authenticated;
GRANT UPDATE(total_sales),INSERT(notes),REFERENCES(id) ON public.cashier_sessions TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.orders TO authenticated;
-- Additional permissive writes verify that restrictive policies still block them.
CREATE POLICY fixture_other_insert ON public.cashier_sessions FOR INSERT TO authenticated WITH CHECK(true);
CREATE POLICY fixture_other_update ON public.cashier_sessions FOR UPDATE TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY fixture_other_delete ON public.cashier_sessions FOR DELETE TO authenticated USING(true);
-- Definer helpers and real function bodies are extracted from migrations by the runner.
