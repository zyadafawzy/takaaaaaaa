import { createServerFn } from "@tanstack/react-start";
import { SUPABASE_URL } from "@/integrations/supabase/connection";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * استوديو الكتالوج — كل القراءة والكتابة على الخادم بجلسة المدير وRLS.
 */

const PAGE_SIZE = 50;

const listInput = z.object({
  search: z.string().max(120).default(""),
  status: z.enum(["all", "draft", "published", "archived"]).default("all"),
  visibility: z.enum(["all", "visible", "hidden"]).default("all"),
  categoryId: z.string().uuid().optional(),
  needsReview: z.boolean().optional(),
  missingImage: z.boolean().optional(),
  page: z.number().int().min(0).max(10000).default(0),
  sort: z.enum(["name", "newest", "price_asc", "price_desc", "sort_order"]).default("sort_order"),
});

function sanitize(value: string): string {
  return value.replace(/[%_,()"'\\]/g, " ").trim().slice(0, 60);
}

export const adminCatalogStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!context) throw new Error("Unauthorized: No context");
    const { requireStaff, CATALOG_ROLES } = await import("./admin-guard.server");
    await requireStaff(context.supabase, context.userId, CATALOG_ROLES);
    const supabase = context.supabase;

    const [total, drafts, published, live, needsReview, categories] = await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "draft"),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "published"),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
        .eq("visible", true)
        .eq("available", true),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("needs_review", true),
      supabase.from("categories").select("id, name, slug").order("sort_order"),
    ]);

    return {
      total: total.count ?? 0,
      drafts: drafts.count ?? 0,
      published: published.count ?? 0,
      live: live.count ?? 0,
      needsReview: needsReview.count ?? 0,
      categories: categories.data ?? [],
    };
  });

