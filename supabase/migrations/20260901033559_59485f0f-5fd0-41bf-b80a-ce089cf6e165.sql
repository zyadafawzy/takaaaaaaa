GRANT SELECT (
  id, slug, name, description, logo_url, favicon_url, features, address, governorate,
  phone, whatsapp_number, support_number, business_hours, contact_name, owner_name,
  plan, status, is_master, is_maintenance, maintenance_message, created_at, updated_at
) ON public.stores TO anon, authenticated;
GRANT ALL ON public.stores TO service_role;