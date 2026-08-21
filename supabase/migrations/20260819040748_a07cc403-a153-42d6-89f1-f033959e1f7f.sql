CREATE POLICY "staff read store assets" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'store-assets' AND public.is_staff(auth.uid()));

CREATE POLICY "staff write store assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'store-assets' AND public.is_staff(auth.uid()));

CREATE POLICY "staff update store assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'store-assets' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'store-assets' AND public.is_staff(auth.uid()));

CREATE POLICY "staff delete store assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'store-assets' AND public.is_staff(auth.uid()));