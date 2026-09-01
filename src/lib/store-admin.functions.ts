import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { storeOrderStatuses, storeSlugInput } from "./store-admin.schemas";

/** المتاجر اللي المستخدم الحالي مسؤول عنها. */
export const myStores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: owner } = await context.supabase.rpc("is_platform_owner", {
      _user_id: context.userId,
    });

    if (owner === true) {
      const { data } = await supabaseAdmin
        .from("stores")
        .select("id, slug, name, status")
        .order("created_at", { ascending: false })
        .limit(500);
      return { platformOwner: true, stores: data ?? [] };
    }

    const { data: memberships } = await context.supabase
      .from("store_users")
      .select("store_id, role")
      .eq("user_id", context.userId)
      .eq("active", true);

    const ids = (memberships ?? []).map((row) => row.store_id);
    if (ids.length === 0) return { platformOwner: false, stores: [] };

    const { data } = await supabaseAdmin
      .from("stores")
      .select("id, slug, name, status")
      .in("id", ids);
    return { platformOwner: false, stores: data ?? [] };
  });

export const storeAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => storeSlugInput.parse(input))
  .handler(async ({ data, context }) => {
    const { requireStoreAccess, loadStoreDashboard } = await import("./store-admin.server");
    const access = await requireStoreAccess(context.supabase, context.userId, data.storeSlug);
    return loadStoreDashboard(access);
  });

export const storeAdminOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    storeSlugInput
      .extend({
        status: z.enum(storeOrderStatuses).optional(),
        cursor: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStoreAccess } = await import("./store-admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const access = await requireStoreAccess(context.supabase, context.userId, data.storeSlug);
    const limit = data.limit ?? 30;

    let query = supabaseAdmin
      .from("orders")
      .select(
        "id, token, order_number, status, customer_first_name, customer_phone, customer_whatsapp, zone_name, governorate, street, building, landmark, customer_notes, items_total, discount_total, grand_total, delivery_fee, fulfillment, substitution, created_at, order_items ( product_name, size_label, quantity, unit_price, line_total, note )",
      )
      .eq("store_id", access.storeId)
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    if (data.status) query = query.eq("status", data.status);
    if (data.cursor) query = query.lt("created_at", data.cursor);

    const { data: rows, error } = await query;
    if (error) throw new Error("LOAD_FAILED");

    const page = (rows ?? []).slice(0, limit);
    return {
      orders: page.map((row) => ({
        id: row.id,
        token: row.token,
        number: row.order_number,
        status: row.status,
        customer: row.customer_first_name,
        phone: row.customer_phone,
        whatsapp: row.customer_whatsapp,
        zone: row.zone_name,
        governorate: row.governorate,
        street: row.street,
        building: row.building,
        landmark: row.landmark,
        notes: row.customer_notes,
        deliveryFee: Number(row.delivery_fee),
        itemsTotal: Number(row.items_total),
        discountTotal: Number(row.discount_total),
        total: Number(row.grand_total),
        fulfillment: row.fulfillment,
        substitution: row.substitution,
        items: ((row as any).order_items ?? []).map((item: any) => ({
          name: item.product_name as string,
          size: (item.size_label ?? "") as string,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unit_price),
          lineTotal: Number(item.line_total),
          note: (item.note ?? "") as string,
        })),
        createdAt: row.created_at,
      })),
      nextCursor: (rows ?? []).length > limit ? (page.at(-1)?.created_at ?? null) : null,
    };
  });

