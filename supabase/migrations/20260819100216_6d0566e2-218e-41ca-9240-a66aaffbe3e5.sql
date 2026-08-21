
-- 1. Add admin_password_hash to stores
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS admin_password_hash text;

-- 2. Create hierarchical locations table
CREATE TABLE IF NOT EXISTS public.locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text NOT NULL CHECK (type IN ('governorate', 'area')),
    created_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.locations TO authenticated, anon;
GRANT ALL ON public.locations TO service_role;

-- 3. Seed some basic locations for Egypt
INSERT INTO public.locations (name, type) VALUES ('القاهرة', 'governorate') ON CONFLICT DO NOTHING;
INSERT INTO public.locations (name, type) VALUES ('الجيزة', 'governorate') ON CONFLICT DO NOTHING;
INSERT INTO public.locations (name, type) VALUES ('الإسكندرية', 'governorate') ON CONFLICT DO NOTHING;

-- Add areas for Cairo (assuming ID is known or using subquery)
DO $$ 
DECLARE 
    cairo_id uuid;
    giza_id uuid;
    alex_id uuid;
BEGIN
    SELECT id INTO cairo_id FROM public.locations WHERE name = 'القاهرة' AND type = 'governorate' LIMIT 1;
    SELECT id INTO giza_id FROM public.locations WHERE name = 'الجيزة' AND type = 'governorate' LIMIT 1;
    SELECT id INTO alex_id FROM public.locations WHERE name = 'الإسكندرية' AND type = 'governorate' LIMIT 1;

    IF cairo_id IS NOT NULL THEN
        INSERT INTO public.locations (name, type, parent_id) VALUES ('المعادي', 'area', cairo_id) ON CONFLICT DO NOTHING;
        INSERT INTO public.locations (name, type, parent_id) VALUES ('مدينة نصر', 'area', cairo_id) ON CONFLICT DO NOTHING;
        INSERT INTO public.locations (name, type, parent_id) VALUES ('التجمع الخامس', 'area', cairo_id) ON CONFLICT DO NOTHING;
    END IF;

    IF giza_id IS NOT NULL THEN
        INSERT INTO public.locations (name, type, parent_id) VALUES ('الدقي', 'area', giza_id) ON CONFLICT DO NOTHING;
        INSERT INTO public.locations (name, type, parent_id) VALUES ('المهندسين', 'area', giza_id) ON CONFLICT DO NOTHING;
        INSERT INTO public.locations (name, type, parent_id) VALUES ('أكتوبر', 'area', giza_id) ON CONFLICT DO NOTHING;
    END IF;

    IF alex_id IS NOT NULL THEN
        INSERT INTO public.locations (name, type, parent_id) VALUES ('سموحة', 'area', alex_id) ON CONFLICT DO NOTHING;
        INSERT INTO public.locations (name, type, parent_id) VALUES ('المنتزة', 'area', alex_id) ON CONFLICT DO NOTHING;
        INSERT INTO public.locations (name, type, parent_id) VALUES ('سيدي جابر', 'area', alex_id) ON CONFLICT DO NOTHING;
    END IF;
END $$;
