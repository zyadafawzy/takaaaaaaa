import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const bundleSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().optional(),
  discountAmount: z.number().min(0),
  active: z.boolean().default(true),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1)
  })).min(1)
});

export const adminListBundles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!context) throw new Error("Unauthorized");
    const { requireStaff, CATALOG_ROLES } = await import("./admin-guard.server");
    await requireStaff(context.supabase, context.userId, CATALOG_ROLES);

    const { data, error } = await context.supabase
      .from("product_bundles")
      .select(`
        *,
        bundle_items (
          product_id,
          quantity,
          products (
            id,
            name,
            sku
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw new Error("BUNDLES_FETCH_FAILED");
    return data;
  });

export const adminCreateBundle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => bundleSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (!context) throw new Error("Unauthorized");
    const { requireStaff, CATALOG_ROLES, writeAudit } = await import("./admin-guard.server");
    const identity = await requireStaff(context.supabase, context.userId, CATALOG_ROLES);

    const { items, ...bundleData } = data;
    
    // 1. Create bundle
    const { data: bundle, error: bundleError } = await context.supabase
      .from("product_bundles")
      .insert({
        name: bundleData.name,
        slug: bundleData.slug,
        description: bundleData.description,
        discount_amount: bundleData.discountAmount,
        active: bundleData.active
      } as any)
      .select()
      .single();

    if (bundleError || !bundle) throw new Error("BUNDLE_CREATE_FAILED");

    // 2. Add items
    const { error: itemsError } = await context.supabase
      .from("bundle_items")
      .insert(items.map(item => ({
        bundle_id: bundle.id,
        product_id: item.productId,
        quantity: item.quantity
      })));

    if (itemsError) {
      // Cleanup if items fail
      await context.supabase.from("product_bundles").delete().eq("id", bundle.id);
      throw new Error("BUNDLE_ITEMS_FAILED");
    }

    await writeAudit(identity, "create_bundle", "product_bundles", bundle.id, data as any);
    return bundle;
  });

export const adminDeleteBundle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!context) throw new Error("Unauthorized");
    const { requireStaff, CATALOG_ROLES, writeAudit } = await import("./admin-guard.server");
    const identity = await requireStaff(context.supabase, context.userId, CATALOG_ROLES);

    const { error } = await context.supabase
      .from("product_bundles")
      .delete()
      .eq("id", data.id);

    if (error) throw new Error("BUNDLE_DELETE_FAILED");

    await writeAudit(identity, "delete_bundle", "product_bundles", data.id, {});
    return { ok: true };
  });