export const storeAdminUpdateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    storeSlugInput
      .extend({
        token: z.string().min(6).max(60),
        status: z.enum(storeOrderStatuses),
        note: z.string().max(400).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStoreAccess, logStoreActivity } = await import("./store-admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const access = await requireStoreAccess(context.supabase, context.userId, data.storeSlug);

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .update({ status: data.status })
      .eq("token", data.token)
      .eq("store_id", access.storeId)
      .select("id, status")
      .maybeSingle();
    if (error) throw new Error("UPDATE_FAILED");
    if (!order) throw new Error("ORDER_NOT_FOUND");

    await supabaseAdmin.from("order_events").insert({
      order_id: order.id,
      label: `الحالة بقت: ${data.status}`,
      actor: context.claims.email ?? "فريق المتجر",
      is_customer_visible: true,
    });
    if (data.note) {
      await supabaseAdmin.from("order_notes").insert({
        order_id: order.id,
        body: data.note,
        author_name: context.claims.email ?? "فريق المتجر",
      });
    }
    await logStoreActivity(access, context.claims.email ?? "", "order_status", {
      token: data.token,
      status: data.status,
    });
    return { ok: true, status: order.status };
  });

/** كتالوج المتجر: منتجات المنصّة + منتجات المتجر الخاصة، مع تفعيل وتسعير خاص. */
export const storeAdminCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    storeSlugInput
      .extend({
        query: z.string().max(120).optional(),
        onlyEnabled: z.boolean().optional(),
        offset: z.number().int().min(0).max(100000).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStoreAccess } = await import("./store-admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const access = await requireStoreAccess(context.supabase, context.userId, data.storeSlug);

    const limit = data.limit ?? 40;
    const offset = data.offset ?? 0;

    let productQuery = supabaseAdmin
      .from("products")
      .select(
        "id, slug, name, sku, unit, status, owner_store_id, product_variants(price, stock_quantity, active)",
      )
      .or(`owner_store_id.is.null,owner_store_id.eq.${access.storeId}`)
      .eq("status", "published")
      .order("name")
      .range(offset, offset + limit - 1);

    if (data.query) productQuery = productQuery.ilike("name", `%${data.query}%`);

    const { data: products, error } = await productQuery;
    if (error) throw new Error("LOAD_FAILED");

    const ids = (products ?? []).map((p) => p.id);
    const { data: links } = ids.length
      ? await supabaseAdmin
          .from("store_products")
          .select(
            "product_id, enabled, visible, featured, price_override, compare_at_override, stock_override",
          )
          .eq("store_id", access.storeId)
          .in("product_id", ids)
      : { data: [] };

    const linkMap = new Map((links ?? []).map((l) => [l.product_id, l]));

    const items = (products ?? []).map((p) => {
      const link = linkMap.get(p.id);
      const variants = (p.product_variants ?? []).filter((v) => v.active);
      const basePrice = variants.length ? Math.min(...variants.map((v) => Number(v.price))) : 0;
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        sku: p.sku,
        unit: p.unit,
        isPrivate: p.owner_store_id === access.storeId,
        basePrice,
        stock: variants.reduce((sum, v) => sum + (v.stock_quantity ?? 0), 0),
        enabled: link?.["enabled"] ?? false,
        visible: link?.["visible"] ?? true,
        featured: link?.["featured"] ?? false,
        priceOverride:
          link?.["price_override"] === null || link?.["price_override"] === undefined
            ? null
            : Number(link["price_override"]),
        stockOverride: link?.["stock_override"] ?? null,
      };
    });

    return { items, hasMore: (products ?? []).length === limit };
  });

export const storeAdminSetProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    storeSlugInput
      .extend({
        productId: z.string().uuid(),
        enabled: z.boolean().optional(),
        visible: z.boolean().optional(),
        featured: z.boolean().optional(),
        priceOverride: z.number().min(0).max(1000000).nullable().optional(),
        stockOverride: z.number().int().min(0).max(1000000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStoreAccess, logStoreActivity, STORE_ADMIN_ROLES } =
      await import("./store-admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const access = await requireStoreAccess(
      context.supabase,
      context.userId,
      data.storeSlug,
      STORE_ADMIN_ROLES,
    );

    const payload: Record<string, unknown> = {
      store_id: access.storeId,
      product_id: data.productId,
    };
    if (data.enabled !== undefined) payload["enabled"] = data.enabled;
    if (data.visible !== undefined) payload["visible"] = data.visible;
    if (data.featured !== undefined) payload["featured"] = data.featured;
    if (data.priceOverride !== undefined) payload["price_override"] = data.priceOverride;
    if (data.stockOverride !== undefined) payload["stock_override"] = data.stockOverride;

    const { error } = await supabaseAdmin
      .from("store_products")
      .upsert(payload as never, { onConflict: "store_id,product_id" });
    if (error) throw new Error("SAVE_FAILED");

    await logStoreActivity(access, context.claims.email ?? "", "store_product_update", {
      productId: data.productId,
    });
    return { ok: true };
  });

