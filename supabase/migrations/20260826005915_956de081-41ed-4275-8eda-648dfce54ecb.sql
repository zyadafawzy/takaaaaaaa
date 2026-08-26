-- 1) bundle_items / product_recommendations: only expose rows for sellable products
DROP POLICY IF EXISTS "Allow public read on bundle items" ON public.bundle_items;
DROP POLICY IF EXISTS "Anyone can view bundle items" ON public.bundle_items;
CREATE POLICY "public reads sellable bundle items"
ON public.bundle_items FOR SELECT TO anon, authenticated
USING (
  public.product_is_sellable(product_id)
  AND EXISTS (SELECT 1 FROM public.product_bundles b WHERE b.id = bundle_id AND b.active)
);

DROP POLICY IF EXISTS "Anyone can view recommendations" ON public.product_recommendations;
CREATE POLICY "public reads sellable recommendations"
ON public.product_recommendations FOR SELECT TO anon, authenticated
USING (
  public.product_is_sellable(product_id)
  AND public.product_is_sellable(recommended_id)
);

-- 2) search_aliases: hide internal-only columns from public roles
REVOKE SELECT ON public.search_aliases FROM anon, authenticated;
GRANT SELECT (id, search_term, normalized_term, sku, match_type, weight, locale, created_at, updated_at)
  ON public.search_aliases TO anon, authenticated;
GRANT ALL ON public.search_aliases TO service_role;

-- 3) SECURITY DEFINER functions: server-only ones are no longer callable from the API
REVOKE EXECUTE ON FUNCTION public.bootstrap_first_super_admin(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_app_setting(text, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.next_order_number(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.product_is_sellable(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_published_catalog() FROM PUBLIC, anon, authenticated;

-- role checks: signed-in users still need them; anonymous visitors do not
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_platform_owner(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.store_has_role(uuid, uuid, store_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_can_access_store(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_has_role(uuid, uuid, store_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_store(uuid, uuid) TO authenticated;