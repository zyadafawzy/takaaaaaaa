-- 1. Add display order and visibility flags to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;

-- 2. Create product bundles table
CREATE TABLE IF NOT EXISTS public.product_bundles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    discount_amount decimal(12,2) DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. Junction table for products in bundles
CREATE TABLE IF NOT EXISTS public.bundle_items (
    bundle_id uuid REFERENCES public.product_bundles(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
    quantity integer DEFAULT 1,
    PRIMARY KEY (bundle_id, product_id)
);

-- 4. Recommendations table (Frequently bought together)
CREATE TABLE IF NOT EXISTS public.product_recommendations (
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
    recommended_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
    confidence_score float DEFAULT 0.0,
    PRIMARY KEY (product_id, recommended_id)
);

-- 5. Announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content text NOT NULL,
    type text DEFAULT 'info',
    active boolean DEFAULT true,
    starts_at timestamptz DEFAULT now(),
    ends_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 6. Grant Access
GRANT SELECT ON public.product_bundles TO authenticated, anon;
GRANT SELECT ON public.bundle_items TO authenticated, anon;
GRANT SELECT ON public.product_recommendations TO authenticated, anon;
GRANT SELECT ON public.announcements TO authenticated, anon;

GRANT ALL ON public.product_bundles TO service_role;
GRANT ALL ON public.bundle_items TO service_role;
GRANT ALL ON public.product_recommendations TO service_role;
GRANT ALL ON public.announcements TO service_role;

-- 7. Enable RLS
ALTER TABLE public.product_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 8. Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view active bundles') THEN
        CREATE POLICY "Anyone can view active bundles" ON public.product_bundles FOR SELECT USING (active = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view bundle items') THEN
        CREATE POLICY "Anyone can view bundle items" ON public.bundle_items FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view recommendations') THEN
        CREATE POLICY "Anyone can view recommendations" ON public.product_recommendations FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view active announcements') THEN
        CREATE POLICY "Anyone can view active announcements" ON public.announcements FOR SELECT USING (active = true AND (starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()));
    END IF;
END $$;
