import { useEffect, useState } from "react";
import { Wrench, Phone, MessageCircle, Clock, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brandingCssVars } from "@/lib/store-theme";
import type { StoreBranding } from "@/lib/store-theme";

type MaintenanceStore = {
  name: string;
  logoUrl?: string | null;
  maintenance_message?: string | null;
  phone?: string;
  whatsappNumber?: string;
  address?: string;
  governorate?: string;
  businessHours?: string;
  branding: StoreBranding;
};

export function StoreMaintenance({ store }: { store: MaintenanceStore }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const mode = store.branding?.colorMode === "dark" ? "dark" : "light";
  const wa = (store.whatsappNumber ?? "").replace(/\D/g, "");

  return (
    <div
      style={brandingCssVars(store.branding, mode) as React.CSSProperties}
      className={`relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-14 text-foreground ${
        mode === "dark" ? "dark" : ""
      }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 start-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-52 end-0 size-[28rem] rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative w-full max-w-lg rounded-3xl border border-border bg-surface/80 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="flex justify-center">
          {store.logoUrl ? (
            <img
              src={store.logoUrl}
              alt={store.name}
              width={72}
              height={72}
              className="size-18 rounded-2xl object-cover shadow-lg"
            />
          ) : (
            <span className="grid size-16 place-items-center rounded-2xl bg-primary text-2xl font-black text-primary-foreground shadow-lg">
              {store.name.slice(0, 1)}
            </span>
          )}
        </div>

        <div className="mt-6 flex justify-center">
          <span className="relative grid size-20 place-items-center rounded-full bg-primary/10">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/10" />
            <Wrench className="size-9 animate-pulse text-primary" />
          </span>
        </div>

        <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-[11px] font-bold text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          وضع الصيانة مفعّل
        </span>

        <h1 className="mt-4 text-2xl font-black leading-snug">{store.name} تحت الصيانة مؤقتًا</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {store.maintenance_message ||
            "بنعمل شوية تحديثات سريعة عشان الخدمة تبقى أسرع وأحسن. ارجع لنا كمان شوية — طلبك يستاهل."}
        </p>

        <div className="mt-6 grid gap-2 text-start text-xs text-muted-foreground">
          {store.businessHours ? (
            <p className="flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2">
              <Clock className="size-4 shrink-0 text-primary" /> {store.businessHours}
            </p>
          ) : null}
          {store.address ? (
            <p className="flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2">
              <MapPin className="size-4 shrink-0 text-primary" />
              {store.address}
              {store.governorate ? ` — ${store.governorate}` : ""}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            className="gap-1.5 rounded-xl"
            onClick={() => window.location.reload()}
            aria-label="تحديث الصفحة"
          >
            <RefreshCw className="size-4" /> جرّب تاني
          </Button>
          {wa ? (
            <Button variant="secondary" asChild className="gap-1.5 rounded-xl">
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" /> اطلب على واتساب
              </a>
            </Button>
          ) : null}
          {store.phone ? (
            <Button variant="outline" asChild className="gap-1.5 rounded-xl">
              <a href={`tel:${store.phone}`}>
                <Phone className="size-4" /> اتصل بينا
              </a>
            </Button>
          ) : null}
        </div>

        <p className="mt-6 text-[11px] text-muted-foreground/70" aria-live="polite">
          بنحاول نرجّع الخدمة… {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
        </p>
      </div>
    </div>
  );
}
