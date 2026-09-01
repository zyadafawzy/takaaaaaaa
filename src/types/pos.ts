/** أنواع نقاط البيع (الكاشير) — تِكّة. */

export type PosRole = "store_owner" | "branch_manager" | "cashier" | "inventory_clerk" | "viewer";

export const POS_ROLE_LABELS: Record<PosRole, string> = {
  store_owner: "صاحب المتجر",
  branch_manager: "مدير فرع",
  cashier: "كاشير",
  inventory_clerk: "أمين مخزن",
  viewer: "مشاهد تقارير",
};

export type PosMembership = {
  storeId: string;
  storeName: string;
  storeSlug: string;
  branchId: string | null;
  role: PosRole;
};

export type PosBranch = {
  id: string;
  storeId: string;
  name: string;
  address: string;
  phone: string;
  allowNegativeStock: boolean;
  isActive: boolean;
};

export type PosPaymentMethod = {
  id: string;
  name: string;
  type: "cash" | "card" | "wallet" | "credit" | "other";
};

export type PosShift = {
  id: string;
  storeId: string;
  branchId: string | null;
  openedAt: string;
  openingAmount: number;
  status: "open" | "closed" | "suspended";
};

export type PosScanHit = {
  found: true;
  barcode: string;
  variantId: string;
  productId: string;
  productName: string;
  unitLabel: string;
  sellPrice: number;
  costPrice: number | null;
  stock: number;
};

export type PosScanMiss = { found: false; barcode: string };
export type PosScanResult = PosScanHit | PosScanMiss;

export type PosCartLine = {
  variantId: string;
  productId: string;
  productName: string;
  unitLabel: string;
  sellPrice: number;
  costPrice: number | null;
  qty: number;
  discountPct: number;
  barcode: string | null;
  stock: number;
};

export type PosCustomer = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  balance: number;
  points: number;
};

export type PosInvoiceSummary = {
  id: string;
  invoiceNumber: string;
  total: number;
  paidAmount: number;
  status: "draft" | "confirmed" | "voided" | "refunded";
  createdAt: string;
  customerName: string | null;
  itemsCount: number;
};

export type PosInvoiceFull = PosInvoiceSummary & {
  storeId: string;
  branchName: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  changeAmount: number;
  voidReason: string | null;
  items: Array<{
    id: string;
    productName: string;
    unitLabel: string;
    sellPrice: number;
    qty: number;
    discountPct: number;
    lineTotal: number;
  }>;
  payments: Array<{ id: string; methodName: string; amount: number }>;
};

export function lineTotal(line: { sellPrice: number; qty: number; discountPct: number }): number {
  const gross = line.sellPrice * line.qty;
  const net = gross * (1 - (line.discountPct || 0) / 100);
  return Math.round(net * 100) / 100;
}

/** سطر صنف غير مسجّل في السلة — بيتباع بسعر يدوي. */
export type PosUnknownLine = {
  barcode: string;
  name: string;
  sellPrice: number;
  qty: number;
  unitLabel: string;
};

export type PosHeldInvoice = {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  itemsCount: number;
  total: number;
  customerId: string | null;
};

export type PosUnknownGroup = {
  barcode: string;
  times: number;
  totalQty: number;
  totalValue: number;
  lastPrice: number | null;
  names: string[];
  lastScannedAt: string;
  invoicesCount: number;
  resolved: boolean;
  unitLabel: string;
};

export function unknownLineTotal(line: PosUnknownLine): number {
  return Math.round(line.sellPrice * line.qty * 100) / 100;
}