export const storeAdminGetSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => storeSlugInput.parse(input))
  .handler(async ({ data, context }) => {
    const { requireStoreAccess } = await import("./store-admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const access = await requireStoreAccess(context.supabase, context.userId, data.storeSlug);

    const [store, settings, branding, zones, locations] = await Promise.all([
      supabaseAdmin
        .from("stores")
        .select(
          "id, slug, name, description, logo_url, favicon_url, features, address, governorate, phone, whatsapp_number, support_number, business_hours, contact_name, owner_name, plan, status, is_master, is_maintenance, maintenance_message, created_at, updated_at",
        )
        .eq("id", access.storeId)
        .maybeSingle(),
      supabaseAdmin.from("store_settings").select("*").eq("store_id", access.storeId).maybeSingle(),
      supabaseAdmin.from("store_branding").select("*").eq("store_id", access.storeId).maybeSingle(),
      supabaseAdmin
        .from("store_delivery_zones")
        .select("*")
        .eq("store_id", access.storeId)
        .order("sort_order"),
      supabaseAdmin
        .from("locations")
        .select("id, name, type, parent_id")
        .order("name", { ascending: true }),
    ]);

    return {
      role: access.role,
      store: store.data,
      settings: settings.data,
      branding: branding.data,
      zones: zones.data ?? [],
      locations: locations.data ?? [],
    };
  });

export const storeAdminSaveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    storeSlugInput
      .extend({
        name: z.string().min(2).max(120),
        description: z.string().max(600).default(""),
        logoUrl: z.string().url().max(500).nullable().optional(),
        faviconUrl: z.string().url().max(500).nullable().optional(),
        phone: z.string().max(30).default(""),
        whatsappNumber: z.string().max(30).default(""),
        supportNumber: z.string().max(30).default(""),
        contactName: z.string().max(120).default(""),
        address: z.string().max(300).default(""),
        governorate: z.string().max(80).default(""),
        businessHours: z.string().max(200).default(""),
        adminPassword: z.string().min(6).max(100).optional().nullable(),
        isMaintenance: z.boolean().optional(),
        maintenanceMessage: z.string().max(500).optional(),
        planType: z.string().optional(),
        features: z.any().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStoreAccess, logStoreActivity, STORE_ADMIN_ROLES } =
      await import("./store-admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const access = await requireStoreAccess(
      context.supabase,
      context.userId,
      data.storeSlug,
      STORE_ADMIN_ROLES,
    );
    if (access.role !== "platform_owner") {
      const { data: isOwner } = await context.supabase.rpc("pos_has_store_role", {
        _user_id: context.userId,
        _store_id: access.storeId,
        _roles: ["store_owner"],
      });
      if (isOwner !== true) throw new Error("FORBIDDEN");
    }

    const updateData: any = {
      name: data.name,
      description: data.description,
      logo_url: data.logoUrl ?? null,
      favicon_url: data.faviconUrl ?? null,
      phone: data.phone,
      whatsapp_number: data.whatsappNumber,
      support_number: data.supportNumber,
      contact_name: data.contactName,
      address: data.address,
      governorate: data.governorate,
      business_hours: data.businessHours,
      is_maintenance: data.isMaintenance ?? false,
      maintenance_message: data.maintenanceMessage ?? null,
      plan_type: data.planType ?? "basic",
      features: data.features ?? {},
    };

    if (data.adminPassword) {
      const { createHash } = await import("node:crypto");
      updateData.admin_password_hash = createHash("sha256").update(data.adminPassword).digest("hex");
    }

    const { error } = await supabaseAdmin
      .from("stores")
      .update(updateData)
      .eq("id", access.storeId);
    if (error) throw new Error("SAVE_FAILED");

    await logStoreActivity(access, context.claims.email ?? "", "store_profile_update", {});
    return { ok: true };
  });

