import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ShoppingBag,
  Clock,
  Receipt,
  Wallet,
  Package,
  MapPin,
  ArrowLeft,
  Truck,
} from "lucide-react";
import { storeAdminDashboard, storeAdminOrders, storeAdminGetSettings } from "@/lib/store-admin.functions";
import { formatDateTimeAr, formatPrice } from "@/lib/format";
import { StatusPill } from "@/components/admin/StatusPill";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { OrderStatus } from "@/domain/types";

export const Route = createFileRoute("/s/$storeSlug/admin/")({
  component: StoreAdminHome,
});

function StoreAdminHome() {
  const { storeSlug } = Route.useParams();

  const query = useQuery({
    queryKey: ["store-admin", storeSlug, "dashboard"],
    queryFn: () => storeAdminDashboard({ data: { storeSlug } }),
    retry: false,
  });

  const recent = useQuery({
    queryKey: ["store-admin", storeSlug, "orders", "recent"],
    queryFn: () => storeAdminOrders({ data: { storeSlug, limit: 6 } }),
    retry: false,
  });

  const settings = useQuery({
    queryKey: ["store-admin", storeSlug, "settings", "zones"],
    queryFn: () => storeAdminGetSettings({ data: { storeSlug } }),
    retry: false,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-3xl" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted-foreground">
        الحساب ده مش مسجّل كفريق للمتجر ده. كلّم مسؤول المنصّة لإضافتك.
      </p>
    );
  }

  const data = query.data;
  if (!data) return null;

  const cards = [
    { label: "طلبات النهاردة", value: String(data.ordersToday), icon: ShoppingBag, tone: "text-primary bg-primary/10" },
    { label: "محتاجة متابعة", value: String(data.pending), icon: Clock, tone: "text-destructive bg-destructive/10" },
    { label: "إجمالي الطلبات", value: String(data.ordersTotal), icon: Receipt, tone: "text-accent bg-accent/10" },
    { label: "إجمالي المسلّم", value: formatPrice(data.revenueTotal), icon: Wallet, tone: "text-primary bg-primary/10" },
    { label: "منتجات مفعّلة", value: String(data.productsEnabled), icon: Package, tone: "text-foreground bg-muted" },
    { label: "مناطق توصيل", value: String(data.zones), icon: MapPin, tone: "text-foreground bg-muted" },
  ];

  const zones = settings.data?.zones ?? [];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-surface/70 p-6 backdrop-blur">
        <div
          aria-hidden
          className="pointer-events-none absolute -end-16 -top-16 size-52 rounded-full bg-primary/10 blur-3xl"
        />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          لوحة تحكم المتجر
        </p>
        <h1 className="mt-1 text-2xl font-black md:text-3xl">{data.storeName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          كل الطلبات والتوصيل في مكان واحد — من الموبايل أو الكمبيوتر.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" className="rounded-full" asChild>
            <Link to="/s/$storeSlug/admin/orders" params={{ storeSlug }}>
              متابعة الطلبات
            </Link>
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" asChild>
            <Link to="/s/$storeSlug/admin/settings" params={{ storeSlug }}>
              مناطق التوصيل
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-border/70 bg-surface/70 p-4 backdrop-blur transition-shadow hover:shadow-md"
          >
            <div className={`flex size-9 items-center justify-center rounded-xl ${card.tone}`}>
              <card.icon className="size-4.5" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-0.5 text-xl font-black leading-tight md:text-2xl">{card.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-3xl border border-border/70 bg-surface/70 p-4 backdrop-blur lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <ShoppingBag className="size-4 text-primary" />
            <h2 className="font-extrabold">آخر الطلبات</h2>
            <Link
              to="/s/$storeSlug/admin/orders"
              params={{ storeSlug }}
              className="ms-auto flex items-center gap-1 text-xs font-semibold text-primary"
            >
              كل الطلبات <ArrowLeft className="size-3.5" />
            </Link>
          </div>

          {recent.isLoading ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : (recent.data?.orders.length ?? 0) === 0 ? (
            <p className="rounded-2xl bg-muted/40 p-6 text-center text-sm text-muted-foreground">
              لسه مفيش طلبات.
            </p>
          ) : (
            <ul className="divide-y divide-border/70">
              {recent.data?.orders.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                  <p className="font-bold">{order.number}</p>
                  <StatusPill status={order.status as OrderStatus} />
                  <span className="price ms-auto font-extrabold text-primary">
                    {formatPrice(order.total)}
                  </span>
                  <p className="w-full text-xs text-muted-foreground">
                    {order.customer} — <span dir="ltr">{order.phone}</span> —{" "}
                    {order.fulfillment === "pickup" ? "استلام من الفرع" : order.zone || "توصيل"} —{" "}
                    {formatDateTimeAr(order.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-3xl border border-border/70 bg-surface/70 p-4 backdrop-blur">
          <div className="mb-3 flex items-center gap-2">
            <Truck className="size-4 text-primary" />
            <h2 className="font-extrabold">التوصيل</h2>
            <Link
              to="/s/$storeSlug/admin/settings"
              params={{ storeSlug }}
              className="ms-auto flex items-center gap-1 text-xs font-semibold text-primary"
            >
              تعديل <ArrowLeft className="size-3.5" />
            </Link>
          </div>

          {settings.isLoading ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : zones.length === 0 ? (
            <p className="rounded-2xl bg-muted/40 p-6 text-center text-sm text-muted-foreground">
              مفيش مناطق توصيل متسجّلة.
            </p>
          ) : (
            <ul className="space-y-2">
              {zones.map((zone) => (
                <li
                  key={zone.id}
                  className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/40 px-3 py-2"
                >
                  <MapPin className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{zone.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{zone.governorate}</p>
                  </div>
                  <span className="price ms-auto shrink-0 text-sm font-extrabold">
                    {formatPrice(Number(zone.fee))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
