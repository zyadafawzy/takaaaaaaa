-- 1) Hide stores.admin_password_hash from anon/authenticated via column-level grants
REVOKE SELECT ON public.stores FROM anon, authenticated;
GRANT SELECT (
  id, slug, name, owner_name, description, logo_url, favicon_url, phone,
  whatsapp_number, support_number, contact_name, address, governorate,
  business_hours, status, is_master, created_at, updated_at,
  is_maintenance, maintenance_message, plan, features
) ON public.stores TO anon, authenticated;

REVOKE UPDATE ON public.stores FROM anon, authenticated;
GRANT UPDATE (
  slug, name, owner_name, description, logo_url, favicon_url, phone,
  whatsapp_number, support_number, contact_name, address, governorate,
  business_hours, status, is_master, updated_at,
  is_maintenance, maintenance_message, plan, features
) ON public.stores TO authenticated;

GRANT ALL ON public.stores TO service_role;

-- 2) Enable RLS on locations
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.locations TO anon, authenticated;
GRANT ALL ON public.locations TO service_role;

CREATE POLICY "public reads locations"
ON public.locations FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "staff manage locations"
ON public.locations FOR ALL
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));