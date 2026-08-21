DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.relname);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.relname);
  END LOOP;
END $$;

GRANT SELECT ON public.announcements TO anon;
GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT ON public.brands TO anon;
GRANT SELECT ON public.bundle_items TO anon;
GRANT SELECT ON public.categories TO anon;
GRANT SELECT ON public.delivery_zones TO anon;
GRANT SELECT ON public.product_bundles TO anon;
GRANT SELECT ON public.product_images TO anon;
GRANT SELECT ON public.product_recommendations TO anon;
GRANT SELECT ON public.product_variants TO anon;
GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.store_branches TO anon;