export const storeAdminSaveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    storeSlugInput
      .extend({
        acceptingOrders: z.boolean(),
        pickupEnabled: z.boolean(),
        codEnabled: z.boolean(),
        onlinePaymentEnabled: z.boolean(),
        contactEmail: z.string().max(160).default(""),
        facebookUrl: z.string().max(300).default(""),
        instagramUrl: z.string().max(300).default(""),
        tiktokUrl: z.string().max(300).default(""),
        orderWhatsappTemplate: z.string().max(2000).default(""),
        substitutionPolicyText: z.string().max(1000).default(""),
        closedMessage: z.string().max(500).default(""),
        privacyText: z.string().max(8000).default(""),
        termsText: z.string().max(8000).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStoreAccess, logStoreActivity, STORE_ADMIN_ROLES } =
      await import("./store-admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const access = await requireStoreAccess(
      context.supabase,
      context.userId,
      data.storeSlug,
      STORE_ADMIN_ROLES,
    );
    if (access.role !== "platform_owner") {
      const { data: isOwner } = await context.supabase.rpc("pos_has_store_role", {
        _user_id: context.userId,
        _store_id: access.storeId,
        _roles: ["store_owner"],
      });
      if (isOwner !== true) throw new Error("FORBIDDEN");
    }

    const { error } = await supabaseAdmin.from("store_settings").upsert(
      {
        store_id: access.storeId,
        accepting_orders: data.acceptingOrders,
        pickup_enabled: data.pickupEnabled,
        cod_enabled: data.codEnabled,
        online_payment_enabled: data.onlinePaymentEnabled,
        contact_email: data.contactEmail,
        facebook_url: data.facebookUrl,
        instagram_url: data.instagramUrl,
        tiktok_url: data.tiktokUrl,
        order_whatsapp_template: data.orderWhatsappTemplate,
        substitution_policy_text: data.substitutionPolicyText,
        closed_message: data.closedMessage,
        privacy_text: data.privacyText,
        terms_text: data.termsText,
      },
      { onConflict: "store_id" },
    );
    if (error) throw new Error("SAVE_FAILED");

    await logStoreActivity(access, context.claims.email ?? "", "store_settings_update", {});
    return { ok: true };
  });

