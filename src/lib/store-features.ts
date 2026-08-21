/** إمكانيات السوبرماركت — المطوّر بيفعّل/يقفل كل واحدة حسب الباقة المتفق عليها. */

export type StoreFeatureKey =
  | "offers"
  | "bundles"
  | "search"
  | "categories"
  | "delivery"
  | "pickup"
  | "cod"
  | "whatsappOrders"
  | "announcements"
  | "darkMode"
  | "productRequests"
  | "reviews"
  | "coupons"
  | "analytics"
  | "adminDashboard"
  | "multiBranch";

export const STORE_FEATURES: Array<{ key: StoreFeatureKey; label: string; description: string }> = [
  { key: "search", label: "البحث", description: "شريط بحث داخل منتجات المتجر" },
  { key: "categories", label: "الأقسام", description: "عرض الأقسام بالصور زي تِكّة" },
  { key: "offers", label: "العروض والخصومات", description: "قسم مخصّص للمنتجات المخفّضة" },
  { key: "bundles", label: "عروض الجملة", description: "باقات منتجات بسعر مخفّض" },
  { key: "delivery", label: "التوصيل", description: "مناطق توصيل ورسوم" },
  { key: "pickup", label: "الاستلام من الفرع", description: "العميل يستلم بنفسه" },
  { key: "cod", label: "الدفع عند الاستلام", description: "كاش عند الباب" },
  { key: "whatsappOrders", label: "تأكيد الطلب بالواتساب", description: "إرسال الطلب على واتساب المتجر" },
  { key: "announcements", label: "شريط الإعلانات", description: "رسالة متحركة أعلى المتجر" },
  { key: "darkMode", label: "الوضع الليلي", description: "زرار تبديل نهاري/ليلي للزبون" },
  { key: "productRequests", label: "طلب منتج ناقص", description: "الزبون يطلب منتج مش موجود" },
  { key: "reviews", label: "تقييم المنتجات", description: "نجوم وتعليقات" },
  { key: "coupons", label: "أكواد الخصم", description: "كوبونات على الطلب" },
  { key: "analytics", label: "تقارير المبيعات", description: "إحصائيات داخل لوحة المتجر" },
  { key: "adminDashboard", label: "لوحة تحكم المتجر", description: "دخول صاحب المتجر بكلمة سر" },
  { key: "multiBranch", label: "أكثر من فرع", description: "إدارة فروع متعددة" },
];

export type StorePlanId = "basic" | "pro" | "ultimate";

export const STORE_PLANS: Array<{
  id: StorePlanId;
  name: string;
  tagline: string;
  features: StoreFeatureKey[];
}> = [
  {
    id: "basic",
    name: "باقة أساسية",
    tagline: "متجر بسيط للبيع السريع",
    features: ["search", "categories", "delivery", "cod", "whatsappOrders", "adminDashboard"],
  },
  {
    id: "pro",
    name: "باقة احترافية",
    tagline: "الأكثر طلبًا",
    features: [
      "search", "categories", "offers", "bundles", "delivery", "pickup", "cod",
      "whatsappOrders", "announcements", "darkMode", "adminDashboard", "productRequests",
    ],
  },
  {
    id: "ultimate",
    name: "باقة كاملة",
    tagline: "كل إمكانيات محرّك تِكّة",
    features: STORE_FEATURES.map((f) => f.key),
  },
];

export type StoreFeatureMap = Partial<Record<StoreFeatureKey, boolean>>;

export function featuresForPlan(plan: StorePlanId): StoreFeatureMap {
  const enabled = STORE_PLANS.find((p) => p.id === plan)?.features ?? [];
  return Object.fromEntries(STORE_FEATURES.map((f) => [f.key, enabled.includes(f.key)])) as StoreFeatureMap;
}

export function isFeatureOn(features: StoreFeatureMap | null | undefined, key: StoreFeatureKey): boolean {
  if (!features || Object.keys(features).length === 0) return true;
  return features[key] !== false;
}
