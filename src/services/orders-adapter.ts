import type {
  CartLine,
  CheckoutDraft,
  DeliveryZone,
  Order,
  OrderStatus,
  StoreSettings,
} from "@/domain/types";
import { getAnonymousSessionId } from "@/lib/session";
import {
  createPendingOrder as createPendingOrderFn,
  getOrderTracking,
  markWhatsappLinkOpened,
} from "@/lib/orders.functions";
import { adminListOrders, adminUpdateOrderStatus } from "@/lib/admin-orders.functions";

/**
 * Adapter الطلبات — كله على Supabase عبر server functions.
 * الأسعار والحالة بتتحسب على الخادم، والعميل مجهول بجلسة محلية فقط.
 */

export type CreatePendingOrderInput = {
  draft: CheckoutDraft;
  lines: CartLine[];
  zone: DeliveryZone | null;
  settings: StoreSettings;
  storeSlug?: string | undefined;
};

export type PendingOrderResult = {
  order: Order;
  whatsappUrl: string | null;
  whatsappMessage: string;
};

export const ordersAdapter = {
  async createPendingOrder({
    draft,
    lines,
    storeSlug,
  }: CreatePendingOrderInput): Promise<PendingOrderResult> {
    if (lines.length === 0) throw new Error("EMPTY_CART");

    const result = await createPendingOrderFn({
      data: {
        sessionToken: getAnonymousSessionId(),
        ...(storeSlug ? { storeSlug } : {}),
        draft: {
          firstName: draft.firstName,
          phone: draft.phone,
          whatsapp: draft.whatsapp,
          sameWhatsapp: draft.sameWhatsapp,
          zoneId: draft.fulfillment === "delivery" ? draft.zoneId : "",
          street: draft.street,
          building: draft.building,
          landmark: draft.landmark,
          notes: draft.notes,
          fulfillment: draft.fulfillment,
          substitution: draft.substitution,
          privacyAccepted: true,
        },
        lines: lines.map((line) => ({
          variantId: line.productId,
          quantity: line.quantity,
          ...(line.note ? { note: line.note } : {}),
        })),
      },
    });

    return {
      order: result.order as Order,
      whatsappUrl: result.whatsappUrl,
      whatsappMessage: result.whatsappMessage,
    };
  },

  async markWhatsappOpened(token: string): Promise<void> {
    try {
      await markWhatsappLinkOpened({ data: { token } });
    } catch {
      /* تتبع غير حرج */
    }
  },

  async getOrderByToken(token: string): Promise<Order | null> {
    const tracking = await getOrderTracking({ data: { token } });
    if (!tracking) return null;

    return {
      id: tracking.token,
      token: tracking.token,
      number: tracking.number,
      createdAt: tracking.createdAt,
      status: tracking.status,
      customer: {
        firstName: tracking.firstName,
        phone: tracking.maskedPhone,
        whatsapp: tracking.maskedPhone,
      },
      address: {
        zoneId: "",
        zoneName: tracking.zoneName,
        governorate: "",
        street: "",
        building: "",
        landmark: "",
        notes: "",
      },
      fulfillment: tracking.fulfillment,
      payment: "cod",
      substitution: "call_me" as const,
      lines: tracking.lines.map((line) => ({
        productId: line.name,
        slug: "",
        name: line.name,
        size: line.size,
        unit: line.unit,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        maxQuantity: line.quantity,
      })),
      totals: tracking.totals,
      events: tracking.events.map((event) => ({ at: event.at, label: event.label, by: "المتجر" })),
      source: "live" as const,
    };
  },

  async listOrders(): Promise<Order[]> {
    return [];
  },

  /** للوحة الإدارة — بيانات كاملة مع دعم التقسيم. */
  async listOrdersForAdmin(options: {
    status?: OrderStatus | "all";
    query?: string;
    offset?: number;
    limit?: number;
  } = {}): Promise<{ orders: Order[]; total: number }> {
    const result = await adminListOrders({ data: options });
    const orders = result.orders.map((row: any) => ({
      id: row.token,
      token: row.token,
      number: row.order_number,
      createdAt: row.created_at,
      status: row.status as OrderStatus,
      customer: {
        firstName: row.customer_first_name,
        phone: row.customer_phone,
        whatsapp: row.customer_phone,
      },
      address: {
        zoneId: "",
        zoneName: row.zone_name,
        governorate: "",
        street: "",
        building: "",
        landmark: "",
        notes: "",
      },
      fulfillment: row.fulfillment,
      payment: "cod" as const,
      substitution: "call_me" as const,
      lines: (row.order_items ?? []).map((item: any) => ({
        productId: item.product_name,
        slug: "",
        name: item.product_name,
        size: item.size_label,
        unit: "piece" as const,
        unitPrice: Number(item.unit_price),
        quantity: item.quantity,
        maxQuantity: item.quantity,
      })),
      totals: {
        itemsTotal: Number(row.items_total),
        discountTotal: Number(row.discount_total),
        deliveryFee: Number(row.delivery_fee),
        grandTotal: Number(row.grand_total),
        freeDeliveryRemaining: null,
      },
      events: [],
      source: "live" as const,
    }));

    return { orders, total: result.total };
  },

  async getOrderForAdmin(token: string): Promise<Order | null> {
    const result = await this.listOrdersForAdmin({ query: token, limit: 1 });
    return result.orders.find((order) => order.token === token) ?? null;
  },

  async updateStatus(token: string, status: OrderStatus, reason?: string): Promise<Order | null> {
    await adminUpdateOrderStatus({
      data: { token, status, ...(reason ? { note: reason } : {}) },
    });
    const result = await this.listOrdersForAdmin({ query: token, limit: 1 });
    return result.orders.find((order) => order.token === token) ?? null;
  },

  /** أحداث واجهة غير حساسة — بتتجاهل بدون تخزين بيانات شخصية. */
  trackUiEvent(_name: string, _payload?: Record<string, string | number>) {
    void _name;
    void _payload;
  },
};