export const storeAdminSaveBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    storeSlugInput
      .extend({
        colors: z.record(z.string(), z.string().max(40)),
        themePreset: z.string().max(60).default("custom"),
        colorMode: z.enum(["light", "dark"]).default("dark"),
        fontFamily: z.string().max(60).default("tajawal"),
        radiusStyle: z.string().max(30).default("rounded"),
        density: z.string().max(30).default("comfortable"),
        headerStyle: z.string().max(30).default("classic"),
        productCardStyle: z.string().max(30).default("classic"),
        heroImageUrl: z.string().url().max(500).nullable().optional(),
        heroTitle: z.string().max(160).default(""),
        heroSubtitle: z.string().max(300).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStoreAccess, logStoreActivity, STORE_ADMIN_ROLES } =
      await import("./store-admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const access = await requireStoreAccess(
      context.supabase,
      context.userId,
      data.storeSlug,
      STORE_ADMIN_ROLES,
    );

    const c = data.colors;
    const { error } = await supabaseAdmin.from("store_branding").upsert(
      {
        store_id: access.storeId,
        ...(c["primary"] ? { primary_color: c["primary"] } : {}),
        ...(c["secondary"] ? { secondary_color: c["secondary"] } : {}),
        ...(c["accent"] ? { accent_color: c["accent"] } : {}),
        ...(c["background"] ? { background_color: c["background"] } : {}),
        ...(c["surface"] ? { surface_color: c["surface"] } : {}),
        ...(c["text"] ? { text_color: c["text"] } : {}),
        ...(c["muted"] ? { muted_color: c["muted"] } : {}),
        ...(c["border"] ? { border_color: c["border"] } : {}),
        ...(c["success"] ? { success_color: c["success"] } : {}),
        ...(c["warning"] ? { warning_color: c["warning"] } : {}),
        ...(c["danger"] ? { danger_color: c["danger"] } : {}),
        theme_preset: data.themePreset,
        color_mode: data.colorMode,
        font_family: data.fontFamily,
        radius_style: data.radiusStyle,
        density: data.density,
        header_style: data.headerStyle,
        product_card_style: data.productCardStyle,
        hero_image_url: data.heroImageUrl ?? null,
        hero_title: data.heroTitle,
        hero_subtitle: data.heroSubtitle,
      },
      { onConflict: "store_id" },
    );
    if (error) throw new Error("SAVE_FAILED");

    await logStoreActivity(access, context.claims.email ?? "", "store_branding_update", {
      preset: data.themePreset,
    });
    return { ok: true };
  });

export const storeAdminSaveZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    storeSlugInput
      .extend({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(120),
        governorate: z.string().max(80).default(""),
        fee: z.number().min(0).max(100000),
        minimumOrder: z.number().min(0).max(1000000).default(0),
        freeDeliveryThreshold: z.number().min(0).max(1000000).nullable().optional(),
        available: z.boolean().default(true),
        sortOrder: z.number().int().min(0).max(9999).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStoreAccess, STORE_ADMIN_ROLES } = await import("./store-admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const access = await requireStoreAccess(
      context.supabase,
      context.userId,
      data.storeSlug,
      STORE_ADMIN_ROLES,
    );

    const row = {
      store_id: access.storeId,
      name: data.name,
      governorate: data.governorate,
      fee: data.fee,
      minimum_order: data.minimumOrder,
      free_delivery_threshold: data.freeDeliveryThreshold ?? null,
      available: data.available,
      sort_order: data.sortOrder,
    };

    const { error } = data.id
      ? await supabaseAdmin
          .from("store_delivery_zones")
          .update(row)
          .eq("id", data.id)
          .eq("store_id", access.storeId)
      : await supabaseAdmin.from("store_delivery_zones").insert(row);
    if (error) throw new Error("SAVE_FAILED");
    return { ok: true };
  });

export const storeAdminDeleteZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => storeSlugInput.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { requireStoreAccess, STORE_ADMIN_ROLES } = await import("./store-admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const access = await requireStoreAccess(
      context.supabase,
      context.userId,
      data.storeSlug,
      STORE_ADMIN_ROLES,
    );
    const { error } = await supabaseAdmin
      .from("store_delivery_zones")
      .delete()
      .eq("id", data.id)
      .eq("store_id", access.storeId);
    if (error) throw new Error("DELETE_FAILED");
    return { ok: true };
  });

/* ----------------------------- فريق المتجر ----------------------------- */

/* ------------------------------ أدوار الفريق ------------------------------ */

/** درجات الفريق الثلاثة: مالك المتجر، مشرف/مدير فرع، كاشير. */
const TEAM_TIERS = {
  owner: { storeRole: "store_admin" as const, posRole: "store_owner" as const },
  manager: { storeRole: "store_admin" as const, posRole: "branch_manager" as const },
  cashier: { storeRole: "store_staff" as const, posRole: "cashier" as const },
};
type TeamTier = keyof typeof TEAM_TIERS;

