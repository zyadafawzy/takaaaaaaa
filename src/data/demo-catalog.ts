import type { Category, Product, DeliveryZone, StoreSettings, Promotion } from "@/domain/types";

/** بيانات تجريبية (demo) — مش من متجر حقيقي، ومموسومة في كل مكان تظهر فيه. */

export const demoCategories: Category[] = [
  { id: "c1", slug: "fresh", name: "خضار وفاكهة", description: "بالكيلو والقطعة", icon: "🥬", source: "demo" },
  { id: "c2", slug: "bakery", name: "مخبوزات", description: "عيش ومخبوزات", icon: "🥖", source: "demo" },
  { id: "c3", slug: "dairy", name: "ألبان وبيض", description: "لبن وجبن وبيض", icon: "🥛", source: "demo" },
  { id: "c4", slug: "frozen", name: "تجميد", description: "أطعمة مجمدة", icon: "🧊", source: "demo" },
  { id: "c5", slug: "drinks", name: "مشروبات", description: "مياه وعصاير", icon: "🧃", source: "demo" },
  { id: "c6", slug: "snacks", name: "سناكس وشوكولاتة", description: "شيبسي وحلويات", icon: "🍫", source: "demo" },
  { id: "c7", slug: "pantry", name: "أساسيات البيت", description: "بقالة ومنظفات", icon: "🧺", source: "demo" },
  { id: "c8", slug: "offers", name: "عروض حقيقية", description: "خصومات سارية دلوقتي", icon: "🏷️", source: "demo" },
];

const img = "/product-placeholder.jpg";

function p(product: Omit<Product, "images" | "source" | "available" | "isFeatured"> & { available?: boolean; isFeatured?: boolean }): Product {
  return {
    ...product,
    available: product.available ?? product.stock > 0,
    isFeatured: product.isFeatured ?? false,
    images: [img],
    source: "demo",
  };
}

