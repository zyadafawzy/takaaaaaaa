import type { Order, OrderStatus } from "@/domain/types";

export const orderStatusLabels: Record<OrderStatus, string> = {
  new: "جديد",
  awaiting_whatsapp: "بانتظار واتساب",
  needs_call: "محتاج اتصال",
  preparing: "بنجهّز",
  out_for_delivery: "خارج للتوصيل",
  delivered: "اتسلّم",
  cancelled: "اتلغى",
};

export const orderStatusOrder: OrderStatus[] = [
  "new",
  "awaiting_whatsapp",
  "needs_call",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

/** الانتقالات المسموح بها في الواجهة. الخادم هيتحقق منها كمان في الأمر الثاني. */
const transitions: Record<OrderStatus, OrderStatus[]> = {
  new: ["awaiting_whatsapp", "needs_call", "preparing", "cancelled"],
  awaiting_whatsapp: ["needs_call", "preparing", "cancelled"],
  needs_call: ["preparing", "cancelled"],
  preparing: ["out_for_delivery", "needs_call", "cancelled"],
  out_for_delivery: ["delivered", "needs_call", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return transitions[from].includes(to);
}

export function nextActions(status: OrderStatus): OrderStatus[] {
  return transitions[status];
}

/** الطلب محتاج مكالمة لو العنوان ناقص أو الحالة تقول كده. */
export function needsCall(order: Order): boolean {
  if (order.status === "needs_call") return true;
  if (order.fulfillment === "pickup") return false;
  return !order.address.street.trim() || !order.address.building.trim();
}

export function isActionable(order: Order): boolean {
  return ["new", "awaiting_whatsapp", "needs_call"].includes(order.status);
}