/** يزامن صلاحية الكاشير (pos_members) مع درجة العضو داخل متجره فقط. */
async function syncPosMember(storeId: string, userId: string, tier: TeamTier) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const posRole = TEAM_TIERS[tier].posRole;
  const { data: existing } = await supabaseAdmin
    .from("pos_members")
    .select("id")
    .eq("store_id", storeId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from("pos_members")
      .update({ role: posRole, is_active: true })
      .eq("id", existing.id);
  } else {
    await supabaseAdmin
      .from("pos_members")
      .insert({ store_id: storeId, user_id: userId, role: posRole, is_active: true });
  }
}

export const storeAdminTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => storeSlugInput.parse(input))
  .handler(async ({ data, context }) => {
    const { requireStoreAccess } = await import("./store-admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const access = await requireStoreAccess(context.supabase, context.userId, data.storeSlug);
    const { data: rows } = await supabaseAdmin
      .from("store_users")
      .select("id, user_id, email, full_name, role, active, created_at")
      .eq("store_id", access.storeId)
      .order("created_at", { ascending: true });

    const { data: posRows } = await supabaseAdmin
      .from("pos_members")
      .select("user_id, role, is_active")
      .eq("store_id", access.storeId);

    const members = (rows ?? []).map((row) => {
      const pos = (posRows ?? []).find((p) => p.user_id === row.user_id);
      const tier: TeamTier =
        pos?.role === "store_owner" ? "owner" : row.role === "store_admin" ? "manager" : "cashier";
      const username = row.email.split(".store-")[0] ?? row.email;
      return { ...row, username, tier, posRole: pos?.role ?? null, posActive: pos?.is_active ?? false };
    });

    return { role: access.role, members };
  });

export const storeAdminAddMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    storeSlugInput
      .extend({
        username: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{2,31}$/),
        fullName: z.string().max(120).default(""),
        tier: z.enum(["owner", "manager", "cashier"]).default("cashier"),
        password: z.string().min(8).max(72),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStoreAccess, logStoreActivity, STORE_ADMIN_ROLES } =
      await import("./store-admin.server");
    const access = await requireStoreAccess(
      context.supabase,
      context.userId,
      data.storeSlug,
      STORE_ADMIN_ROLES,
    );
    if (access.role !== "platform_owner") {
      const { data: isOwner } = await context.supabase.rpc("pos_has_store_role", {
        _user_id: context.userId,
        _store_id: access.storeId,
        _roles: ["store_owner"],
      });
      if (isOwner !== true) throw new Error("FORBIDDEN");
    }

    const { provisionStoreMemberAccount } = await import("./store-session.server");
    const account = await provisionStoreMemberAccount(access.storeId, access.storeSlug, {
      username: data.username,
      password: data.password,
      fullName: data.fullName,
      tier: data.tier,
    });

    await logStoreActivity(access, context.claims.email ?? "", "team_member_upsert", {
      username: data.username,
      tier: data.tier,
    });
    return { ok: true, userId: account.userId };
  });

export const storeAdminUpdateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    storeSlugInput
      .extend({
        id: z.string().uuid(),
        tier: z.enum(["owner", "manager", "cashier"]).optional(),
        active: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStoreAccess, logStoreActivity, STORE_ADMIN_ROLES } =
      await import("./store-admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const access = await requireStoreAccess(
      context.supabase,
      context.userId,
      data.storeSlug,
      STORE_ADMIN_ROLES,
    );
    if (access.role !== "platform_owner") {
      const { data: isOwner } = await context.supabase.rpc("pos_has_store_role", {
        _user_id: context.userId,
        _store_id: access.storeId,
        _roles: ["store_owner"],
      });
      if (isOwner !== true) throw new Error("FORBIDDEN");
    }

    const { data: member } = await supabaseAdmin
      .from("store_users")
      .select("id, user_id")
      .eq("id", data.id)
      .eq("store_id", access.storeId)
      .maybeSingle();
    if (!member) throw new Error("MEMBER_NOT_FOUND");
    if (member.user_id === context.userId && data.active === false)
      throw new Error("CANNOT_DISABLE_SELF");

    const patch: { role?: "store_admin" | "store_staff"; active?: boolean } = {};
    if (data.tier) patch.role = TEAM_TIERS[data.tier].storeRole;
    if (typeof data.active === "boolean") patch.active = data.active;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabaseAdmin.from("store_users").update(patch).eq("id", data.id);
    if (error) throw new Error("SAVE_FAILED");

    if (data.tier) await syncPosMember(access.storeId, member.user_id, data.tier);
    if (data.active === false) {
      await supabaseAdmin
        .from("pos_members")
        .update({ is_active: false })
        .eq("store_id", access.storeId)
        .eq("user_id", member.user_id);
    }
    await logStoreActivity(access, context.claims.email ?? "", "team_member_update", { ...patch });
    return { ok: true };
  });

