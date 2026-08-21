import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * عمليات لوحة المطوّر (مالك المنصّة فقط).
 * كل عملية بتتحقق من الدور على الخادم قبل أي كتابة، وبتتسجل في سجل النشاط.
 */

const brandingSchema = z.object({
  primaryColor: z.string().max(9),
  secondaryColor: z.string().max(9),
  accentColor: z.string().max(9),
  backgroundColor: z.string().max(9),
  surfaceColor: z.string().max(9),
  textColor: z.string().max(9),
  mutedColor: z.string().max(9),
  borderColor: z.string().max(9),
  successColor: z.string().max(9),
  warningColor: z.string().max(9),
  dangerColor: z.string().max(9),
  themePreset: z.string().max(60).optional(),
  colorMode: z.enum(["light", "dark", "system"]).optional(),
  fontFamily: z.string().max(40).optional(),
  radiusStyle: z.string().max(20).optional(),
  density: z.string().max(20).optional(),
  headerStyle: z.string().max(20).optional(),
  productCardStyle: z.string().max(20).optional(),
  heroImageUrl: z.string().max(500).nullable().optional(),
  heroTitle: z.string().max(160).optional(),
  heroSubtitle: z.string().max(300).optional(),
});

function brandingRow(storeId: string, b: z.infer<typeof brandingSchema>) {
  return {
    store_id: storeId,
    primary_color: b.primaryColor,
    secondary_color: b.secondaryColor,
    accent_color: b.accentColor,
    background_color: b.backgroundColor,
    surface_color: b.surfaceColor,
    text_color: b.textColor,
    muted_color: b.mutedColor,
    border_color: b.borderColor,
    success_color: b.successColor,
    warning_color: b.warningColor,
    danger_color: b.dangerColor,
    theme_preset: b.themePreset ?? "custom",
    color_mode: b.colorMode ?? "light",
    font_family: b.fontFamily ?? "cairo",
    radius_style: b.radiusStyle ?? "soft",
    density: b.density ?? "comfortable",
    header_style: b.headerStyle ?? "classic",
    product_card_style: b.productCardStyle ?? "standard",
    hero_image_url: b.heroImageUrl ?? null,
    hero_title: b.heroTitle ?? "",
    hero_subtitle: b.heroSubtitle ?? "",
  };
}

async function hashPassword(plain: string) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(plain).digest("hex");
}

const zoneSchema = z.object({
  name: z.string().min(1).max(80),
  governorate: z.string().max(80).default(""),
  fee: z.number().min(0),
  minimumOrder: z.number().min(0).default(0),
  freeDeliveryThreshold: z.number().min(0).nullable().optional(),
});

const logoSchema = z.object({
  fileName: z.string().max(200),
  contentType: z.string().max(80),
  base64: z.string().max(4_000_000),
});

const storeSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "slug"),
  name: z.string().min(2).max(120),
  ownerName: z.string().max(120).default(""),
  description: z.string().max(600).default(""),
  phone: z.string().max(40).default(""),
  whatsappNumber: z.string().max(40).default(""),
  supportNumber: z.string().max(40).default(""),
  contactName: z.string().max(120).default(""),
  address: z.string().max(300).default(""),
  governorate: z.string().max(80).default(""),
  businessHours: z.string().max(200).default(""),
  status: z.enum(["draft", "active", "suspended"]).default("draft"),
  isMaintenance: z.boolean().optional(),
  maintenanceMessage: z.string().max(300).optional(),
  plan: z.enum(["basic", "pro", "ultimate"]).optional(),
  features: z.record(z.string(), z.boolean()).optional(),
});

async function requireOwner(context: { supabase: any; userId: string }) {
  const { requireStaff, SUPER_ADMIN_ROLES } = await import("./admin-guard.server");
  return requireStaff(context.supabase, context.userId, SUPER_ADMIN_ROLES);
}

async function logActivity(
  storeId: string | null,
  actor: { userId: string; email: string },
  action: string,
  detail: Record<string, unknown> = {},
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("store_activity_log").insert({
    store_id: storeId,
    actor_user_id: actor.userId,
    actor_email: actor.email,
    action,
    detail: detail as never,
  });
}

