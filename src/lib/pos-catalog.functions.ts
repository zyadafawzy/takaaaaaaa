import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PosCatalogItem } from "@/types/pos";

const uuid = z.string().uuid();

/** كتالوج ماكينة الكاشير مقفول: أي متجر يقدر يقرا الأصناف ويعدّل سعره هو بس. */
type LooseClient = { from: (table: string) => any };

export const posCatalogList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storeId: uuid,
        query: z.string().trim().max(60).optional(),
        onlyPriced: z.boolean().default(false),
        page: z.number().int().min(0).max(400).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ items: PosCatalogItem[]; total: number }> => {
    const { requireStoreRole, ROLE_ANY } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_ANY);

    const client = context.supabase as never as LooseClient;
    const size = 40;
    let query = client
      .from("pos_catalog_items")
      .select("id, barcode, name, brand, pack_size, unit_label, default_price, image_url", { count: "exact" })
      .eq("active", true);

    const needle = data.query?.trim();
    if (needle) {
      query = /^[0-9]{4,}$/.test(needle) ? query.eq("barcode", needle) : query.ilike("name", `%${needle}%`);
    }

    const { data: rows, count } = await query
      .order("name")
      .range(data.page * size, data.page * size + size - 1);

    const ids = (rows ?? []).map((r: { id: string }) => r.id);
    const priceMap = new Map<string, { sell: number; cost: number | null; active: boolean }>();
    if (ids.length > 0) {
      const { data: prices } = await client
        .from("pos_store_catalog_prices")
        .select("item_id, sell_price, cost_price, is_active")
        .eq("store_id", data.storeId)
        .in("item_id", ids);
      for (const row of prices ?? []) {
        priceMap.set(row.item_id, {
          sell: Number(row.sell_price),
          cost: row.cost_price == null ? null : Number(row.cost_price),
          active: row.is_active !== false,
        });
      }
    }

    const items: PosCatalogItem[] = (rows ?? [])
      .map((r: Record<string, unknown>) => {
        const override = priceMap.get(String(r["id"]));
        return {
          id: String(r["id"]),
          barcode: String(r["barcode"]),
          name: String(r["name"]),
          brand: (r["brand"] as string | null) ?? null,
          packSize: (r["pack_size"] as string | null) ?? null,
          unitLabel: (r["unit_label"] as string | null) ?? "قطعة",
          defaultPrice: Number(r["default_price"] ?? 0),
          imageUrl: (r["image_url"] as string | null) ?? null,
          storePrice: override?.sell ?? null,
          storeCost: override?.cost ?? null,
          storeActive: override ? override.active : true,
        };
      })
      .filter((item: PosCatalogItem) => (data.onlyPriced ? item.storePrice != null : true));

    return { items, total: Number(count ?? items.length) };
  });

/** تعديل سعر صنف الكتالوج للمتجر — الباركود والاسم مش قابلين للتعديل. */
export const posCatalogSetPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storeId: uuid,
        itemId: uuid,
        sellPrice: z.number().min(0).max(1_000_000),
        costPrice: z.number().min(0).max(1_000_000).nullable().optional(),
        isActive: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStoreRole, ROLE_MANAGE, round2 } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_MANAGE);

    const client = context.supabase as never as LooseClient;
    const { error } = await client.from("pos_store_catalog_prices").upsert(
      {
        store_id: data.storeId,
        item_id: data.itemId,
        sell_price: round2(data.sellPrice),
        cost_price: data.costPrice == null ? null : round2(data.costPrice),
        is_active: data.isActive,
        updated_by: context.userId,
      },
      { onConflict: "store_id,item_id" },
    );
    if (error) throw new Error("CATALOG_PRICE_FAILED");
    return { ok: true };
  });

/** رجّع الصنف لسعر الكتالوج الأساسي. */
export const posCatalogResetPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ storeId: uuid, itemId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { requireStoreRole, ROLE_MANAGE } = await import("./pos.server");
    await requireStoreRole(context.supabase, context.userId, data.storeId, ROLE_MANAGE);

    const client = context.supabase as never as LooseClient;
    await client
      .from("pos_store_catalog_prices")
      .delete()
      .eq("store_id", data.storeId)
      .eq("item_id", data.itemId);
    return { ok: true };
  });