export const storeAdminRemoveMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => storeSlugInput.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { requireStoreAccess, logStoreActivity, STORE_ADMIN_ROLES } =
      await import("./store-admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const access = await requireStoreAccess(
      context.supabase,
      context.userId,
      data.storeSlug,
      STORE_ADMIN_ROLES,
    );
    if (access.role !== "platform_owner") {
      const { data: isOwner } = await context.supabase.rpc("pos_has_store_role", {
        _user_id: context.userId,
        _store_id: access.storeId,
        _roles: ["store_owner"],
      });
      if (isOwner !== true) throw new Error("FORBIDDEN");
    }
    const { data: member } = await supabaseAdmin
      .from("store_users")
      .select("id, user_id, email")
      .eq("id", data.id)
      .eq("store_id", access.storeId)
      .maybeSingle();
    if (!member) throw new Error("MEMBER_NOT_FOUND");
    if (member.user_id === context.userId) throw new Error("CANNOT_REMOVE_SELF");

    const { error } = await supabaseAdmin.from("store_users").delete().eq("id", data.id);
    if (error) throw new Error("DELETE_FAILED");
    await supabaseAdmin
      .from("pos_members")
      .delete()
      .eq("store_id", access.storeId)
      .eq("user_id", member.user_id);
    await logStoreActivity(access, context.claims.email ?? "", "team_member_remove", {
      email: member.email,
    });
    return { ok: true };
  });

/* ------------------------------ الإعلانات ------------------------------ */

export const storeAdminAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => storeSlugInput.parse(input))
  .handler(async ({ data, context }) => {
    const { requireStoreAccess } = await import("./store-admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const access = await requireStoreAccess(context.supabase, context.userId, data.storeSlug);
    const { data: rows } = await supabaseAdmin
      .from("store_announcements")
      .select("id, content, active, created_at")
      .eq("store_id", access.storeId)
      .order("created_at", { ascending: false })
      .limit(100);
    return { announcements: rows ?? [] };
  });

export const storeAdminSaveAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    storeSlugInput
      .extend({
        id: z.string().uuid().optional(),
        content: z.string().min(2).max(300),
        active: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStoreAccess, logStoreActivity, STORE_ADMIN_ROLES } =
      await import("./store-admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const access = await requireStoreAccess(
      context.supabase,
      context.userId,
      data.storeSlug,
      STORE_ADMIN_ROLES,
    );

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("store_announcements")
        .update({ content: data.content, active: data.active })
        .eq("id", data.id)
        .eq("store_id", access.storeId);
      if (error) throw new Error("SAVE_FAILED");
    } else {
      const { error } = await supabaseAdmin.from("store_announcements").insert({
        store_id: access.storeId,
        content: data.content,
        active: data.active,
      });
      if (error) throw new Error("SAVE_FAILED");
    }
    await logStoreActivity(access, context.claims.email ?? "", "announcement_save", {});
    return { ok: true };
  });