export const demoProducts: Product[] = [
  p({ id: "p1", slug: "tamatem-baladi", sku: "FR-1001", name: "طماطم بلدي", brand: "بلدي", description: "طماطم طازة تتشترى بالكيلو، مناسبة للطبخ والسلطة.", categorySlug: "fresh", size: "1 كجم", unit: "kg", price: 18.5, compareAtPrice: 22, stock: 40, isFresh: true, isFeatured: true, complements: ["p2", "p3"] }),
  p({ id: "p2", slug: "khiar", sku: "FR-1002", name: "خيار", brand: "بلدي", description: "خيار طازة بالكيلو.", categorySlug: "fresh", size: "1 كجم", unit: "kg", price: 14, stock: 30, isFresh: true, isFeatured: false }),
  p({ id: "p3", slug: "batates", sku: "FR-1003", name: "بطاطس", brand: "بلدي", description: "بطاطس مناسبة للقلي والسلق.", categorySlug: "fresh", size: "2 كجم", unit: "kg", price: 26, stock: 25, isFresh: true, isFeatured: false }),
  p({ id: "p4", slug: "mooz", sku: "FR-1004", name: "موز", brand: "بلدي", description: "موز بالكيلو.", categorySlug: "fresh", size: "1 كجم", unit: "kg", price: 32, stock: 0, isFresh: true, isFeatured: false }),
  p({ id: "p5", slug: "borotokal", sku: "FR-1005", name: "برتقال عصير", brand: "بلدي", description: "برتقال مناسب للعصير.", categorySlug: "fresh", size: "2 كجم", unit: "kg", price: 38, stock: 18, isFresh: true, isFeatured: false }),

  p({ id: "p6", slug: "eish-baladi", sku: "BK-2001", name: "عيش بلدي", brand: "مخبز تِكّة", description: "رغيف بلدي طازة.", categorySlug: "bakery", size: "10 أرغفة", unit: "pack", price: 15, stock: 50, isFresh: true, isFeatured: false, complements: ["p9", "p10"] }),
  p({ id: "p7", slug: "toast-abyad", sku: "BK-2002", name: "توست أبيض", brand: "الخبز اليومي", description: "توست طري للسندوتشات.", categorySlug: "bakery", size: "600 جم", unit: "pack", price: 28, compareAtPrice: 33, stock: 22, isFresh: false, isFeatured: true }),
  p({ id: "p8", slug: "fino", sku: "BK-2003", name: "فينو", brand: "مخبز تِكّة", description: "فينو للسندوتشات.", categorySlug: "bakery", size: "6 قطع", unit: "pack", price: 18, stock: 12, isFresh: true, isFeatured: false }),

  p({ id: "p9", slug: "laban-kamel-dasm", sku: "DR-3001", name: "لبن كامل الدسم", brand: "وادي النيل", description: "لبن كامل الدسم معقّم.", categorySlug: "dairy", size: "1 لتر", unit: "liter", price: 42, stock: 35, isFresh: false, isFeatured: false, complements: ["p20", "p6"] }),
  p({ id: "p10", slug: "gebna-beida", sku: "DR-3002", name: "جبنة بيضاء", brand: "وادي النيل", description: "جبنة بيضاء طرية.", categorySlug: "dairy", size: "500 جم", unit: "pack", price: 55, compareAtPrice: 62, stock: 14, isFresh: false, isFeatured: true }),
  p({ id: "p11", slug: "beid-baladi", sku: "DR-3003", name: "بيض بلدي", brand: "مزارع الشرق", description: "بيض طبق 30 بيضة.", categorySlug: "dairy", size: "30 بيضة", unit: "pack", price: 145, stock: 8, isFresh: false, isFeatured: false }),
  p({ id: "p12", slug: "zabadi", sku: "DR-3004", name: "زبادي طبيعي", brand: "وادي النيل", description: "زبادي طبيعي بدون سكر.", categorySlug: "dairy", size: "6 عبوات", unit: "pack", price: 36, stock: 26, isFresh: false, isFeatured: false }),

  p({ id: "p13", slug: "khodar-mokhalta-mogamada", sku: "FZ-4001", name: "خضار مشكل مجمد", brand: "فريش لاين", description: "خضار مشكل سريع التحضير.", categorySlug: "frozen", size: "400 جم", unit: "pack", price: 39, stock: 20, isFresh: false, isFeatured: false }),
  p({ id: "p14", slug: "bane-mogamad", sku: "FZ-4002", name: "بانيه مجمد", brand: "فريش لاين", description: "شرائح بانيه مجمدة.", categorySlug: "frozen", size: "750 جم", unit: "pack", price: 189, compareAtPrice: 210, stock: 6, isFresh: false, isFeatured: true }),
  p({ id: "p15", slug: "ice-cream-vanilla", sku: "FZ-4003", name: "آيس كريم فانيليا", brand: "سكّرة", description: "آيس كريم فانيليا عائلي.", categorySlug: "frozen", size: "1 لتر", unit: "pack", price: 95, stock: 0, isFresh: false, isFeatured: false }),

  p({ id: "p16", slug: "mayya-madaniya", sku: "BV-5001", name: "مياه معدنية", brand: "نبع", description: "عبوة مياه 1.5 لتر × 6.", categorySlug: "drinks", size: "6 × 1.5 لتر", unit: "pack", price: 54, stock: 40, isFresh: false, isFeatured: false }),
  p({ id: "p17", slug: "aseer-mango", sku: "BV-5002", name: "عصير مانجو", brand: "بستان", description: "عصير مانجو بدون سكر مضاف.", categorySlug: "drinks", size: "1 لتر", unit: "liter", price: 34, stock: 24, isFresh: false, isFeatured: false }),
  p({ id: "p18", slug: "shay-fatla", sku: "BV-5003", name: "شاي فتلة", brand: "الصباح", description: "شاي فتلة 100 كيس.", categorySlug: "drinks", size: "100 كيس", unit: "pack", price: 78, compareAtPrice: 89, stock: 16, isFresh: false, isFeatured: false }),

  p({ id: "p19", slug: "shipsy-melh", sku: "SN-6001", name: "شيبسي ملح", brand: "كرانشي", description: "شيبسي بالملح.", categorySlug: "snacks", size: "150 جم", unit: "pack", price: 25, stock: 45, isFresh: false, isFeatured: false }),
  p({ id: "p20", slug: "corn-flakes", sku: "SN-6002", name: "كورن فليكس", brand: "صباح الخير", description: "كورن فليكس للفطار.", categorySlug: "snacks", size: "375 جم", unit: "pack", price: 88, stock: 12, isFresh: false, isFeatured: false, complements: ["p9", "p12"] }),
  p({ id: "p21", slug: "shokolata-laban", sku: "SN-6003", name: "شوكولاتة بلبن", brand: "سكّرة", description: "لوح شوكولاتة بالحليب.", categorySlug: "snacks", size: "90 جم", unit: "piece", price: 32, compareAtPrice: 38, stock: 33, isFresh: false, isFeatured: true }),

  p({ id: "p22", slug: "roz-masri", sku: "PN-7001", name: "أرز مصري", brand: "الحصاد", description: "أرز مصري حبة قصيرة.", categorySlug: "pantry", size: "5 كجم", unit: "pack", price: 165, stock: 15, isFresh: false, isFeatured: false }),
  p({ id: "p23", slug: "zeit-zorah", sku: "PN-7002", name: "زيت ذرة", brand: "الحصاد", description: "زيت ذرة للطبخ.", categorySlug: "pantry", size: "2.25 لتر", unit: "liter", price: 172, compareAtPrice: 195, stock: 9, isFresh: false, isFeatured: true }),
  p({ id: "p24", slug: "sabon-atbaq", sku: "PN-7003", name: "سائل غسيل الأطباق", brand: "نضّافة", description: "سائل مركّز للأطباق.", categorySlug: "pantry", size: "1 لتر", unit: "liter", price: 46, stock: 28, isFresh: false, isFeatured: false }),
  p({ id: "p25", slug: "makarona", sku: "PN-7004", name: "مكرونة إسباجيتي", brand: "الحصاد", description: "مكرونة إسباجيتي.", categorySlug: "pantry", size: "400 جم", unit: "pack", price: 17, stock: 3, isFresh: false, isFeatured: false }),
];

