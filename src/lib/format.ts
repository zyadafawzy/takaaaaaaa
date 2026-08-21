/** تنسيق موحّد للأسعار والأرقام — قرار تصميم واحد ثابت: أرقام لاتينية + "ج.م". */

export const CURRENCY = "ج.م";

export function formatPrice(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(2)} ${CURRENCY}`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-EG").format(value);
}

/** نسبة الخصم محسوبة من السعرين، لا تُكتب يدويًا أبدًا. */
export function discountPercent(price: number, compareAtPrice?: number | null): number | null {
  if (!compareAtPrice || compareAtPrice <= price || price <= 0) return null;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

export function formatDateTimeAr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