export const developerOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!context) throw new Error("Unauthorized");
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [stores, products, orders, activity] = await Promise.all([
      supabaseAdmin.from("stores").select("id, status"),
      supabaseAdmin.from("products").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("orders").select("id, grand_total, store_id, created_at"),
      supabaseAdmin
        .from("store_activity_log")
        .select("id, action, actor_email, created_at, store_id")
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    const storeRows = stores.data ?? [];
    const orderRows = orders.data ?? [];
    return {
      totalStores: storeRows.length,
      activeStores: storeRows.filter((s) => s.status === "active").length,
      draftStores: storeRows.filter((s) => s.status === "draft").length,
      masterProducts: products.count ?? 0,
      totalOrders: orderRows.length,
      revenue: orderRows.reduce((sum, o) => sum + Number(o.grand_total ?? 0), 0),
      activity: activity.data ?? [],
    };
  });

export const developerListStores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!context) throw new Error("Unauthorized");
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: stores }, { data: assignments }, { data: orders }] = await Promise.all([
      supabaseAdmin
        .from("stores")
        .select("id, slug, name, owner_name, status, is_master, governorate, whatsapp_number, logo_url, created_at, is_maintenance, maintenance_message, plan")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("store_products").select("store_id, enabled"),
      supabaseAdmin.from("orders").select("store_id, grand_total"),
    ]);

    return (stores ?? []).map((store) => ({
      ...store,
      logoUrl: store.logo_url ? `/api/public/store-logo/${store.id}` : null,
      productCount: (assignments ?? []).filter((a) => a.store_id === store.id && a.enabled).length,
      orderCount: (orders ?? []).filter((o) => o.store_id === store.id).length,
      revenue: (orders ?? [])
        .filter((o) => o.store_id === store.id)
        .reduce((sum, o) => sum + Number(o.grand_total ?? 0), 0),
    }));
  });

export const developerGetStore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!context) throw new Error("Unauthorized");
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: store }, { data: branding }, { data: assignments }, { data: zones }] =
      await Promise.all([
        supabaseAdmin.from("stores").select("*").eq("id", data.id).maybeSingle(),
        supabaseAdmin.from("store_branding").select("*").eq("store_id", data.id).maybeSingle(),
        supabaseAdmin
          .from("store_products")
          .select("product_id, enabled, visible, featured, price_override, compare_at_override")
          .eq("store_id", data.id),
        supabaseAdmin
          .from("store_delivery_zones")
          .select("*")
          .eq("store_id", data.id)
          .order("sort_order"),
      ]);

    if (!store) throw new Error("STORE_NOT_FOUND");
    return {
      store: { ...store, logoUrl: store.logo_url ? `/api/public/store-logo/${store.id}` : null },
      branding,
      assignments: assignments ?? [],
      zones: zones ?? [],
    };
  });

export const developerCreateStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        store: storeSchema,
        branding: brandingSchema,
        productIds: z.array(z.string().uuid()).max(5000).default([]),
        zones: z.array(zoneSchema).max(300).default([]),
        adminPassword: z.string().min(4).max(72).optional(),
        logo: logoSchema.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!context) throw new Error("Unauthorized");
    const identity = await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin
      .from("stores")
      .insert({
        slug: data.store.slug,
        name: data.store.name,
        owner_name: data.store.ownerName,
        description: data.store.description,
        phone: data.store.phone,
        whatsapp_number: data.store.whatsappNumber,
        support_number: data.store.supportNumber,
        contact_name: data.store.contactName,
        address: data.store.address,
        governorate: data.store.governorate,
        business_hours: data.store.businessHours,
        status: data.store.status,
        is_maintenance: data.store.isMaintenance ?? false,
        maintenance_message: data.store.maintenanceMessage ?? "",
        plan: data.store.plan ?? "basic",
        features: (data.store.features ?? {}) as never,
        ...(data.adminPassword ? { admin_password_hash: await hashPassword(data.adminPassword) } : {}),
      } as never)
      .select("id, slug")
      .single();

    if (error || !created) {
      throw new Error(error?.code === "23505" ? "SLUG_TAKEN" : "STORE_CREATE_FAILED");
    }

    await supabaseAdmin.from("store_branding").upsert(brandingRow(created.id, data.branding) as never);

    if (data.logo) {
      const extension = (data.logo.fileName.split(".").pop() ?? "png").toLowerCase().slice(0, 5);
      const path = `stores/${created.id}/logo-${Date.now()}.${extension}`;
      const uploaded = await supabaseAdmin.storage
        .from("store-assets")
        .upload(path, Buffer.from(data.logo.base64, "base64"), {
          contentType: data.logo.contentType,
          upsert: true,
        });
      if (!uploaded.error) {
        await supabaseAdmin.from("stores").update({ logo_url: path }).eq("id", created.id);
      }
    }

    if (data.productIds.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < data.productIds.length; i += chunkSize) {
        await supabaseAdmin.from("store_products").upsert(
          data.productIds.slice(i, i + chunkSize).map((productId, index) => ({
            store_id: created.id,
            product_id: productId,
            enabled: true,
            visible: true,
            sort_order: i + index,
          })),
          { onConflict: "store_id,product_id" },
        );
      }
    }

    if (data.zones.length > 0) {
      await supabaseAdmin.from("store_delivery_zones").insert(
        data.zones.map((zone, index) => ({
          store_id: created.id,
          name: zone.name,
          governorate: zone.governorate,
          fee: zone.fee,
          minimum_order: zone.minimumOrder,
          free_delivery_threshold: zone.freeDeliveryThreshold ?? null,
          sort_order: index,
        })),
      );
    }

    await logActivity(created.id, identity, "create_store", { slug: created.slug });
    return { id: created.id, slug: created.slug };
  });

