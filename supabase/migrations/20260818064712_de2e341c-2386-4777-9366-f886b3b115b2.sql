-- Function to upsert app settings safely
CREATE OR REPLACE FUNCTION public.upsert_app_setting(
    p_key TEXT,
    p_value JSONB,
    p_is_public BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.app_settings (key, value, is_public, updated_at)
    VALUES (p_key, p_value, p_is_public, now())
    ON CONFLICT (key)
    DO UPDATE SET
        value = EXCLUDED.value,
        is_public = EXCLUDED.is_public,
        updated_at = now();
END;
$$;

-- Grant execute to authenticated users (admin checks are done in server functions)
GRANT EXECUTE ON FUNCTION public.upsert_app_setting(TEXT, JSONB, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_app_setting(TEXT, JSONB, BOOLEAN) TO service_role;