export const demoZones: DeliveryZone[] = [
  { id: "z1", name: "مدينة نصر", governorate: "القاهرة", fee: 25, minimumOrder: 100, freeDeliveryThreshold: 300, available: true, source: "demo" },
  { id: "z2", name: "المعادي", governorate: "القاهرة", fee: 30, minimumOrder: 120, freeDeliveryThreshold: 350, available: true, source: "demo" },
  { id: "z3", name: "المهندسين", governorate: "الجيزة", fee: 30, minimumOrder: 120, freeDeliveryThreshold: 350, available: true, source: "demo" },
  { id: "z4", name: "6 أكتوبر", governorate: "الجيزة", fee: 45, minimumOrder: 150, freeDeliveryThreshold: null, available: true, source: "demo" },
  { id: "z5", name: "شبرا الخيمة", governorate: "القليوبية", fee: 40, minimumOrder: 150, freeDeliveryThreshold: null, available: false, source: "demo" },
];

export const demoSettings: StoreSettings = {
  storeName: "تِكّة",
  whatsappNumber: "201000000000",
  openingHours: "يوميًا من 9 صباحًا لـ 11 مساءً",
  branchAddress: "شارع الطيران، مدينة نصر، القاهرة",
  acceptingOrders: true,
  pickupEnabled: true,
  substitutionPolicyText:
    "لو منتج مش متوفر وقت التجهيز، بنمشي على اختيارك: بديل مناسب، أو نتصل بيك، أو نشيل المنتج من الطلب.",
  announcement: "",
  currency: "ج.م",
  source: "demo",
};

export const demoPromotions: Promotion[] = [
  { id: "pr1", title: "خصم على التوست الأبيض", productId: "p7", price: 28, compareAtPrice: 33, startsAt: "2026-08-01T00:00:00.000Z", endsAt: "2026-09-01T00:00:00.000Z", active: true, source: "demo" },
  { id: "pr2", title: "خصم على زيت الذرة", productId: "p23", price: 172, compareAtPrice: 195, startsAt: "2026-08-05T00:00:00.000Z", endsAt: "2026-08-31T00:00:00.000Z", active: true, source: "demo" },
];
