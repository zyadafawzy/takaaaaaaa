DO $$ BEGIN
  CREATE TYPE public.store_status AS ENUM ('draft','active','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.store_role AS ENUM ('store_admin','store_staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  owner_name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  logo_url text,
  favicon_url text,
  phone text NOT NULL DEFAULT '',
  whatsapp_number text NOT NULL DEFAULT '',
  support_number text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  governorate text NOT NULL DEFAULT '',
  business_hours text NOT NULL DEFAULT '',
  status public.store_status NOT NULL DEFAULT 'draft',
  is_master boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_branding (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  primary_color text NOT NULL DEFAULT '#16a34a',
  secondary_color text NOT NULL DEFAULT '#0f172a',
  accent_color text NOT NULL DEFAULT '#f59e0b',
  background_color text NOT NULL DEFAULT '#0b0f14',
  surface_color text NOT NULL DEFAULT '#131a21',
  text_color text NOT NULL DEFAULT '#f8fafc',
  muted_color text NOT NULL DEFAULT '#94a3b8',
  border_color text NOT NULL DEFAULT '#1f2933',
  success_color text NOT NULL DEFAULT '#22c55e',
  warning_color text NOT NULL DEFAULT '#f59e0b',
  danger_color text NOT NULL DEFAULT '#ef4444',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  visible boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  price_override numeric,
  compare_at_override numeric,
  stock_override integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, product_id)
);
CREATE INDEX IF NOT EXISTS store_products_store_idx ON public.store_products(store_id) WHERE enabled;

CREATE TABLE IF NOT EXISTS public.store_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text NOT NULL DEFAULT '',
  full_name text NOT NULL DEFAULT '',
  role public.store_role NOT NULL DEFAULT 'store_admin',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.store_delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  governorate text NOT NULL DEFAULT '',
  fee numeric NOT NULL DEFAULT 0,
  minimum_order numeric NOT NULL DEFAULT 0,
  free_delivery_threshold numeric,
  available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  content text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  actor_user_id uuid,
  actor_email text NOT NULL DEFAULT '',
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_activity_created_idx ON public.store_activity_log(created_at DESC);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id);
ALTER TABLE public.anonymous_carts ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id);

INSERT INTO public.stores (slug, name, owner_name, status, is_master, whatsapp_number, description)
VALUES ('tekka', 'تِكّة', 'Teka Platform', 'active', true, '', 'المتجر الرئيسي — محرك تِكّة التجاري')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.store_branding (store_id)
SELECT id FROM public.stores WHERE slug = 'tekka'
ON CONFLICT (store_id) DO NOTHING;

UPDATE public.orders SET store_id = (SELECT id FROM public.stores WHERE slug='tekka') WHERE store_id IS NULL;
UPDATE public.anonymous_carts SET store_id = (SELECT id FROM public.stores WHERE slug='tekka') WHERE store_id IS NULL;

CREATE OR REPLACE FUNCTION public.is_platform_owner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_profiles
    WHERE user_id = _user_id AND active AND role = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_store(_user_id uuid, _store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_owner(_user_id)
      OR EXISTS (
        SELECT 1 FROM public.store_users
        WHERE user_id = _user_id AND store_id = _store_id AND active
      )
$$;

REVOKE EXECUTE ON FUNCTION public.is_platform_owner(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_can_access_store(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_owner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_access_store(uuid, uuid) TO authenticated, service_role;

GRANT SELECT ON public.stores, public.store_branding, public.store_products,
  public.store_delivery_zones, public.store_announcements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores, public.store_branding, public.store_products,
  public.store_users, public.store_delivery_zones, public.store_announcements TO authenticated;
GRANT SELECT ON public.store_activity_log TO authenticated;
GRANT ALL ON public.stores, public.store_branding, public.store_products, public.store_users,
  public.store_delivery_zones, public.store_announcements, public.store_activity_log TO service_role;

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public reads active stores" ON public.stores
  FOR SELECT USING (status = 'active');
CREATE POLICY "members read own store" ON public.stores
  FOR SELECT TO authenticated USING (public.user_can_access_store(auth.uid(), id));
CREATE POLICY "platform owner manages stores" ON public.stores
  FOR ALL TO authenticated
  USING (public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_platform_owner(auth.uid()));

CREATE POLICY "public reads active store branding" ON public.store_branding
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.status = 'active'));
CREATE POLICY "members manage own branding" ON public.store_branding
  FOR ALL TO authenticated
  USING (public.user_can_access_store(auth.uid(), store_id))
  WITH CHECK (public.user_can_access_store(auth.uid(), store_id));

CREATE POLICY "public reads visible store products" ON public.store_products
  FOR SELECT USING (
    enabled AND visible
    AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.status = 'active')
  );
CREATE POLICY "members manage own store products" ON public.store_products
  FOR ALL TO authenticated
  USING (public.user_can_access_store(auth.uid(), store_id))
  WITH CHECK (public.user_can_access_store(auth.uid(), store_id));

CREATE POLICY "members read own store users" ON public.store_users
  FOR SELECT TO authenticated USING (public.user_can_access_store(auth.uid(), store_id));
CREATE POLICY "platform owner manages store users" ON public.store_users
  FOR ALL TO authenticated
  USING (public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_platform_owner(auth.uid()));

CREATE POLICY "public reads available store zones" ON public.store_delivery_zones
  FOR SELECT USING (
    available AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.status = 'active')
  );
CREATE POLICY "members manage own store zones" ON public.store_delivery_zones
  FOR ALL TO authenticated
  USING (public.user_can_access_store(auth.uid(), store_id))
  WITH CHECK (public.user_can_access_store(auth.uid(), store_id));

CREATE POLICY "public reads active store announcements" ON public.store_announcements
  FOR SELECT USING (
    active AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.status = 'active')
  );
CREATE POLICY "members manage own store announcements" ON public.store_announcements
  FOR ALL TO authenticated
  USING (public.user_can_access_store(auth.uid(), store_id))
  WITH CHECK (public.user_can_access_store(auth.uid(), store_id));

CREATE POLICY "platform owner reads activity" ON public.store_activity_log
  FOR SELECT TO authenticated USING (public.is_platform_owner(auth.uid()));

DROP TRIGGER IF EXISTS stores_updated_at ON public.stores;
CREATE TRIGGER stores_updated_at BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS store_products_updated_at ON public.store_products;
CREATE TRIGGER store_products_updated_at BEFORE UPDATE ON public.store_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();