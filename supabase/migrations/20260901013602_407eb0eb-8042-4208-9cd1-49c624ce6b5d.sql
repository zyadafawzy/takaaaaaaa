DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND (p.proname LIKE 'pos\_%' OR p.proname LIKE 'rpc\_%'
            OR p.proname IN ('generate_invoice_number','prevent_confirmed_invoice_delete',
                             'prevent_confirmed_invoice_update','prevent_locked_invoice_items'))
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', f.sig);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.rpc_confirm_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_scan_barcode(uuid,text,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_void_invoice(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_close_shift(uuid,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_adjust_stock(uuid,uuid,uuid,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_confirm_purchase(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_customer_payment(uuid,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_is_superadmin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_can_read_store(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_can_write_store(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_can_manage_store(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_can_stock_store(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_has_store_role(uuid,uuid,public.pos_role[]) TO authenticated;