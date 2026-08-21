import type { Order } from "@/domain/types";

/** طلبات تجريبية للوحة الإدارة — موسومة demo ولا تمثل بيانات حقيقية. */

const base = (over: Partial<Order> & Pick<Order, "id" | "token" | "number" | "status" | "createdAt">): Order => ({
  customer: { firstName: "عميل تجريبي", phone: "01000000001", whatsapp: "01000000001" },
  address: {
    zoneId: "z1",
    zoneName: "مدينة نصر",
    governorate: "القاهرة",
    street: "شارع مصطفى النحاس",
    building: "12 / شقة 3",
    landmark: "جنب الصيدلية",
    notes: "",
  },
  fulfillment: "delivery",
  payment: "cod",
  substitution: "substitute",
  lines: [
    { productId: "p1", slug: "tamatem-baladi", name: "طماطم بلدي", size: "1 كجم", unit: "kg", unitPrice: 18.5, quantity: 2, maxQuantity: 20 },
    { productId: "p9", slug: "laban-kamel-dasm", name: "لبن كامل الدسم", size: "1 لتر", unit: "liter", unitPrice: 42, quantity: 1, maxQuantity: 20 },
  ],
  totals: { itemsTotal: 79, discountTotal: 7, deliveryFee: 25, grandTotal: 104, freeDeliveryRemaining: 221 },
  events: [{ at: over.createdAt, label: "اتسجل الطلب مبدئيًا", by: "العميل" }],
  source: "demo",
  ...over,
});

export const demoOrders: Order[] = [
  base({ id: "d1", token: "demo1", number: "TK-0901", status: "awaiting_whatsapp", createdAt: "2026-08-13T06:10:00.000Z" }),
  base({
    id: "d2",
    token: "demo2",
    number: "TK-0902",
    status: "needs_call",
    createdAt: "2026-08-13T05:40:00.000Z",
    address: {
      zoneId: "z2",
      zoneName: "المعادي",
      governorate: "القاهرة",
      street: "شارع 9",
      building: "",
      landmark: "",
      notes: "العنوان ناقص رقم الشقة",
    },
  }),
  base({ id: "d3", token: "demo3", number: "TK-0903", status: "preparing", createdAt: "2026-08-13T05:05:00.000Z" }),
  base({ id: "d4", token: "demo4", number: "TK-0904", status: "out_for_delivery", createdAt: "2026-08-12T18:20:00.000Z" }),
  base({ id: "d5", token: "demo5", number: "TK-0905", status: "delivered", createdAt: "2026-08-12T15:00:00.000Z" }),
  base({ id: "d6", token: "demo6", number: "TK-0906", status: "cancelled", createdAt: "2026-08-12T12:30:00.000Z" }),
  base({ id: "d7", token: "demo7", number: "TK-0907", status: "new", createdAt: "2026-08-13T06:55:00.000Z" }),
];
