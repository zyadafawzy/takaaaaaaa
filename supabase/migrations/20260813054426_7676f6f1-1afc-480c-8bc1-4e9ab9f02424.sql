-- سياسات storage.objects للمخزنين الخاصين
create policy "import staff reads private buckets"
on storage.objects for select to authenticated
using (
  bucket_id in ('admin-imports-private','product-assets-private')
  and public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator']::public.app_role[])
);

create policy "import staff uploads private buckets"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('admin-imports-private','product-assets-private')
  and public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator']::public.app_role[])
);

create policy "import staff updates private buckets"
on storage.objects for update to authenticated
using (
  bucket_id in ('admin-imports-private','product-assets-private')
  and public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator']::public.app_role[])
)
with check (
  bucket_id in ('admin-imports-private','product-assets-private')
  and public.has_any_role(auth.uid(), array['super_admin','store_manager','inventory_operator']::public.app_role[])
);

create policy "managers delete private buckets"
on storage.objects for delete to authenticated
using (
  bucket_id in ('admin-imports-private','product-assets-private')
  and public.has_any_role(auth.uid(), array['super_admin','store_manager']::public.app_role[])
);