-- 1) Lock down SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.upsert_app_setting(text, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_app_setting(text, jsonb, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.bootstrap_first_super_admin(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_super_admin(uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.has_published_catalog() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_published_catalog() TO service_role;

-- Policy helpers: keep only the roles that evaluate policies, drop PUBLIC
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_any_role(uuid, app_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.product_is_sellable(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_is_sellable(uuid) TO anon, authenticated, service_role;

-- 2) Hide internal storage layout from public API consumers
REVOKE SELECT (bucket_id, storage_path) ON public.product_images FROM anon, authenticated;
GRANT SELECT (bucket_id, storage_path) ON public.product_images TO service_role;

-- 3) Stop unrestricted public writes to analytics
DROP POLICY IF EXISTS "Allow public insert for events" ON public.search_events;
REVOKE INSERT ON public.search_events FROM anon, authenticated;
GRANT ALL ON public.search_events TO service_role;