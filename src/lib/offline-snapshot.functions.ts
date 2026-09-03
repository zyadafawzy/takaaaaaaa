import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

export type OfflineVariant = {
  variantId: string;
  productId: string;
  productName: string;
  unitLabel: string;
  sellPrice: number;
  costPrice: number | null;
  stock: number;
  barcodes: string[];
};

export type OfflineSnapshotData = {
  storeId: string;
  branchId: string | null;
  takenAt: string;
  variants: OfflineVariant[];
  customers: Array<{ id: string; name: string; phone: string | null; address: string | null }>;
  paymentMethods: Array<{ id: string; name: string; type: string }>;
};

/** لقطة كاملة لبيانات نقطة البيع عشان الكاشير يشتغل من غير إنترنت. */
export const posOfflineSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ storeId: uuid, branchId: uuid.nullable().optional() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<OfflineSnapshotData> => {
    const { requireStoreRole, ROLE_ANY } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_ANY);

    const [variantsRes, barcodesRes, stockRes, customersRes, methodsRes] = await Promise.all([
      context.supabase
        .from("product_variants")
        .select("id, product_id, price, cost_price, unit_label, active, products!inner(id, name)")
        .eq("active", true)
        .limit(5000),
      context.supabase.from("product_barcodes").select("variant_id, barcode").eq("store_id", data.storeId).limit(10000),
      context.supabase.from("inventory_stock").select("variant_id, qty_on_hand, branch_id").eq("store_id", data.storeId).limit(10000),
      context.supabase
        .from("customers")
        .select("id, name, phone, address")
        .eq("store_id", data.storeId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .limit(5000),
      context.supabase
        .from("payment_methods")
        .select("id, name, type")
        .eq("store_id", data.storeId)
        .eq("is_active", true)
        .order("sort_order"),
    ]);

    const barcodeMap = new Map<string, string[]>();
    for (const row of barcodesRes.data ?? []) {
      const list = barcodeMap.get(row.variant_id) ?? [];
      list.push(row.barcode);
      barcodeMap.set(row.variant_id, list);
    }

    const stockMap = new Map<string, number>();
    for (const row of stockRes.data ?? []) {
      if (data.branchId && row.branch_id && row.branch_id !== data.branchId) continue;
      stockMap.set(row.variant_id, Number(row.qty_on_hand));
    }

    const variants: OfflineVariant[] = (variantsRes.data ?? []).map((row) => {
      const product = row.products as unknown as { id: string; name: string };
      return {
        variantId: row.id,
        productId: row.product_id,
        productName: product?.name ?? "صنف",
        unitLabel: row.unit_label ?? "قطعة",
        sellPrice: Number(row.price ?? 0),
        costPrice: row.cost_price == null ? null : Number(row.cost_price),
        stock: stockMap.get(row.id) ?? 0,
        barcodes: barcodeMap.get(row.id) ?? [],
      };
    });

    return {
      storeId: data.storeId,
      branchId: data.branchId ?? null,
      takenAt: new Date().toISOString(),
      variants,
      customers: (customersRes.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone ?? null,
        address: c.address ?? null,
      })),
      paymentMethods: (methodsRes.data ?? []).map((m) => ({ id: m.id, name: m.name, type: String(m.type) })),
    };
  });
