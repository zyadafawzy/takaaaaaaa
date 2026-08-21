revoke execute on function public.has_role(uuid, public.app_role) from anon;
revoke execute on function public.has_any_role(uuid, public.app_role[]) from anon;
revoke execute on function public.is_staff(uuid) from anon;
revoke execute on function public.set_updated_at() from anon, authenticated;
comment on function public.product_is_sellable(uuid) is 'تُستخدم داخل سياسات RLS لقراءة الكتالوج المنشور — تحتاج EXECUTE للزائر المجهول.';