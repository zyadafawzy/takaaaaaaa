import { Check } from "lucide-react";

import { HERO_GALLERY, ASSET_SPECS } from "@/lib/store-hero-gallery";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** صور واجهة جاهزة (مولّدة بالـ AI) + إمكانية إدخال رابط صورة خاصة. */
export function HeroGalleryPicker({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold">{ASSET_SPECS.hero.label}</p>
        <p className="text-[11px] text-muted-foreground">
          المقاس المفضّل: {ASSET_SPECS.hero.size} — {ASSET_SPECS.hero.note}
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {HERO_GALLERY.map((item) => {
          const active = value === item.url;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onChange(active ? null : item.url)}
                className={`group relative block w-full overflow-hidden rounded-2xl border-2 transition-all ${
                  active ? "border-primary shadow-lg" : "border-transparent hover:border-primary/40"
                }`}
              >
                <img
                  src={item.url}
                  alt={item.label}
                  width={1536}
                  height={1024}
                  loading="lazy"
                  className="aspect-[3/2] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-[11px] font-bold text-white">
                  {item.label}
                </span>
                {active ? (
                  <span className="absolute top-2 end-2 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-4" />
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="space-y-1.5">
        <Label htmlFor="hero-url">أو رابط صورة خاصة</Label>
        <Input
          id="hero-url"
          dir="ltr"
          placeholder="https://..."
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value || null)}
        />
      </div>
    </div>
  );
}