export const developerUpdateStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        store: storeSchema.partial().optional(),
        branding: brandingSchema.optional(),
        adminPassword: z.string().min(4).max(72).optional(),
        zones: z.array(zoneSchema).max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!context) throw new Error("Unauthorized");
    const identity = await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.store) {
      const s = data.store;
      const patch: Record<string, unknown> = {};
      if (s.name !== undefined) patch["name"] = s.name;
      if (s.slug !== undefined) patch["slug"] = s.slug;
      if (s.ownerName !== undefined) patch["owner_name"] = s.ownerName;
      if (s.description !== undefined) patch["description"] = s.description;
      if (s.phone !== undefined) patch["phone"] = s.phone;
      if (s.whatsappNumber !== undefined) patch["whatsapp_number"] = s.whatsappNumber;
      if (s.supportNumber !== undefined) patch["support_number"] = s.supportNumber;
      if (s.contactName !== undefined) patch["contact_name"] = s.contactName;
      if (s.address !== undefined) patch["address"] = s.address;
      if (s.governorate !== undefined) patch["governorate"] = s.governorate;
      if (s.businessHours !== undefined) patch["business_hours"] = s.businessHours;
      if (s.status !== undefined) patch["status"] = s.status;
      if (s.isMaintenance !== undefined) patch["is_maintenance"] = s.isMaintenance;
      if (s.maintenanceMessage !== undefined) patch["maintenance_message"] = s.maintenanceMessage;
      if (s.plan !== undefined) patch["plan"] = s.plan;
      if (s.features !== undefined) patch["features"] = s.features;
      if (Object.keys(patch).length > 0) {
        const { error } = await supabaseAdmin.from("stores").update(patch as never).eq("id", data.id);
        if (error) throw new Error(error.code === "23505" ? "SLUG_TAKEN" : "STORE_UPDATE_FAILED");
      }
    }

    if (data.branding) {
      await supabaseAdmin.from("store_branding").upsert(brandingRow(data.id, data.branding) as never);
    }

    if (data.adminPassword) {
      await supabaseAdmin
        .from("stores")
        .update({ admin_password_hash: await hashPassword(data.adminPassword) })
        .eq("id", data.id);
    }

    if (data.zones) {
      await supabaseAdmin.from("store_delivery_zones").delete().eq("store_id", data.id);
      if (data.zones.length > 0) {
        await supabaseAdmin.from("store_delivery_zones").insert(
          data.zones.map((zone, index) => ({
            store_id: data.id,
            name: zone.name,
            governorate: zone.governorate,
            fee: zone.fee,
            minimum_order: zone.minimumOrder,
            free_delivery_threshold: zone.freeDeliveryThreshold ?? null,
            sort_order: index,
          })),
        );
      }
    }

    await logActivity(data.id, identity, "update_store", {});
    return { ok: true };
  });

