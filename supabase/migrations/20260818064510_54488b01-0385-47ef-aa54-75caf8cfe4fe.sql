-- Create product_bundles table if not exists
CREATE TABLE IF NOT EXISTS public.product_bundles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    discount_amount NUMERIC(10, 2) DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create bundle_items table if not exists
CREATE TABLE IF NOT EXISTS public.bundle_items (
    bundle_id UUID REFERENCES public.product_bundles(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    PRIMARY KEY (bundle_id, product_id)
);

-- Add sort_order to products for featured sorting
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='products' AND COLUMN_NAME='sort_order') THEN
        ALTER TABLE public.products ADD COLUMN sort_order INTEGER DEFAULT 0;
    END IF;
END $$;

-- Update RLS and Grants
GRANT ALL ON public.product_bundles TO authenticated;
GRANT ALL ON public.product_bundles TO service_role;
GRANT SELECT ON public.product_bundles TO anon;

GRANT ALL ON public.bundle_items TO authenticated;
GRANT ALL ON public.bundle_items TO service_role;
GRANT SELECT ON public.bundle_items TO anon;

ALTER TABLE public.product_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_items ENABLE ROW LEVEL SECURITY;

-- Handle has_role function for admin check
-- Using the existing admin_profiles table as source of truth for staff
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_profiles WHERE user_id = _user_id AND role = _role AND active = true
  )
$$;

DROP POLICY IF EXISTS "Allow public read on bundles" ON public.product_bundles;
CREATE POLICY "Allow public read on bundles" ON public.product_bundles FOR SELECT TO anon, authenticated USING (active = true);

DROP POLICY IF EXISTS "Allow admin all on bundles" ON public.product_bundles;
CREATE POLICY "Allow admin all on bundles" ON public.product_bundles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'store_manager'));

DROP POLICY IF EXISTS "Allow public read on bundle items" ON public.bundle_items;
CREATE POLICY "Allow public read on bundle items" ON public.bundle_items FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin all on bundle items" ON public.bundle_items;
CREATE POLICY "Allow admin all on bundle items" ON public.bundle_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'store_manager'));
