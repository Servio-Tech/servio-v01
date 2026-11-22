-- Disposable, deliberately minimal schema for order/RPC integration; no live data.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA public,auth,extensions TO anon,authenticated,service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.role',true),'') $$;
CREATE TABLE public.tenants(id uuid PRIMARY KEY,slug text UNIQUE NOT NULL);
CREATE TABLE public.tenant_subscriptions(tenant_id uuid PRIMARY KEY,starts_at timestamptz NOT NULL,ends_at timestamptz);
CREATE TABLE public.profiles(id uuid PRIMARY KEY,tenant_id uuid);
CREATE TABLE public.cashiers(auth_user_id uuid,tenant_id uuid);
CREATE TABLE public.branches(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,slug text,is_active boolean,created_at timestamptz DEFAULT now());
CREATE TABLE public.menu_items(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,branch_id uuid NOT NULL,name text,price numeric,category_id text,available boolean,addon_options text[],free_addon_item_ids uuid[],max_addons smallint);
CREATE TABLE public.menu_ingredients(id uuid PRIMARY KEY,tenant_id uuid,available boolean);
CREATE TABLE public.menu_item_ingredients(menu_item_id uuid,ingredient_id uuid,tenant_id uuid);
CREATE TABLE public."table"(tenant_id uuid,branch_id uuid,table_number text);
CREATE TABLE public.orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,branch_id uuid NOT NULL,items jsonb NOT NULL DEFAULT '[]',total_price numeric(12,2) NOT NULL DEFAULT 0,table_number text NOT NULL DEFAULT 'غير محدد',notes text,status text NOT NULL DEFAULT 'pending',is_completed boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,tracking_token_hash text,payment_status text DEFAULT 'unpaid',payment_method text,cash_amount numeric,card_amount numeric);
CREATE TABLE public.waiter_calls(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,branch_id uuid NOT NULL,table_number text,reason text,is_resolved boolean);
CREATE TABLE public.feedbacks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,branch_id uuid NOT NULL,table_number text,rating numeric,tags text[],comment text);
CREATE FUNCTION public.resolve_branch_id(p_tenant_slug text,p_branch_slug text DEFAULT NULL) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT b.id FROM public.branches b JOIN public.tenants t ON t.id=b.tenant_id
 WHERE t.slug=lower(trim(p_tenant_slug)) AND b.is_active AND (p_branch_slug IS NULL OR b.slug=lower(trim(p_branch_slug)))
 ORDER BY (b.slug='main') DESC,b.created_at LIMIT 1 $$;
REVOKE ALL ON FUNCTION public.resolve_branch_id(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_branch_id(text,text) TO anon,authenticated;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.orders TO authenticated;
CREATE POLICY staff_fixture_orders ON public.orders FOR ALL TO authenticated USING (tenant_id='00000000-0000-0000-0000-000000000001') WITH CHECK (tenant_id='00000000-0000-0000-0000-000000000001');
ALTER TABLE public.waiter_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
INSERT INTO public.tenants VALUES ('00000000-0000-0000-0000-000000000001','alpha'),('00000000-0000-0000-0000-000000000002','beta');
INSERT INTO public.tenant_subscriptions VALUES ('00000000-0000-0000-0000-000000000001',now()-interval '1 day',NULL),('00000000-0000-0000-0000-000000000002',now()-interval '2 days',now()-interval '1 day');
INSERT INTO public.profiles VALUES ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');
INSERT INTO public.branches(id,tenant_id,slug,is_active) VALUES
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','main',true),
 ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','second',true),
 ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','main',true);
INSERT INTO public.menu_items VALUES
 ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','قهوة',7.25,'40000000-0000-0000-0000-000000000001',true,ARRAY['حليب','عسل'],ARRAY['30000000-0000-0000-0000-000000000002'::uuid,'30000000-0000-0000-0000-000000000003'::uuid],4),
 ('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','حليب شوفان',2,'all',true,ARRAY[]::text[],ARRAY[]::uuid[],0),
 ('30000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','مكمل فرع آخر',4,'all',true,ARRAY[]::text[],ARRAY[]::uuid[],0),
 ('30000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','صنف خارجي',9,'all',true,ARRAY[]::text[],ARRAY[]::uuid[],0),
 ('30000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','دقيق السعر',1.234,'all',true,ARRAY[]::text[],ARRAY[]::uuid[],0);
INSERT INTO public."table" VALUES ('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','1');
CREATE TABLE public.test_result(label text PRIMARY KEY,result jsonb);
GRANT ALL ON public.test_result TO anon,authenticated;
-- A pre-existing historical snapshot: it must not be rewritten by migration or
-- by later status/payment changes. Inserted before any test triggers exist.
INSERT INTO public.orders(id,tenant_id,branch_id,items,total_price,table_number)
VALUES ('90000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
 '[{"id":"30000000-0000-0000-0000-000000000001","name":"historical label","category_id":"historical category","quantity":1,"price":7.25,"image":"old image"}]', 7.25, '1');
