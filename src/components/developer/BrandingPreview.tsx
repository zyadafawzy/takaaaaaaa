import { ShoppingBasket, Search, Star } from "lucide-react";

import { brandingCssVars, type StoreBranding } from "@/lib/store-theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** معاينة حيّة لواجهة تِكّة بألوان السوبرماركت الجديد. */
export function BrandingPreview({
  branding,
  storeName,
}: {
  branding: StoreBranding;
  storeName: string;
}) {
  return (
    <div
      style={brandingCssVars(branding) as React.CSSProperties}
      className="overflow-hidden rounded-2xl border border-border bg-background text-foreground"
    >
      <div className="bg-primary px-4 py-2 text-center text-[11px] font-bold text-primary-foreground">
        توصيل مجاني للطلبات فوق ٣٠٠ جنيه
      </div>

      <header className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
        <span className="grid size-9 place-items-center rounded-xl bg-primary text-sm font-black text-primary-foreground">
          {(storeName || "س").slice(0, 1)}
        </span>
        <span className="text-sm font-black">{storeName || "اسم السوبرماركت"}</span>
        <Button size="sm" variant="secondary" className="ms-auto h-9 gap-1.5 rounded-xl">
          <ShoppingBasket className="size-4 text-primary" />
          <span className="text-[11px] font-bold">١٢٥ ج.م</span>
        </Button>
      </header>

      <div className="space-y-4 p-4">
        <div className="flex gap-2">
          <Input readOnly placeholder="دوّر على منتج..." className="h-10 rounded-xl bg-surface" />
          <Button className="h-10 rounded-xl px-3">
            <Search className="size-4" />
          </Button>
        </div>

        <div className="flex gap-2 overflow-hidden">
          {["الكل", "خضار", "ألبان", "مخبوزات"].map((label, index) => (
            <span
              key={label}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                index === 0
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-surface text-muted-foreground"
              }`}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { name: "طماطم بلدي", price: "١٨ ج.م", old: "٢٤ ج.م" },
            { name: "لبن كامل الدسم", price: "٤٢ ج.م", old: null },
          ].map((item) => (
            <div key={item.name} className="rounded-2xl border border-border bg-surface p-3">
              <div className="grid h-16 place-items-center rounded-xl bg-muted text-muted-foreground">
                <Star className="size-5 text-accent" />
              </div>
              <p className="mt-2 text-xs font-bold">{item.name}</p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-sm font-black text-primary">{item.price}</span>
                {item.old ? (
                  <span className="text-[10px] text-muted-foreground line-through">{item.old}</span>
                ) : null}
              </div>
              <Button size="sm" className="mt-2 h-8 w-full rounded-lg text-[11px]">
                أضف للسلة
              </Button>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-accent-soft p-3 text-xs">
          <p className="font-bold">عرض اليوم</p>
          <p className="mt-1 text-muted-foreground">خصم ١٥٪ على كل المخبوزات لحد نص الليل.</p>
        </div>
      </div>

      <footer className="border-t border-border bg-surface px-4 py-3 text-[11px] text-muted-foreground">
        {storeName || "اسم السوبرماركت"} — تأكيد الطلب على واتساب
      </footer>
    </div>
  );
}
