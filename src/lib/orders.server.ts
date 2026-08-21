import type { Order, OrderStatus, SellUnit, StoreSettings } from "@/domain/types";
import { computeTotals } from "./pricing";
import { buildWhatsAppMessage, buildWhatsAppUrl } from "./whatsapp";
import { priceLines } from "./cart.server";
import { createPublicServerClient } from "./supabase-public.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function randomToken(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export type CreateOrderInput = {
  sessionToken: string;
  origin: string;
  draft: {
    firstName: string;
    phone: string;
    whatsapp: string;
    sameWhatsapp: boolean;
    zoneId: string;
    street: string;
    building: string;
    landmark: string;
    notes: string;
    fulfillment: "delivery" | "pickup";
    substitution: "substitute" | "call_me" | "remove";
  };
  lines: Array<{ variantId: string; quantity: number; note?: string | undefined }>;
  /** لو الطلب جاي من سوبرماركت مستقل — كل بياناته وإعداداته بتبقى بتاعته. */
  storeSlug?: string | undefined;
};

/** إعدادات سوبرماركت مستقل — بتُستخدم في رسالة واتساب وقواعد الطلب. */
async function loadTenantContext(slug: string): Promise<{
  storeId: string;
  settings: StoreSettings;
} | null> {
  const supabase = createPublicServerClient();
  const { data: store } = await supabase
    .from("stores")
    .select("id, name, whatsapp_number, phone, address, business_hours")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!store) return null;

  const [{ data: settingsRow }, { data: announcement }] = await Promise.all([
    supabase.from("store_settings").select("*").eq("store_id", store.id).maybeSingle(),
    supabase
      .from("store_announcements")
      .select("content")
      .eq("store_id", store.id)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const row = (settingsRow ?? {}) as Record<string, unknown>;

  return {
    storeId: store.id,
    settings: {
      storeName: store.name,
      whatsappNumber: store.whatsapp_number ?? "",
      openingHours: store.business_hours ?? "",
      branchAddress: store.address ?? "",
      acceptingOrders: row["accepting_orders"] !== false,
      pickupEnabled: row["pickup_enabled"] === true,
      substitutionPolicyText: String(row["substitution_policy_text"] ?? ""),
      announcement: announcement?.content ?? "",
      currency: String(row["default_currency"] ?? "ج.م"),
      source: "live",
    },
  };
}

async function loadStoreSettings(): Promise<StoreSettings> {
  const supabase = createPublicServerClient();
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .eq("key", "store")
    .maybeSingle();
  const raw = (data?.value ?? {}) as Record<string, unknown>;
  return {
    storeName: String(raw["storeName"] ?? "تِكّة"),
    whatsappNumber: String(raw["whatsappNumber"] ?? ""),
    openingHours: String(raw["openingHours"] ?? ""),
    branchAddress: String(raw["branchAddress"] ?? ""),
    acceptingOrders: raw["acceptingOrders"] !== false,
    pickupEnabled: raw["pickupEnabled"] === true,
    substitutionPolicyText: String(raw["substitutionPolicyText"] ?? ""),
    announcement: String(raw["announcement"] ?? ""),
    currency: "ج.م",
    source: "live",
  };
}

/**
 * create_pending_order — بينشئ الطلب في Supabase بأسعار الخادم،
 * وبيرجّع رسالة مرتبة ورابط wa.me فقط. فتح واتساب ≠ تأكيد الطلب.
 */
export async function createPendingOrderServer(input: CreateOrderInput): Promise<{
  order: Order;
  whatsappUrl: string | null;
  whatsappMessage: string;
  trackingPath: string;
}> {
  const supabase = await admin();
  const tenant = input.storeSlug ? await loadTenantContext(input.storeSlug) : null;
  if (input.storeSlug && !tenant) throw new Error("STORE_NOT_FOUND");
  const settings = tenant ? tenant.settings : await loadStoreSettings();
  if (!settings.acceptingOrders) throw new Error("STORE_CLOSED");

  const { lines } = await priceLines(input.lines);
  if (lines.length === 0) throw new Error("EMPTY_CART");

  let zone: {
    id: string;
    name: string;
    governorate: string;
    fee: number;
    minimumOrder: number;
    freeDeliveryThreshold: number | null;
    available: boolean;
    source: "live";
  } | null = null;

  if (input.draft.fulfillment === "delivery") {
    const { data } = tenant
      ? await supabase
          .from("store_delivery_zones")
          .select("id, name, governorate, fee, minimum_order, free_delivery_threshold, available")
          .eq("id", input.draft.zoneId)
          .eq("store_id", tenant.storeId)
          .eq("available", true)
          .maybeSingle()
      : await supabase
          .from("delivery_zones")
          .select("id, name, governorate, fee, minimum_order, free_delivery_threshold, available")
          .eq("id", input.draft.zoneId)
          .eq("available", true)
          .maybeSingle();
    if (!data) throw new Error("ZONE_UNAVAILABLE");
    zone = {
      id: data.id,
      name: data.name,
      governorate: data.governorate,
      fee: Number(data.fee),
      minimumOrder: Number(data.minimum_order),
      freeDeliveryThreshold:
        data.free_delivery_threshold == null ? null : Number(data.free_delivery_threshold),
      available: true,
      source: "live",
    };
  }

  const totals = computeTotals(lines, zone);
  if (zone && totals.itemsTotal < zone.minimumOrder) throw new Error("BELOW_MINIMUM");

  const token = randomToken();
  const whatsapp = input.draft.sameWhatsapp ? input.draft.phone : input.draft.whatsapp;

  // ترقيم مستقل لكل سوبرماركت (كل متجر يبدأ من ١ ببادئة اسمه).
  let orderNumber: string | null = null;
  try {
    const numbered = await (supabase as any).rpc("next_order_number", {
      _store_id: tenant?.storeId ?? null,
    });
    if (!numbered.error && typeof numbered.data === "string") orderNumber = numbered.data;
  } catch {
    orderNumber = null;
  }

  const inserted = await supabase
    .from("orders")
    .insert({
      token,
      ...(orderNumber ? { order_number: orderNumber } : {}),
      store_id: tenant?.storeId ?? null,
      status: "awaiting_whatsapp" as OrderStatus,
      customer_first_name: input.draft.firstName,
      customer_phone: input.draft.phone,
      customer_whatsapp: whatsapp,
      // مناطق المتاجر المستقلة في جدول تاني، فالمفتاح الأجنبي هنا للمناطق العامة بس.
      zone_id: tenant ? null : (zone?.id ?? null),
      zone_name: zone?.name ?? "",
      governorate: zone?.governorate ?? "",
      street: input.draft.street,
      building: input.draft.building,
      landmark: input.draft.landmark,
      customer_notes: input.draft.notes,
      fulfillment: input.draft.fulfillment,
      payment: "cod",
      substitution: input.draft.substitution,
      items_total: totals.itemsTotal,
      discount_total: totals.discountTotal,
      delivery_fee: totals.deliveryFee,
      grand_total: totals.grandTotal,
    })
    .select("id, token, order_number, created_at, status")
    .single();

  if (inserted.error || !inserted.data) {
    console.error("[orders] insert failed", inserted.error);
    throw new Error("ORDER_CREATE_FAILED");
  }

  await supabase.from("order_items").insert(
    lines.map((line) => ({
      order_id: inserted.data.id,
      variant_id: line.productId,
      product_name: line.name,
      product_slug: line.slug,
      size_label: line.size,
      unit: line.unit,
      unit_price: line.unitPrice,
      compare_at_price: line.compareAtPrice ?? null,
      quantity: line.quantity,
      line_total: Number((line.unitPrice * line.quantity).toFixed(2)),
      note: line.note ?? "",
    })),
  );

  await supabase.from("order_events").insert({
    order_id: inserted.data.id,
    label: "اتسجل الطلب مبدئيًا — مستني تأكيد واتساب",
    actor: "العميل",
  });

  const order: Order = {
    id: inserted.data.id,
    token: inserted.data.token,
    number: inserted.data.order_number,
    createdAt: inserted.data.created_at,
    status: "awaiting_whatsapp",
    customer: { firstName: input.draft.firstName, phone: input.draft.phone, whatsapp },
    address: {
      zoneId: zone?.id ?? "",
      zoneName: zone?.name ?? "",
      governorate: zone?.governorate ?? "",
      street: input.draft.street,
      building: input.draft.building,
      landmark: input.draft.landmark,
      notes: input.draft.notes,
    },
    fulfillment: input.draft.fulfillment,
    payment: "cod",
    substitution: input.draft.substitution,
    lines,
    totals,
    events: [{ at: inserted.data.created_at, label: "اتسجل الطلب مبدئيًا", by: "العميل" }],
    source: "live",
  };

  const trackingPath = input.storeSlug
    ? `/s/${input.storeSlug}/order/${order.token}`
    : `/order/pending/${order.token}`;
  const followUpUrl = input.storeSlug
    ? `${input.origin.replace(/\/$/, "")}/s/${input.storeSlug}/track/${order.token}`
    : `${input.origin.replace(/\/$/, "")}/track/${order.token}`;
  const whatsappMessage = buildWhatsAppMessage(order, settings, followUpUrl);
  const whatsappUrl = settings.whatsappNumber
    ? buildWhatsAppUrl(settings.whatsappNumber, whatsappMessage)
    : null;

  return { order, whatsappUrl, whatsappMessage, trackingPath };
}

/** mark_whatsapp_link_opened — بيسجّل إن الرابط اتفتح فقط، مش إن الرسالة اتبعتت. */
export async function markWhatsappOpenedServer(token: string): Promise<{ ok: boolean }> {
  const supabase = await admin();
  const { data } = await supabase
    .from("orders")
    .select("id, whatsapp_link_opened_at")
    .eq("token", token)
    .maybeSingle();
  if (!data) return { ok: false };
  if (data.whatsapp_link_opened_at) return { ok: true };

  await supabase
    .from("orders")
    .update({ whatsapp_link_opened_at: new Date().toISOString() })
    .eq("id", data.id);
  await supabase.from("order_events").insert({
    order_id: data.id,
    label: "العميل فتح رابط واتساب (مش تأكيد إرسال)",
    actor: "النظام",
  });
  return { ok: true };
}

export type PublicOrderTracking = {
  number: string;
  token: string;
  createdAt: string;
  status: OrderStatus;
  firstName: string;
  maskedPhone: string;
  fulfillment: "delivery" | "pickup";
  zoneName: string;
  totals: Order["totals"];
  lines: Array<{ name: string; size: string; unit: SellUnit; quantity: number; unitPrice: number }>;
  events: Array<{ at: string; label: string }>;
};

/** get_order_tracking — بيانات متابعة محدودة بالتوكن فقط، بدون بيانات حساسة. */
export async function getOrderTrackingServer(token: string): Promise<PublicOrderTracking | null> {
  const supabase = await admin();
  const { data } = await supabase
    .from("orders")
    .select(
      `id, token, order_number, created_at, status, customer_first_name, customer_phone,
       fulfillment, zone_name, items_total, discount_total, delivery_fee, grand_total,
       order_items ( product_name, size_label, unit, quantity, unit_price ),
       order_events ( label, created_at, is_customer_visible )`,
    )
    .eq("token", token)
    .maybeSingle();

  if (!data) return null;

  const phone = data.customer_phone;
  return {
    number: data.order_number,
    token: data.token,
    createdAt: data.created_at,
    status: data.status,
    firstName: data.customer_first_name,
    maskedPhone: phone.length > 4 ? `${"*".repeat(phone.length - 4)}${phone.slice(-4)}` : "****",
    fulfillment: data.fulfillment,
    zoneName: data.zone_name,
    totals: {
      itemsTotal: Number(data.items_total),
      discountTotal: Number(data.discount_total),
      deliveryFee: Number(data.delivery_fee),
      grandTotal: Number(data.grand_total),
      freeDeliveryRemaining: null,
    },
    lines: (data.order_items ?? []).map((item) => ({
      name: item.product_name,
      size: item.size_label,
      unit: item.unit as SellUnit,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
    })),
    events: (data.order_events ?? [])
      .filter((event) => event.is_customer_visible)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((event) => ({ at: event.created_at, label: event.label })),
  };
}

/**
 * get_order_whatsapp — بيعيد بناء رسالة واتساب كاملة من الطلب المحفوظ بالتوكن،
 * بكل بيانات العنوان وملاحظات التسليم (التوكن سري وبيوصل للعميل بس).
 */
export async function getOrderWhatsappServer(
  token: string,
  origin: string,
): Promise<{ message: string; url: string | null; number: string } | null> {
  const supabase = await admin();
  const settings = await loadStoreSettings();

  const { data } = await supabase
    .from("orders")
    .select(
      `id, token, order_number, created_at, status, customer_first_name, customer_phone,
       customer_whatsapp, fulfillment, substitution, zone_name, governorate, street,
       building, landmark, customer_notes, items_total, discount_total, delivery_fee,
       grand_total,
       order_items ( product_name, product_slug, size_label, unit, quantity, unit_price, note )`,
    )
    .eq("token", token)
    .maybeSingle();

  if (!data) return null;

  const order: Order = {
    id: data.id,
    token: data.token,
    number: data.order_number,
    createdAt: data.created_at,
    status: data.status,
    customer: {
      firstName: data.customer_first_name,
      phone: data.customer_phone,
      whatsapp: data.customer_whatsapp,
    },
    address: {
      zoneId: "",
      zoneName: data.zone_name,
      governorate: data.governorate,
      street: data.street,
      building: data.building,
      landmark: data.landmark,
      notes: data.customer_notes,
    },
    fulfillment: data.fulfillment,
    payment: "cod",
    substitution: data.substitution,
    lines: (data.order_items ?? []).map((item) => ({
      productId: item.product_slug || item.product_name,
      slug: item.product_slug,
      name: item.product_name,
      size: item.size_label,
      unit: item.unit as SellUnit,
      unitPrice: Number(item.unit_price),
      quantity: item.quantity,
      maxQuantity: item.quantity,
      ...(item.note ? { note: item.note } : {}),
    })),
    totals: {
      itemsTotal: Number(data.items_total),
      discountTotal: Number(data.discount_total),
      deliveryFee: Number(data.delivery_fee),
      grandTotal: Number(data.grand_total),
      freeDeliveryRemaining: null,
    },
    events: [],
    source: "live",
  };

  const followUpUrl = `${origin.replace(/\/$/, "")}/track/${order.token}`;
  const message = buildWhatsAppMessage(order, settings, followUpUrl);
  const url = settings.whatsappNumber ? buildWhatsAppUrl(settings.whatsappNumber, message) : null;

  return { message, url, number: order.number };
}
