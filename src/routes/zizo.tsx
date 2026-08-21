import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/zizo")({
  head: () => ({
    meta: [
      { title: "Zizo — كل صفحات المنصة في مكان واحد" },
      {
        name: "description",
        content: "صفحة وصول سريع لكل صفحات تِكّة: المتجر، لوحة الإدارة، لوحة المتاجر، وأدوات المطوّر.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Zizo — كل صفحات المنصة" },
      { property: "og:description", content: "وصول سريع لكل صفحات المنصة للمالك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ZizoPage,
});

type Item = { path: string; label: string };
type Group = { title: string; note?: string; items: Item[] };

const groups: Group[] = [
  {
    title: "المتجر العام",
    items: [
      { path: "/", label: "الرئيسية" },
      { path: "/categories", label: "الأقسام" },
      { path: "/search", label: "البحث" },
      { path: "/cart", label: "السلة" },
      { path: "/checkout", label: "إتمام الطلب" },
      { path: "/delivery", label: "التوصيل" },
      { path: "/freshness", label: "الطزاجة" },
      { path: "/contact", label: "تواصل معنا" },
      { path: "/privacy", label: "الخصوصية" },
      { path: "/terms", label: "الشروط" },
    ],
  },
  {
    title: "صفحات بمُعرّف (تحتاج قيمة)",
    note: "استخدم الحقول فوق لملء القيم.",
    items: [
      { path: "/category/:slug", label: "قسم" },
      { path: "/product/:slug", label: "منتج" },
      { path: "/track/:token", label: "تتبّع الطلب" },
      { path: "/order/pending/:token", label: "طلب قيد التأكيد" },
    ],
  },
  {
    title: "لوحة التشغيل (Admin)",
    items: [
      { path: "/admin", label: "الرئيسية" },
      { path: "/admin/login", label: "تسجيل الدخول" },
      { path: "/admin/orders", label: "الطلبات" },
      { path: "/admin/catalog", label: "الكتالوج" },
      { path: "/admin/catalog-import", label: "رفع الصور والبيانات" },
      { path: "/admin/bundles", label: "الباقات" },
      { path: "/admin/inventory", label: "المخزون" },
      { path: "/admin/promotions", label: "العروض" },
      { path: "/admin/delivery", label: "مناطق التوصيل" },
      { path: "/admin/reports", label: "التقارير" },
      { path: "/admin/settings", label: "الإعدادات" },
    ],
  },
  {
    title: "متجر محدّد (Storefront)",
    items: [
      { path: "/s/:storeSlug", label: "واجهة المتجر" },
      { path: "/s/:storeSlug/cart", label: "سلة المتجر" },
      { path: "/s/:storeSlug/checkout", label: "إتمام طلب المتجر" },
      { path: "/s/:storeSlug/product/:slug", label: "منتج داخل المتجر" },
      { path: "/s/:storeSlug/order/:token", label: "طلب المتجر" },
      { path: "/s/:storeSlug/track/:token", label: "تتبّع طلب المتجر" },
    ],
  },
  {
    title: "لوحة إدارة المتجر",
    items: [
      { path: "/s/:storeSlug/admin", label: "الرئيسية" },
      { path: "/s/:storeSlug/admin/orders", label: "الطلبات" },
      { path: "/s/:storeSlug/admin/delivery", label: "شاشة التوصيل" },
      { path: "/s/:storeSlug/admin/catalog", label: "المنتجات" },
      { path: "/s/:storeSlug/admin/reports", label: "التقارير" },
      { path: "/s/:storeSlug/admin/announcements", label: "الإعلانات" },
      { path: "/s/:storeSlug/admin/team", label: "الفريق" },
      { path: "/s/:storeSlug/admin/theme", label: "الشكل والثيم" },
      { path: "/s/:storeSlug/admin/settings", label: "الإعدادات والتوصيل" },
    ],
  },
  {
    title: "المطوّر والإعداد",
    items: [
      { path: "/developer", label: "لوحة المطوّر" },
      { path: "/developer/stores", label: "كل المتاجر" },
      { path: "/developer/new", label: "متجر جديد" },
      { path: "/developer/stores/:id", label: "تفاصيل متجر" },
      { path: "/owner-setup", label: "تهيئة المالك" },
    ],
  },
];

function ZizoPage() {
  const [storeSlug, setStoreSlug] = useState("");
  const [slug, setSlug] = useState("");
  const [token, setToken] = useState("");
  const [id, setId] = useState("");

  const fill = (path: string) =>
    path
      .replace(":storeSlug", storeSlug || ":storeSlug")
      .replace(":slug", slug || ":slug")
      .replace(":token", token || ":token")
      .replace(":id", id || ":id");

  const ready = (path: string) => !fill(path).includes(":");

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-extrabold">Zizo — كل صفحات المنصة</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          وصول سريع لكل الصفحات. الصفحات اللي محتاجة قيم املأها من هنا.
        </p>

        <div className="mt-5 grid gap-3 rounded-2xl border border-border/70 bg-surface/70 p-4 sm:grid-cols-4">
          <div>
            <Label htmlFor="z-store">storeSlug</Label>
            <Input id="z-store" dir="ltr" value={storeSlug} onChange={(e) => setStoreSlug(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="z-slug">slug</Label>
            <Input id="z-slug" dir="ltr" value={slug} onChange={(e) => setSlug(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="z-token">token</Label>
            <Input id="z-token" dir="ltr" value={token} onChange={(e) => setToken(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="z-id">id</Label>
            <Input id="z-id" dir="ltr" value={id} onChange={(e) => setId(e.target.value)} className="mt-1" />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <section key={group.title} className="rounded-2xl border border-border/70 bg-surface/70 p-4">
              <h2 className="font-bold">{group.title}</h2>
              <ul className="mt-3 space-y-1.5">
                {group.items.map((item) => {
                  const href = fill(item.path);
                  const enabled = ready(item.path);
                  return (
                    <li key={item.path}>
                      {enabled ? (
                        <a
                          href={href}
                          className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-muted/50"
                        >
                          <span>{item.label}</span>
                          <span dir="ltr" className="truncate text-[11px] text-muted-foreground">
                            {href}
                          </span>
                        </a>
                      ) : (
                        <span className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground opacity-60">
                          <span>{item.label}</span>
                          <span dir="ltr" className="truncate text-[11px]">
                            {item.path}
                          </span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