export const adminListProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    if (!context) throw new Error("Unauthorized: No context");
    const { requireStaff, CATALOG_ROLES } = await import("./admin-guard.server");
    await requireStaff(context.supabase, context.userId, CATALOG_ROLES);

    let query = context.supabase
      .from("products")
      .select(
        `id, slug, sku, name, status, available, visible, is_featured, featured_until, offer_until, needs_review, is_complete, sort_order,
         created_at, categories ( id, name, slug ),
         product_variants ( id, price, compare_at_price, stock_quantity, active, sort_order ),
         product_images ( id, bucket_id, storage_path, published, sort_order )`,
        { count: "exact" },
      );

    if (data.status !== "all") query = query.eq("status", data.status);
    if (data.visibility !== "all") query = query.eq("visible", data.visibility === "visible");
    if (data.categoryId) query = query.eq("category_id", data.categoryId);
    if (data.needsReview) query = query.eq("needs_review", true);

    const search = sanitize(data.search);
    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,search_text.ilike.%${search}%`);
    }

    if (data.sort === "name") query = query.order("name", { ascending: true });
    else if (data.sort === "sort_order") query = query.order("sort_order", { ascending: true });
    else query = query.order("created_at", { ascending: false });

    const { data: rows, count, error } = await query.range(
      data.page * PAGE_SIZE,
      data.page * PAGE_SIZE + PAGE_SIZE - 1,
    );
    if (error) throw new Error("LIST_FAILED");

    let items = (rows ?? []).map((row: any) => {
      const variants = [...(row.product_variants ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order);
      const primary = variants[0];
      const images = [...(row.product_images ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order);
      const mainImage = images[0];
      
      let thumbnailUrl = null;
      if (mainImage) {
        thumbnailUrl = `${SUPABASE_URL}/storage/v1/object/public/${mainImage.bucket_id}/${mainImage.storage_path}`;
      }

      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        sku: row.sku,
        status: row.status,
        available: row.available,
        visible: row.visible,
        needsReview: row.needs_review,
        isFeatured: row.is_featured,
        featuredUntil: row.featured_until,
        offerUntil: row.offer_until,
        categoryName: row.categories?.name,
        price: primary?.price ?? 0,
        stock: variants.reduce((sum: number, v: any) => sum + (v.stock_quantity ?? 0), 0),
        sort_order: row.sort_order ?? 0,
        imageCount: images.length,
        thumbnailUrl
      };
    });

    if (data.missingImage) {
      items = items.filter((item: any) => item.imageCount === 0);
    }

    return {
      items,
      total: count ?? 0,
      page: data.page,
      pageSize: PAGE_SIZE,
    };
  });

export const adminGetProduct = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!context) throw new Error("Unauthorized: No context");
    const { requireStaff, CATALOG_ROLES } = await import("./admin-guard.server");
    await requireStaff(context.supabase, context.userId, CATALOG_ROLES);

    const { data: product, error } = await context.supabase
      .from("products")
      .select(
        `*, 
         product_variants(*), 
         product_images(*),
         product_price_history(*),
         categories(*)`,
      )
      .eq("id", data.id)
      .single();

    if (error || !product) throw new Error("PRODUCT_NOT_FOUND");
    
    const { data: allCategories } = await context.supabase
      .from("categories")
      .select("*")
      .order("sort_order");

    const images = (product.product_images ?? []).map((img: any) => ({
      ...img,
      url: `${SUPABASE_URL}/storage/v1/object/public/${img.bucket_id}/${img.storage_path}`
    }));

    return {
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        description: product.description,
        status: product.status,
        visible: product.visible,
        categoryId: product.category_id,
        isFresh: (product as any).is_fresh,
        isFeatured: (product as any).is_featured ?? (product as any).featured,
        featuredUntil: (product as any).featured_until,
        offerUntil: (product as any).offer_until,
        reviewNote: (product as any).review_note,
        isComplete: product.is_complete
      },
      variants: product.product_variants ?? [],
      images,
      priceHistory: (product.product_price_history ?? []).slice(0, 10),
      categories: allCategories ?? []
    };
  });

export const adminUpdateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().optional(),
        description: z.string().optional(),
        categoryId: z.string().uuid().nullable().optional(),
        isFresh: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
        featuredUntil: z.string().datetime().nullable().optional(),
        offerUntil: z.string().datetime().nullable().optional(),
        reviewNote: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!context) throw new Error("Unauthorized: No context");
    const { requireStaff, CATALOG_ROLES, writeAudit } = await import("./admin-guard.server");
    const identity = await requireStaff(context.supabase, context.userId, CATALOG_ROLES);

    const updates: any = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.categoryId !== undefined) updates.category_id = data.categoryId;
    if (data.isFresh !== undefined) updates.is_fresh = data.isFresh;
    if (data.isFeatured !== undefined) updates.is_featured = data.isFeatured;
    if (data.featuredUntil !== undefined) updates.featured_until = data.featuredUntil;
    if (data.offerUntil !== undefined) updates.offer_until = data.offerUntil;
    if (data.reviewNote !== undefined) updates.review_note = data.reviewNote;

    const { error } = await context.supabase.from("products").update(updates).eq("id", data.id);

    if (error) throw new Error("UPDATE_FAILED");

    await writeAudit(identity, "update_product", "products", data.id, updates);
    return { ok: true };
  });

export const adminBulkProductAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(200),
        action: z.enum(["publish", "unpublish", "show", "hide", "flag_review", "feature", "unfeature"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!context) throw new Error("Unauthorized: No context");
    const { requireStaff, CATALOG_ROLES, writeAudit } = await import("./admin-guard.server");
    const identity = await requireStaff(context.supabase, context.userId, CATALOG_ROLES);

    const updates: any = {};
    if (data.action === "publish") updates.status = "published";
    if (data.action === "unpublish") updates.status = "draft";
    if (data.action === "show") updates.visible = true;
    if (data.action === "hide") updates.visible = false;
    if (data.action === "flag_review") updates.needs_review = true;
    if (data.action === "feature") updates.is_featured = true;
    if (data.action === "unfeature") updates.is_featured = false;

    const { error } = await context.supabase.from("products").update(updates).in("id", data.ids);

    if (error) throw new Error("BULK_ACTION_FAILED");

    await writeAudit(identity, "bulk_product_action", "products", data.ids[0] || null, {
      ids: data.ids,
      action: data.action,
    });
    return { ok: true, affected: data.ids.length };
  });

export const adminUpdateVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        variantId: z.string().uuid(),
        sizeLabel: z.string().optional(),
        price: z.number().optional(),
        compareAtPrice: z.number().nullable().optional(),
        stockQuantity: z.number().int().optional(),
        reason: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!context) throw new Error("Unauthorized: No context");
    const { requireStaff, CATALOG_ROLES, writeAudit } = await import("./admin-guard.server");
    const identity = await requireStaff(context.supabase, context.userId, CATALOG_ROLES);

    const updates: any = {};
    if (data.sizeLabel !== undefined) updates.size_label = data.sizeLabel;
    if (data.price !== undefined) updates.price = data.price;
    if (data.compareAtPrice !== undefined) updates.compare_at_price = data.compareAtPrice;
    if (data.stockQuantity !== undefined) updates.stock_quantity = data.stockQuantity;

    const { error } = await context.supabase
      .from("product_variants")
      .update(updates)
      .eq("id", data.variantId);

    if (error) throw new Error("VARIANT_UPDATE_FAILED");

    await writeAudit(identity, "update_variant", "product_variants", data.variantId, updates);
    return { ok: true };
  });

export const adminSetImageState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ 
      imageId: z.string().uuid(), 
      published: z.boolean().optional(),
      makePrimary: z.boolean().optional()
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!context) throw new Error("Unauthorized: No context");
    const { requireStaff, CATALOG_ROLES, writeAudit } = await import("./admin-guard.server");
    const identity = await requireStaff(context.supabase, context.userId, CATALOG_ROLES);

    if (data.published !== undefined) {
      const { error } = await context.supabase
        .from("product_images")
        .update({ published: data.published })
        .eq("id", data.imageId);
      if (error) throw new Error("IMAGE_UPDATE_FAILED");
    }

    if (data.makePrimary) {
      // Get product ID first
      const { data: img } = await context.supabase.from("product_images").select("product_id").eq("id", data.imageId).single();
      if (img && img.product_id) {
        await context.supabase.from("product_images").update({ sort_order: 10 }).eq("product_id", img.product_id);
        await context.supabase.from("product_images").update({ sort_order: 0 }).eq("id", data.imageId);
      }
    }

    await writeAudit(identity, "set_image_state", "product_images", data.imageId, data as any);
    return { ok: true };
  });

export const adminSyncInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      updates: z.array(z.object({
        productId: z.string().uuid(),
        stock: z.number().int().optional(),
        available: z.boolean().optional(),
        sort_order: z.number().int().optional(),
      })).min(1).max(100)
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    if (!context) throw new Error("Unauthorized");
    const { requireStaff, CATALOG_ROLES, writeAudit } = await import("./admin-guard.server");
    const identity = await requireStaff(context.supabase, context.userId, CATALOG_ROLES);

    // This is simplified: in a real app, we might update variants or have a direct products stock column
    // Here we update the product table (which has available) and potentially the first variant's stock
    for (const update of data.updates) {
      if (update.available !== undefined || update.sort_order !== undefined) {
        const productUpdates: any = {};
        if (update.available !== undefined) productUpdates.available = update.available;
        if (update.sort_order !== undefined) productUpdates.sort_order = update.sort_order;
        await context.supabase.from("products").update(productUpdates).eq("id", update.productId);
      }
      
      if (update.stock !== undefined) {
        // Find the primary variant
        const { data: variant } = await context.supabase
          .from("product_variants")
          .select("id")
          .eq("product_id", update.productId)
          .order("sort_order", { ascending: true })
          .limit(1)
          .single();
        
        if (variant) {
          await context.supabase
            .from("product_variants")
            .update({ stock_quantity: update.stock })
            .eq("id", variant.id);
        }
      }
    }

    await writeAudit(identity, "sync_inventory", "products", null, { count: data.updates.length });
    return { ok: true };
  });

export const adminUpdateProductSort = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      productId: z.string().uuid(),
      sortOrder: z.number().int()
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    if (!context) throw new Error("Unauthorized");
    const { requireStaff, CATALOG_ROLES, writeAudit } = await import("./admin-guard.server");
    const identity = await requireStaff(context.supabase, context.userId, CATALOG_ROLES);

    const { error } = await context.supabase
      .from("products")
      .update({ sort_order: data.sortOrder } as any)
      .eq("id", data.productId);

    if (error) throw new Error("SORT_UPDATE_FAILED");

    await writeAudit(identity, "update_sort_order", "products", data.productId, { sortOrder: data.sortOrder });
    return { ok: true };
  });
