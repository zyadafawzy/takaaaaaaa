import type { CartLine, DeliveryZone, OrderTotals } from "@/domain/types";

export const MAX_LINE_QUANTITY = 20;

/** يحصر الكمية بين 1 والحد الأقصى المتاح (المخزون أو السقف العام). */
export function clampQuantity(quantity: number, maxQuantity: number): number {
  const ceiling = Math.max(0, Math.min(maxQuantity, MAX_LINE_QUANTITY));
  if (ceiling === 0) return 0;
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(Math.max(1, Math.trunc(quantity)), ceiling);
}

export function lineTotal(line: CartLine): number {
  return round2(line.unitPrice * line.quantity);
}

export function itemsSubtotal(lines: CartLine[]): number {
  return round2(lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0));
}

/** الخصم = فرق السعر قبل الخصم، محسوب لا مكتوب. */
export function discountTotal(lines: CartLine[]): number {
  return round2(
    lines.reduce((sum, line) => {
      if (!line.compareAtPrice || line.compareAtPrice <= line.unitPrice) return sum;
      return sum + (line.compareAtPrice - line.unitPrice) * line.quantity;
    }, 0),
  );
}

export function computeTotals(lines: CartLine[], zone?: DeliveryZone | null): OrderTotals {
  const itemsTotal = itemsSubtotal(lines);
  const discount = discountTotal(lines);

  let deliveryFee = 0;
  let freeDeliveryRemaining: number | null = null;

  if (zone) {
    const threshold = zone.freeDeliveryThreshold;
    if (threshold != null && itemsTotal >= threshold) {
      deliveryFee = 0;
    } else {
      deliveryFee = zone.fee;
      if (threshold != null) freeDeliveryRemaining = round2(threshold - itemsTotal);
    }
  }

  return {
    itemsTotal,
    discountTotal: discount,
    deliveryFee,
    grandTotal: round2(itemsTotal + deliveryFee),
    freeDeliveryRemaining,
  };
}

export function meetsMinimum(itemsTotal: number, zone?: DeliveryZone | null): boolean {
  if (!zone) return true;
  return itemsTotal >= zone.minimumOrder;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