export const storeAdminDeleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => storeSlugInput.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { requireStoreAccess, STORE_ADMIN_ROLES } = await import("./store-admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const access = await requireStoreAccess(
      context.supabase,
      context.userId,
      data.storeSlug,
      STORE_ADMIN_ROLES,
    );
    const { error } = await supabaseAdmin
      .from("store_announcements")
      .delete()
      .eq("id", data.id)
      .eq("store_id", access.storeId);
    if (error) throw new Error("DELETE_FAILED");
    return { ok: true };
  });

/* ------------------------------- التقارير ------------------------------ */

export const storeAdminReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    storeSlugInput.extend({ days: z.number().int().min(7).max(90).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStoreAccess } = await import("./store-admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const access = await requireStoreAccess(context.supabase, context.userId, data.storeSlug);

    const days = data.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    since.setUTCHours(0, 0, 0, 0);

    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, status, grand_total, delivery_fee, created_at, zone_name")
      .eq("store_id", access.storeId)
      .gte("created_at", since.toISOString())
      .limit(5000);

    const rows = orders ?? [];
    const byDay = new Map<string, { orders: number; revenue: number }>();
    const byStatus = new Map<string, number>();
    const byZone = new Map<string, { orders: number; revenue: number }>();

    for (const row of rows) {
      const day = row.created_at.slice(0, 10);
      const total = Number(row.grand_total);
      const dayEntry = byDay.get(day) ?? { orders: 0, revenue: 0 };
      dayEntry.orders += 1;
      if (row.status === "delivered") dayEntry.revenue += total;
      byDay.set(day, dayEntry);

      byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);

      const zoneKey = row.zone_name || "استلام من الفرع";
      const zoneEntry = byZone.get(zoneKey) ?? { orders: 0, revenue: 0 };
      zoneEntry.orders += 1;
      if (row.status === "delivered") zoneEntry.revenue += total;
      byZone.set(zoneKey, zoneEntry);
    }

    const orderIds = rows.map((row) => row.id);
    const topProducts: { name: string; quantity: number; revenue: number }[] = [];
    if (orderIds.length > 0) {
      const { data: items } = await supabaseAdmin
        .from("order_items")
        .select("product_name, quantity, line_total, order_id")
        .in("order_id", orderIds.slice(0, 1000))
        .limit(5000);
      const map = new Map<string, { quantity: number; revenue: number }>();
      for (const item of items ?? []) {
        const entry = map.get(item.product_name) ?? { quantity: 0, revenue: 0 };
        entry.quantity += item.quantity;
        entry.revenue += Number(item.line_total);
        map.set(item.product_name, entry);
      }
      for (const [name, value] of map) topProducts.push({ name, ...value });
      topProducts.sort((a, b) => b.revenue - a.revenue);
    }

    const delivered = rows.filter((row) => row.status === "delivered");
    const revenue = delivered.reduce((sum, row) => sum + Number(row.grand_total), 0);

    return {
      days,
      totals: {
        orders: rows.length,
        delivered: delivered.length,
        cancelled: rows.filter((row) => row.status === "cancelled").length,
        revenue,
        averageOrder: delivered.length > 0 ? revenue / delivered.length : 0,
      },
      daily: [...byDay.entries()]
        .map(([day, value]) => ({ day, ...value }))
        .sort((a, b) => a.day.localeCompare(b.day)),
      statuses: [...byStatus.entries()].map(([status, count]) => ({ status, count })),
      zones: [...byZone.entries()]
        .map(([zone, value]) => ({ zone, ...value }))
        .sort((a, b) => b.orders - a.orders),
      topProducts: topProducts.slice(0, 15),
    };
  });

/** تحقّق حقيقي من الخادم إن الجلسة الحالية مسموح لها بلوحة هذا المتجر بالذات. */
export const storeAdminSessionCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => storeSlugInput.parse(input))
  .handler(async ({ data, context }) => {
    const { requireStoreAccess } = await import("./store-admin.server");
    try {
      const access = await requireStoreAccess(context.supabase, context.userId, data.storeSlug);
      return { ok: true as const, storeSlug: access.storeSlug, role: access.role };
    } catch {
      return { ok: false as const };
    }
  });
