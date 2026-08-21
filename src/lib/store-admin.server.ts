import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type StoreRole = Database["public"]["Enums"]["store_role"];

export const STORE_ADMIN_ROLES: StoreRole[] = ["store_admin"];
export const STORE_ANY_ROLES: StoreRole[] = ["store_admin", "store_staff"];

export type StoreAccess = {
  storeId: string;
  storeSlug: string;
  storeName: string;
  role: StoreRole | "platform_owner";
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * يتحقق أن المستخدم الحالي عضو نشط في هذا السوبرماركت (أو مالك المنصّة).
 * التحقق بيحصل في قاعدة البيانات بدالة محصّنة — مش من المتصفح.
 */
export async function requireStoreAccess(
  supabase: SupabaseClient<Database>,
  userId: string,
  storeSlug: string,
  roles: StoreRole[] = STORE_ANY_ROLES,
): Promise<StoreAccess> {
  const db = await admin();
  const { data: store } = await db
    .from("stores")
    .select("id, slug, name, status")
    .eq("slug", storeSlug)
    .maybeSingle();
  if (!store) throw new Error("STORE_NOT_FOUND");

  const { data: isOwner } = await supabase.rpc("is_platform_owner", {
    _user_id: userId,
  });

  if (isOwner === true) {
    return {
      storeId: store.id,
      storeSlug: store.slug,
      storeName: store.name,
      role: "platform_owner",
    };
  }

  const { data: membership } = await db
    .from("store_users")
    .select("role")
    .eq("store_id", store.id)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();

  if (!membership) {
    const { data: allowed, error } = await supabase.rpc("store_has_role", {
      _user_id: userId,
      _store_id: store.id,
      _roles: roles,
    });
    if (error || allowed !== true) throw new Error("FORBIDDEN");
  }

  return {
    storeId: store.id,
    storeSlug: store.slug,
    storeName: store.name,
    role: (membership?.role as StoreRole | undefined) ?? "platform_owner",
  };
}

export async function logStoreActivity(
  access: StoreAccess,
  actorEmail: string,
  action: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  const db = await admin();
  await db.from("store_activity_log").insert({
    store_id: access.storeId,
    actor_user_id: null,
    actor_email: actorEmail,
    action,
    detail: detail as never,
  });
}

export type StoreDashboard = {
  storeName: string;
  role: string;
  ordersToday: number;
  ordersTotal: number;
  revenueTotal: number;
  pending: number;
  productsEnabled: number;
  zones: number;
};

export async function loadStoreDashboard(access: StoreAccess): Promise<StoreDashboard> {
  const db = await admin();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const [ordersTotal, ordersToday, pending, products, zones, revenue] = await Promise.all([
    db.from("orders").select("id", { count: "exact", head: true }).eq("store_id", access.storeId),
    db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", access.storeId)
      .gte("created_at", startOfDay.toISOString()),
    db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", access.storeId)
      .in("status", ["new", "awaiting_whatsapp", "needs_call", "preparing"]),
    db
      .from("store_products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", access.storeId)
      .eq("enabled", true),
    db
      .from("store_delivery_zones")
      .select("id", { count: "exact", head: true })
      .eq("store_id", access.storeId),
    db
      .from("orders")
      .select("grand_total")
      .eq("store_id", access.storeId)
      .eq("status", "delivered")
      .limit(5000),
  ]);

  return {
    storeName: access.storeName,
    role: access.role,
    ordersTotal: ordersTotal.count ?? 0,
    ordersToday: ordersToday.count ?? 0,
    pending: pending.count ?? 0,
    productsEnabled: products.count ?? 0,
    zones: zones.count ?? 0,
    revenueTotal: (revenue.data ?? []).reduce((sum, row) => sum + Number(row.grand_total), 0),
  };
}
