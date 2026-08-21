/** معرض صور الواجهة (مولّدة بالذكاء الاصطناعي) اللي المطوّر بيختار منها وهو بيعمل السوبرماركت. */

export type HeroImageOption = { id: string; url: string; label: string; mood: "light" | "dark" };

export const HERO_GALLERY: HeroImageOption[] = [
  { id: "fresh-produce", url: "/assets/store-heroes/fresh-produce.jpg", label: "خضار وفاكهة فريش", mood: "light" },
  { id: "modern-market", url: "/assets/store-heroes/modern-market.jpg", label: "سوبرماركت عصري", mood: "light" },
  { id: "home-delivery", url: "/assets/store-heroes/home-delivery.jpg", label: "توصيل للبيت", mood: "light" },
  { id: "gourmet-dark", url: "/assets/store-heroes/gourmet-dark.jpg", label: "أجواء ليلية فاخرة", mood: "dark" },
];

/** مقاسات الأصول المطلوبة — بتتعرض للمستخدم وهو بيرفع. */
export const ASSET_SPECS = {
  logo: { label: "الشعار", size: "512×512 بكسل (مربّع)", note: "PNG بخلفية شفافة أفضل — أقصى حجم ٢ ميجا" },
  hero: { label: "صورة الواجهة", size: "1536×1024 بكسل", note: "JPG عرضية — أو اختر صورة جاهزة من المعرض" },
} as const;