export const developerSetStoreProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storeId: z.string().uuid(),
        add: z.array(z.string().uuid()).max(5000).default([]),
        remove: z.array(z.string().uuid()).max(5000).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!context) throw new Error("Unauthorized");
    const identity = await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.add.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < data.add.length; i += chunkSize) {
        await supabaseAdmin.from("store_products").upsert(
          data.add.slice(i, i + chunkSize).map((productId) => ({
            store_id: data.storeId,
            product_id: productId,
            enabled: true,
            visible: true,
          })),
          { onConflict: "store_id,product_id" },
        );
      }
    }
    if (data.remove.length > 0) {
      await supabaseAdmin
        .from("store_products")
        .delete()
        .eq("store_id", data.storeId)
        .in("product_id", data.remove);
    }

    await logActivity(data.storeId, identity, "assign_products", {
      added: data.add.length,
      removed: data.remove.length,
    });
    return { ok: true };
  });

export const developerListMasterProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        query: z.string().max(120).optional(),
        categorySlug: z.string().max(64).optional(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).max(10000).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    if (!context) throw new Error("Unauthorized");
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const limit = data.limit ?? 60;
    const offset = data.offset ?? 0;
    let request = supabaseAdmin
      .from("products")
      .select(
        "id, name, sku, slug, status, description, unit, categories ( slug, name ), product_images ( id, sort_order, asset_version, published ), product_variants ( price, compare_at_price, active, sort_order )",
        { count: "exact" },
      );

    if (data.query) {
      const q = data.query.replace(/[%_,()"'\\]/g, " ").trim();
      if (q) request = request.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
    }
    if (data.categorySlug) request = request.eq("categories.slug", data.categorySlug);

    const { data: rows, count } = await request
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);

    const products = ((rows ?? []) as unknown as Array<Record<string, any>>).map((row) => {
      const images = (row["product_images"] ?? [])
        .filter((img: any) => img.published !== false)
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const variants = (row["product_variants"] ?? [])
        .filter((v: any) => v.active !== false)
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const first = images[0];
      return {
        id: row["id"] as string,
        name: row["name"] as string,
        sku: row["sku"] as string,
        slug: row["slug"] as string,
        status: row["status"] as string,
        description: (row["description"] as string) ?? "",
        unit: (row["unit"] as string) ?? "",
        categoryName: row["categories"]?.name ?? "",
        price: variants[0]?.price == null ? null : Number(variants[0].price),
        thumbnailUrl: first
          ? `/api/public/product-image/${first.id}?v=${first.asset_version ?? 1}`
          : null,
      };
    });

    return { products, total: count ?? 0, offset, limit };
  });

export const developerSetStoreMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        isMaintenance: z.boolean(),
        message: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!context) throw new Error("Unauthorized");
    const identity = await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("stores")
      .update({
        is_maintenance: data.isMaintenance,
        ...(data.message === undefined ? {} : { maintenance_message: data.message }),
      } as never)
      .eq("id", data.id);
    await logActivity(data.id, identity, "toggle_maintenance", { on: data.isMaintenance });
    return { ok: true };
  });

export const developerUploadLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storeId: z.string().uuid(),
        fileName: z.string().max(200),
        contentType: z.string().max(80),
        base64: z.string().max(4_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!context) throw new Error("Unauthorized");
    const identity = await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const extension = (data.fileName.split(".").pop() ?? "png").toLowerCase().slice(0, 5);
    const path = `stores/${data.storeId}/logo-${Date.now()}.${extension}`;
    const bytes = Buffer.from(data.base64, "base64");

    const { error } = await supabaseAdmin.storage
      .from("store-assets")
      .upload(path, bytes, { contentType: data.contentType, upsert: true });
    if (error) throw new Error("LOGO_UPLOAD_FAILED");

    await supabaseAdmin.from("stores").update({ logo_url: path }).eq("id", data.storeId);
    await logActivity(data.storeId, identity, "upload_logo", {});
    return { url: `/api/public/store-logo/${data.storeId}?v=${Date.now()}` };
  });

export const developerDeleteStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!context) throw new Error("Unauthorized");
    const identity = await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: store } = await supabaseAdmin
      .from("stores")
      .select("is_master, slug")
      .eq("id", data.id)
      .maybeSingle();
    if (!store) throw new Error("STORE_NOT_FOUND");
    if (store.is_master) throw new Error("MASTER_STORE_PROTECTED");

    await supabaseAdmin.from("stores").delete().eq("id", data.id);
    await logActivity(null, identity, "delete_store", { slug: store.slug });
    return { ok: true };
  });
