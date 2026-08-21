import type { Order, StoreSettings } from "@/domain/types";
import { formatPrice } from "./format";

const substitutionLabel: Record<Order["substitution"], string> = {
  substitute: "اختار بديل مناسب",
  call_me: "اتصل بيا",
  remove: "شيل المنتج لو مش موجود",
};

const HR = "─────────────────────";

function formatDateAr(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Africa/Cairo",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

/** يبني نص رسالة التأكيد لـ WhatsApp — تصميم فاخر وكل بيانات العميل كاملة. */
export function buildWhatsAppMessage(order: Order, settings: StoreSettings, followUpUrl: string): string {
  const isPickup = order.fulfillment === "pickup";
  const addr = order.address;

  const productLines = order.lines
    .map((line, index) => {
      const lineTotal = line.quantity * line.unitPrice;
      const nameHasSize = line.size && line.name.includes(line.size);
      const displayName = nameHasSize ? line.name : `${line.name}${line.size ? ` — ${line.size}` : ""}`;
      const rows = [
        `*${index + 1}.* *${displayName}*`,
        `     ▫️ الكمية: *${line.quantity}* × ${formatPrice(line.unitPrice)}`,
        `     ▫️ الإجمالي: *${formatPrice(lineTotal)}*`,
      ];
      if (line.note) rows.push(`     ✏️ ملاحظة: _${line.note}_`);
      return rows.join("\n");
    })
    .join("\n\n");

  const itemsCount = order.lines.reduce((sum, line) => sum + line.quantity, 0);

  const contactBlock = [
    `👤 *الاسم:* ${order.customer.firstName}`,
    `📞 *الموبايل:* ${order.customer.phone}`,
  ];
  if (order.customer.whatsapp && order.customer.whatsapp !== order.customer.phone) {
    contactBlock.push(`💬 *واتساب:* ${order.customer.whatsapp}`);
  }

  const addressBlock: string[] = [];
  if (isPickup) {
    addressBlock.push("🏬 *طريقة الاستلام:* استلام من الفرع");
    if (settings.branchAddress) addressBlock.push(`📍 *الفرع:* ${settings.branchAddress}`);
    if (settings.openingHours) addressBlock.push(`🕒 *مواعيد العمل:* ${settings.openingHours}`);
  } else {
    addressBlock.push("🚚 *طريقة الاستلام:* توصيل للعنوان");
    if (addr.governorate) addressBlock.push(`🗺️ *المحافظة:* ${addr.governorate}`);
    if (addr.zoneName) addressBlock.push(`📌 *المنطقة:* ${addr.zoneName}`);
    if (addr.street) addressBlock.push(`🛣️ *الشارع:* ${addr.street}`);
    if (addr.building) addressBlock.push(`🏠 *رقم البيت/الشقة:* ${addr.building}`);
    if (addr.landmark) addressBlock.push(`🧭 *علامة مميزة:* ${addr.landmark}`);
  }

  const notesBlock: string[] = [];
  if (addr.notes) {
    notesBlock.push("", HR, "", "📝 *ملاحظات التسليم*", "", `_${addr.notes}_`);
  }

  const createdAt = formatDateAr(order.createdAt);

  const parts = [
    "╭───────────────╮",
    `   🛒 *${settings.storeName}*`,
    "   *طلب جديد بانتظار التأكيد*",
    "╰───────────────╯",
    "",
    `🔖 *رقم الطلب:* \`\`\`${order.number}\`\`\``,
    createdAt ? `🗓️ *وقت الطلب:* ${createdAt}` : "",
    "",
    HR,
    "",
    "👤 *بيانات العميل*",
    "",
    ...contactBlock,
    "",
    HR,
    "",
    `🧺 *الأصناف* (${order.lines.length} صنف · ${itemsCount} قطعة)`,
    "",
    productLines,
    "",
    HR,
    "",
    "💰 *ملخص الحساب*",
    "",
    `🧾 إجمالي المنتجات: *${formatPrice(order.totals.itemsTotal)}*`,
    order.totals.discountTotal > 0 ? `🎁 الخصم: *- ${formatPrice(order.totals.discountTotal)}*` : "",
    `🚚 رسوم التوصيل: *${order.totals.deliveryFee > 0 ? formatPrice(order.totals.deliveryFee) : "مجانًا 🎉"}*`,
    "",
    `💳 *الإجمالي النهائي:* *${formatPrice(order.totals.grandTotal)}*`,
    `💵 *طريقة الدفع:* كاش عند الاستلام`,
    "",
    HR,
    "",
    "📍 *بيانات التسليم*",
    "",
    ...addressBlock,
    "",
    `🔄 *لو صنف مش موجود:* ${substitutionLabel[order.substitution]}`,
    ...notesBlock,
    "",
    HR,
    "",
    "🔎 *متابعة الطلب:*",
    followUpUrl,
    "",
    `🌿 شكرًا لاختيارك *${settings.storeName}* — هنراجع الطلب ونرد عليك حالًا.`,
  ];

  return parts
    .filter((part, i, all) => {
      if (part !== "") return true;
      if (i === 0 || i === all.length - 1) return false;
      return all[i - 1] !== "";
    })
    .join("\n");
}

export function buildWhatsAppUrl(phoneNumber: string, message: string): string {
  const digits = phoneNumber.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** رسالة تحديث للعميل يستخدمها المشغل بالنسخ — من غير أي ادعاء بالإرسال. */
export function buildOperatorUpdateMessage(order: Order, storeName: string): string {
  const statusText: Record<Order["status"], string> = {
    new: "استلمنا طلبك وبنراجعه. 📦",
    awaiting_whatsapp: "لسه مستنيين تأكيدك على واتساب. 💬",
    needs_call: "محتاجين نكلمك بخصوص الطلب. 📞",
    preparing: "بنجهّز طلبك دلوقتي. 🏗️",
    out_for_delivery: "طلبك خرج للتوصيل. 🚚",
    delivered: "طلبك اتسلّم. شكرًا لك. ✅",
    cancelled: "طلبك اتلغى. ❌",
  };

  return [
    `✨ *تحديث من ${storeName}*`,
    "",
    `🔖 *رقم الطلب:* \`\`\`${order.number}\`\`\``,
    `🔔 *الحالة:* ${statusText[order.status]}`,
    "",
    `💰 *الإجمالي:* *${formatPrice(order.totals.grandTotal)}*`,
    "",
    "شكرًا لاختيارك تِكّة 🌿",
  ]
    .filter((p) => p !== undefined)
    .join("\n");
}
