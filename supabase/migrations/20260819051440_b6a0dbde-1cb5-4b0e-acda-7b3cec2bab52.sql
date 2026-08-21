ALTER TABLE public.products ADD COLUMN IF NOT EXISTS owner_store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS owner_store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS owner_store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;

ALTER TABLE public.store_branding
  ADD COLUMN IF NOT EXISTS theme_preset text NOT NULL DEFAULT 'natural',
  ADD COLUMN IF NOT EXISTS color_mode text NOT NULL DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS font_family text NOT NULL DEFAULT 'cairo',
  ADD COLUMN IF NOT EXISTS radius_style text NOT NULL DEFAULT 'soft',
  ADD COLUMN IF NOT EXISTS density text NOT NULL DEFAULT 'comfortable',
  ADD COLUMN IF NOT EXISTS header_style text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS product_card_style text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS hero_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hero_subtitle text NOT NULL DEFAULT '';

CREATE TABLE public.store_settings (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  accepting_orders boolean NOT NULL DEFAULT true,
  pickup_enabled boolean NOT NULL DEFAULT false,
  cod_enabled boolean NOT NULL DEFAULT true,
  online_payment_enabled boolean NOT NULL DEFAULT false,
  contact_email text NOT NULL DEFAULT '',
  facebook_url text NOT NULL DEFAULT '',
  instagram_url text NOT NULL DEFAULT '',
  tiktok_url text NOT NULL DEFAULT '',
  order_whatsapp_template text NOT NULL DEFAULT '',
  substitution_policy_text text NOT NULL DEFAULT '',
  closed_message text NOT NULL DEFAULT '',
  privacy_text text NOT NULL DEFAULT '',
  terms_text text NOT NULL DEFAULT '',
  default_currency text NOT NULL DEFAULT 'ج.م',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_settings TO authenticated;
GRANT SELECT ON public.store_settings TO anon;
GRANT ALL ON public.store_settings TO service_role;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads active store settings" ON public.store_settings
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.status = 'active'));
CREATE POLICY "store admins manage own settings" ON public.store_settings
  FOR ALL TO authenticated
  USING (public.is_platform_owner(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.store_users su
    WHERE su.store_id = store_settings.store_id AND su.user_id = auth.uid()
      AND su.active AND su.role = 'store_admin'
  ))
  WITH CHECK (public.is_platform_owner(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.store_users su
    WHERE su.store_id = store_settings.store_id AND su.user_id = auth.uid()
      AND su.active AND su.role = 'store_admin'
  ));
CREATE TRIGGER store_settings_updated_at BEFORE UPDATE ON public.store_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.store_settings (store_id)
SELECT id FROM public.stores
ON CONFLICT (store_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.store_has_role(_user_id uuid, _store_id uuid, _roles public.store_role[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_platform_owner(_user_id) OR EXISTS (
    SELECT 1 FROM public.store_users
    WHERE user_id = _user_id AND store_id = _store_id AND active AND role = ANY(_roles)
  )
$$;
REVOKE ALL ON FUNCTION public.store_has_role(uuid, uuid, public.store_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_has_role(uuid, uuid, public.store_role[]) TO authenticated, service_role;

DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname, tablename FROM pg_policies
    WHERE schemaname='public' AND tablename IN ('orders','order_items','order_events','order_notes','anonymous_carts','cart_items')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename); END LOOP;
END $$;

CREATE POLICY "store staff read orders" ON public.orders FOR SELECT TO authenticated
USING (store_id IS NOT NULL AND public.user_can_access_store(auth.uid(), store_id));
CREATE POLICY "store operators update orders" ON public.orders FOR UPDATE TO authenticated
USING (store_id IS NOT NULL AND public.store_has_role(auth.uid(), store_id, ARRAY['store_admin','store_staff']::public.store_role[]))
WITH CHECK (store_id IS NOT NULL AND public.store_has_role(auth.uid(), store_id, ARRAY['store_admin','store_staff']::public.store_role[]));

CREATE POLICY "store staff read order items" ON public.order_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.store_id IS NOT NULL AND public.user_can_access_store(auth.uid(), o.store_id)));
CREATE POLICY "store staff read order events" ON public.order_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.store_id IS NOT NULL AND public.user_can_access_store(auth.uid(), o.store_id)));
CREATE POLICY "store operators add order events" ON public.order_events FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.store_id IS NOT NULL AND public.store_has_role(auth.uid(), o.store_id, ARRAY['store_admin','store_staff']::public.store_role[])));
CREATE POLICY "store staff read order notes" ON public.order_notes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.store_id IS NOT NULL AND public.user_can_access_store(auth.uid(), o.store_id)));
CREATE POLICY "store operators add order notes" ON public.order_notes FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.store_id IS NOT NULL AND public.store_has_role(auth.uid(), o.store_id, ARRAY['store_admin','store_staff']::public.store_role[])));

CREATE POLICY "store staff read carts" ON public.anonymous_carts FOR SELECT TO authenticated
USING (store_id IS NOT NULL AND public.user_can_access_store(auth.uid(), store_id));
CREATE POLICY "store staff read cart items" ON public.cart_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.anonymous_carts c WHERE c.id = cart_id AND c.store_id IS NOT NULL AND public.user_can_access_store(auth.uid(), c.store_id)));

DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='products'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.products', p.policyname); END LOOP;
END $$;
CREATE POLICY "public reads sellable catalog" ON public.products FOR SELECT TO anon, authenticated
USING (
  status = 'published' AND available AND is_complete AND visible
  AND (visible_from IS NULL OR visible_from <= now())
  AND (visible_until IS NULL OR visible_until > now())
  AND (
    owner_store_id IS NULL OR EXISTS (
      SELECT 1 FROM public.store_products sp JOIN public.stores s ON s.id = sp.store_id
      WHERE sp.product_id = products.id AND sp.enabled AND sp.visible AND s.status = 'active'
    )
  )
);
CREATE POLICY "store admins manage private products" ON public.products FOR ALL TO authenticated
USING (owner_store_id IS NOT NULL AND public.store_has_role(auth.uid(), owner_store_id, ARRAY['store_admin']::public.store_role[]))
WITH CHECK (owner_store_id IS NOT NULL AND public.store_has_role(auth.uid(), owner_store_id, ARRAY['store_admin']::public.store_role[]));
CREATE POLICY "platform catalog managers manage products" ON public.products FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','store_manager','inventory_operator']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','store_manager','inventory_operator']::public.app_role[]));

CREATE INDEX IF NOT EXISTS products_owner_store_status_idx ON public.products(owner_store_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS categories_owner_store_published_idx ON public.categories(owner_store_id, published, sort_order);
CREATE INDEX IF NOT EXISTS brands_owner_store_published_idx ON public.brands(owner_store_id, published, name);
CREATE INDEX IF NOT EXISTS store_products_store_visible_sort_idx ON public.store_products(store_id, enabled, visible, featured DESC, sort_order);
CREATE INDEX IF NOT EXISTS store_products_store_product_idx ON public.store_products(store_id, product_id);
CREATE INDEX IF NOT EXISTS orders_store_created_idx ON public.orders(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_store_status_created_idx ON public.orders(store_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS anonymous_carts_store_session_idx ON public.anonymous_carts(store_id, session_token);
CREATE INDEX IF NOT EXISTS store_activity_store_created_idx ON public.store_activity_log(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS store_users_user_active_idx ON public.store_users(user_id, active, store_id);

REVOKE ALL ON FUNCTION public.bootstrap_first_super_admin(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_super_admin(uuid, text, text) TO service_role;