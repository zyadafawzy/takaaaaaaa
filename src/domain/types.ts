/** أنواع الدومين لتطبيق تِكّة. مصدر واحد للحقيقة عبر الواجهة كلها. */

export type SellUnit = "piece" | "kg" | "pack" | "bundle" | "liter";

export type DataSource = "demo" | "live";

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  source: DataSource;
};

export type Brand = {
  id: string;
  name: string;
};

export type Variant = {
  id: string;
  size: string;
  price: number;
  compareAtPrice?: number | null | undefined;
  stock: number;
};

export type Product = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  brand: string;
  description: string;
  categorySlug: string;
  size: string;
  unit: SellUnit;
  price: number;
  compareAtPrice?: number | null | undefined;
  stock: number;
  available: boolean;
  isFresh: boolean;
  isFeatured: boolean;
  featuredUntil?: string | null | undefined;
  offerUntil?: string | null | undefined;
  images: string[];
  thumbnailUrl?: string | null | undefined;
  imageCount?: number | undefined;
  variants?: Variant[] | undefined;
  complements?: string[] | undefined;
  source: DataSource;
};

export type SubstitutionPolicy = "substitute" | "call_me" | "remove";

export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  size: string;
  unit: SellUnit;
  unitPrice: number;
  compareAtPrice?: number | null | undefined;
  image?: string | undefined;
  quantity: number;
  note?: string | undefined;
  maxQuantity: number;
};

export type Cart = {
  sessionId: string;
  lines: CartLine[];
  updatedAt: string;
};

export type DeliveryZone = {
  id: string;
  name: string;
  governorate: string;
  fee: number;
  minimumOrder: number;
  freeDeliveryThreshold: number | null;
  available: boolean;
  source: DataSource;
};

export type FulfillmentMethod = "delivery" | "pickup";
export type PaymentMethod = "cod";

export type CheckoutDraft = {
  firstName: string;
  phone: string;
  whatsapp: string;
  sameWhatsapp: boolean;
  zoneId: string;
  street: string;
  building: string;
  landmark: string;
  notes: string;
  fulfillment: FulfillmentMethod;
  payment: PaymentMethod;
  substitution: SubstitutionPolicy;
  privacyAccepted: boolean;
};

export type OrderStatus =
  | "new"
  | "awaiting_whatsapp"
  | "needs_call"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type OrderEvent = {
  at: string;
  label: string;
  by: string;
};

export type OrderTotals = {
  itemsTotal: number;
  discountTotal: number;
  deliveryFee: number;
  grandTotal: number;
  freeDeliveryRemaining: number | null;
};

export type Order = {
  id: string;
  token: string;
  number: string;
  createdAt: string;
  status: OrderStatus;
  customer: { firstName: string; phone: string; whatsapp: string };
  address: {
    zoneId: string;
    zoneName: string;
    governorate: string;
    street: string;
    building: string;
    landmark: string;
    notes: string;
  };
  fulfillment: FulfillmentMethod;
  payment: PaymentMethod;
  substitution: SubstitutionPolicy;
  lines: CartLine[];
  totals: OrderTotals;
  internalNotes?: string | undefined;
  events: OrderEvent[];
  source: DataSource;
};

export type Promotion = {
  id: string;
  title: string;
  productId: string;
  price: number;
  compareAtPrice: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
  source: DataSource;
};

export type AdminRole =
  | "super_admin"
  | "store_manager"
  | "order_operator"
  | "inventory_operator"
  | "ceo_viewer";

export type AdminUser = {
  id: string;
  name: string;
  role: AdminRole;
  source: DataSource;
};

export type StoreSettings = {
  storeName: string;
  whatsappNumber: string;
  openingHours: string;
  branchAddress: string;
  acceptingOrders: boolean;
  pickupEnabled: boolean;
  substitutionPolicyText: string;
  announcement: string;
  currency: string;
  source: DataSource;
};
