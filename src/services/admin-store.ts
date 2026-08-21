import type { Order, OrderStatus } from "@/domain/types";
import { readJson, writeJson } from "@/lib/session";

/**
 * تخزين محلي لتعديلات الإدارة (حالات الطلبات، ملاحظات داخلية، تعديلات المخزون).
 * طبقة مؤقتة بنفس واجهة الخدمة النهائية، عشان الاستبدال بقاعدة بيانات يبقى موضعي.
 */

const ORDER_PATCH_KEY = "tikka.admin.order-patches";
const STOCK_KEY = "tikka.admin.stock-overrides";
const AVAILABILITY_KEY = "tikka.admin.availability-overrides";

type OrderPatch = {
  status?: OrderStatus;
  internalNotes?: string;
  events?: Order["events"];
};

type PatchMap = Record<string, OrderPatch>;

export const adminStore = {
  getOrderPatches(): PatchMap {
    return readJson<PatchMap>(ORDER_PATCH_KEY, {});
  },

  applyPatches(orders: Order[]): Order[] {
    const patches = adminStore.getOrderPatches();
    return orders.map((order) => {
      const patch = patches[order.token];
      if (!patch) return order;
      return {
        ...order,
        status: patch.status ?? order.status,
        internalNotes: patch.internalNotes ?? order.internalNotes,
        events: patch.events ?? order.events,
      };
    });
  },

  updateStatus(order: Order, status: OrderStatus, by: string, label: string): Order {
    const patches = adminStore.getOrderPatches();
    const events = [...(patches[order.token]?.events ?? order.events), { at: new Date().toISOString(), label, by }];
    patches[order.token] = { ...patches[order.token], status, events };
    writeJson(ORDER_PATCH_KEY, patches);
    return { ...order, status, events };
  },

  saveInternalNotes(order: Order, internalNotes: string): Order {
    const patches = adminStore.getOrderPatches();
    patches[order.token] = { ...patches[order.token], internalNotes };
    writeJson(ORDER_PATCH_KEY, patches);
    return { ...order, internalNotes };
  },

  getStockOverrides(): Record<string, number> {
    return readJson<Record<string, number>>(STOCK_KEY, {});
  },

  setStock(productId: string, stock: number): void {
    const map = adminStore.getStockOverrides();
    map[productId] = Math.max(0, Math.round(stock));
    writeJson(STOCK_KEY, map);
  },

  getAvailabilityOverrides(): Record<string, boolean> {
    return readJson<Record<string, boolean>>(AVAILABILITY_KEY, {});
  },

  setAvailability(productId: string, available: boolean): void {
    const map = adminStore.getAvailabilityOverrides();
    map[productId] = available;
    writeJson(AVAILABILITY_KEY, map);
  },
};
