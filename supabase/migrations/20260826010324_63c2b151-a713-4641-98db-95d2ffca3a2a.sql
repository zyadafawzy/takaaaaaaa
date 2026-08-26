GRANT EXECUTE ON FUNCTION public.product_is_sellable(uuid) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.product_is_sellable(uuid) IS 'Boolean-only helper required by public catalog RLS policies for products, variants, images, bundles, and recommendations.';