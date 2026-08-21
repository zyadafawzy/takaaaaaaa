-- 1. Announcements table for timed alerts
CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    content text,
    image_url text,
    link_url text,
    starts_at timestamptz NOT NULL DEFAULT now(),
    ends_at timestamptz,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Add featured order to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS featured_order integer DEFAULT 0;

-- 3. Delivery zone extensions
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS estimated_days text DEFAULT '1-2 days';
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS description text;

-- 4. RLS & Grants
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT ALL ON public.announcements TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.announcements TO authenticated;

-- Avoid recursion by using authenticated check or specific role check if functions exist
CREATE POLICY "Public can view active announcements" ON public.announcements
    FOR SELECT USING (active = true AND (ends_at IS NULL OR ends_at > now()));

-- 5. Helper function for settings upsert
CREATE OR REPLACE FUNCTION public.upsert_app_setting(p_key text, p_value jsonb, p_is_public boolean DEFAULT true)
RETURNS void AS $$
BEGIN
    INSERT INTO public.app_settings (key, value, is_public, updated_at)
    VALUES (p_key, p_value, p_is_public, now())
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        is_public = EXCLUDED.is_public,
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.upsert_app_setting TO authenticated;
