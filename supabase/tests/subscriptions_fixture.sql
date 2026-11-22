-- Minimal isolated approximation of the relevant pre-migration schema, not production.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb);
CREATE TABLE public.tenants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, slug text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 120), slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, slug)
);
CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id), tenant_id uuid NOT NULL REFERENCES public.tenants(id), full_name text, role text NOT NULL CHECK(role IN ('admin','cashier')), created_at timestamptz DEFAULT now(), phone text);
CREATE TABLE public.cashiers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id), branch_id uuid NOT NULL REFERENCES public.branches(id), auth_user_id uuid UNIQUE, full_name text NOT NULL, is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.store (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id), store_name text, store_slug text, phone text, email text, currency text);
CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid() AND (p.role = 'admin' OR EXISTS
    (SELECT 1 FROM public.cashiers c WHERE c.auth_user_id=p.id AND c.tenant_id=p.tenant_id AND c.is_active)) LIMIT 1
$$;
CREATE FUNCTION public.is_current_tenant_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin')
$$;
CREATE FUNCTION public.resolve_branch_id(p_tenant_slug text, p_branch_slug text DEFAULT NULL)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id FROM public.branches b JOIN public.tenants t ON t.id=b.tenant_id
  WHERE t.slug=lower(trim(p_tenant_slug)) AND b.is_active AND (p_branch_slug IS NULL OR b.slug=lower(trim(p_branch_slug)))
  ORDER BY (b.slug='main') DESC,b.created_at LIMIT 1
$$;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.branches TO authenticated;
CREATE POLICY branches_select ON public.branches FOR SELECT TO authenticated USING (tenant_id=public.current_tenant_id());
CREATE POLICY branches_admin_write ON public.branches FOR ALL TO authenticated USING (tenant_id=public.current_tenant_id() AND public.is_current_tenant_admin()) WITH CHECK (tenant_id=public.current_tenant_id() AND public.is_current_tenant_admin());
INSERT INTO public.tenants(id,name,slug) VALUES
 ('00000000-0000-0000-0000-000000000001','Starter tenant','starter'),
 ('00000000-0000-0000-0000-000000000002','Pro tenant','pro'),
 ('00000000-0000-0000-0000-000000000003','Old tenant','old'),
 ('00000000-0000-0000-0000-000000000004','Missing branch','missing'),
 ('00000000-0000-0000-0000-000000000005','Alternative branch','alternative');
INSERT INTO public.branches(tenant_id,name,slug,is_active) VALUES
 ('00000000-0000-0000-0000-000000000001','Main','main',true),
 ('00000000-0000-0000-0000-000000000002','Main','main',true),
 ('00000000-0000-0000-0000-000000000002','Second','second',true),
 ('00000000-0000-0000-0000-000000000003','Main','main',true),
 ('00000000-0000-0000-0000-000000000003','Second','second',true),
 ('00000000-0000-0000-0000-000000000003','Third','third',false),
 ('00000000-0000-0000-0000-000000000003','Fourth','fourth',true),
 ('00000000-0000-0000-0000-000000000005','Other','other',true);
INSERT INTO auth.users VALUES
 ('10000000-0000-0000-0000-000000000001','manager@example.test',now(),'{}'),
 ('10000000-0000-0000-0000-000000000002','serviotech.sa@gmail.com',now(),'{}'),
 ('10000000-0000-0000-0000-000000000003','attacker@example.test',now(),'{"tenant_id":"00000000-0000-0000-0000-000000000001","role":"admin"}'),
 ('10000000-0000-0000-0000-000000000004','cashier@example.test',now(),'{"tenant_id":"00000000-0000-0000-0000-000000000003","role":"admin"}'),
 ('10000000-0000-0000-0000-000000000005','new@example.test',now(),'{"tenant_id":"00000000-0000-0000-0000-000000000001","role":"cashier","store_name":"New Restaurant","store_slug":"new-restaurant"}');
INSERT INTO public.profiles(id,tenant_id,full_name,role) VALUES ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Manager','admin');
INSERT INTO public.cashiers(tenant_id,branch_id,auth_user_id,full_name) SELECT tenant_id,id,'10000000-0000-0000-0000-000000000004','Cashier' FROM public.branches WHERE tenant_id='00000000-0000-0000-0000-000000000002' AND slug='main';
