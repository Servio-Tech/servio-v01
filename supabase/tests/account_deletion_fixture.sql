CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA auth,public,storage TO anon,authenticated,service_role;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz, banned_until timestamptz);
CREATE TABLE auth.sessions(id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users ON DELETE CASCADE);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claims',true),'')::jsonb $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT auth.jwt()->>'role' $$;
CREATE TABLE public.tenants(id uuid PRIMARY KEY,name text,slug text);
CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,tenant_id uuid NOT NULL REFERENCES public.tenants ON DELETE CASCADE,role text NOT NULL);
CREATE TABLE public.profile_history(id uuid PRIMARY KEY,profile_id uuid REFERENCES public.profiles ON DELETE SET NULL);
CREATE TABLE public.tenant_subscriptions(tenant_id uuid PRIMARY KEY REFERENCES public.tenants ON DELETE CASCADE,plan text,starts_at timestamptz,ends_at timestamptz);
CREATE TABLE public.branches(id uuid PRIMARY KEY,tenant_id uuid REFERENCES public.tenants ON DELETE CASCADE);
CREATE TABLE public.cashiers(id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES public.tenants ON DELETE CASCADE,full_name text NOT NULL,auth_user_id uuid UNIQUE,is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.cashier_sessions(id uuid PRIMARY KEY,cashier_id uuid NOT NULL REFERENCES public.cashiers ON DELETE RESTRICT,auth_user_id uuid REFERENCES auth.users ON DELETE SET NULL,status text NOT NULL);
CREATE TABLE public.notification_subscriptions(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE);
CREATE TABLE public.notification_deliveries(id uuid PRIMARY KEY,subscription_id uuid REFERENCES public.notification_subscriptions ON DELETE CASCADE,status text);
CREATE TABLE storage.objects(id uuid PRIMARY KEY,owner_id text);
CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT p.tenant_id FROM public.profiles p WHERE p.id=auth.uid() LIMIT 1 $$;
CREATE FUNCTION public.is_current_tenant_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin') $$;
REVOKE ALL ON FUNCTION public.current_tenant_id(), public.is_current_tenant_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.current_tenant_id(), public.is_current_tenant_admin() TO authenticated;
INSERT INTO auth.users VALUES
 ('00000000-0000-0000-0000-000000000001','serviotech.sa@gmail.com',now(),null),
 ('10000000-0000-0000-0000-000000000001','admin1@example.test',now(),null),
 ('10000000-0000-0000-0000-000000000002','admin2@example.test',now(),null),
 ('10000000-0000-0000-0000-000000000003','soleadmin@example.test',now(),null),
 ('20000000-0000-0000-0000-000000000001','cashier1@example.test',now(),null),
 ('20000000-0000-0000-0000-000000000002','cashier2@example.test',now(),null),
 ('20000000-0000-0000-0000-000000000003','cashier3@example.test',now(),null),
 ('30000000-0000-0000-0000-000000000001','unlinked@example.test',now(),null),
 ('30000000-0000-0000-0000-000000000002','notify@example.test',now(),null);
INSERT INTO public.tenants VALUES ('40000000-0000-0000-0000-000000000001','Tenant 1','one'),('40000000-0000-0000-0000-000000000002','Tenant 2','two');
INSERT INTO public.profiles VALUES
 ('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','admin'),
 ('10000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','admin'),
 ('10000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000002','admin'),
 ('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','cashier'),
 ('20000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','cashier'),
 ('20000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000002','cashier');
INSERT INTO public.tenant_subscriptions VALUES ('40000000-0000-0000-0000-000000000001','starter',now()-interval '1 day',null),('40000000-0000-0000-0000-000000000002','starter',now()-interval '1 day',null);
INSERT INTO public.branches VALUES ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001'),('50000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002');
INSERT INTO public.cashiers VALUES
 ('60000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Cashier 1','20000000-0000-0000-0000-000000000001',true),
 ('60000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','Cashier 2','20000000-0000-0000-0000-000000000002',true),
 ('60000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000002','Cashier 3','20000000-0000-0000-0000-000000000003',true);
INSERT INTO auth.sessions VALUES ('70000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001');
INSERT INTO public.notification_subscriptions VALUES ('80000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001'),('80000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002');
INSERT INTO public.notification_deliveries VALUES ('90000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','sent'),('90000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000002','sent');
