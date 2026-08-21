import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Store, Package, ShoppingBag, Wallet, PlusCircle } from "lucide-react";

import { developerOverview } from "@/lib/developer.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/developer/")({
  component: DeveloperOverview,
});

function DeveloperOverview() {
  const overview = useQuery({ queryKey: ["developer-overview"], queryFn: () => developerOverview() });

  if (overview.isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-3xl" />
        ))}
      </div>
    );
  }

  if (overview.isError || !overview.data) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted-foreground">
        مقدرناش نحمّل بيانات المنصّة.
      </p>
    );
  }

  const data = overview.data;
  const cards = [
    { label: "السوبرماركتات", value: String(data.totalStores), hint: `${data.activeStores} نشط`, icon: Store },
    { label: "منتجات المكتبة الرئيسية", value: String(data.masterProducts), hint: "متاحة للتوزيع", icon: Package },
    { label: "الطلبات", value: String(data.totalOrders), hint: "كل المتاجر", icon: ShoppingBag },
    { label: "إجمالي المبيعات", value: formatPrice(data.revenue), hint: "كل المتاجر", icon: Wallet },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-gradient-to-br from-primary/10 to-surface p-6">
        <div>
          <h1 className="text-2xl font-black">مركز تحكم المطوّر</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            كل سوبرماركت له هويته ومنتجاته وطلباته — من مكان واحد.
          </p>
        </div>
        <Button asChild className="gap-2 rounded-xl">
          <Link to="/developer/new">
            <PlusCircle className="size-4" /> إنشاء سوبرماركت
          </Link>
        </Button>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded-3xl border border-border bg-surface p-5">
            <card.icon className="size-5 text-primary" />
            <p className="mt-3 text-2xl font-black">{card.value}</p>
            <p className="text-xs font-bold">{card.label}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{card.hint}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-border bg-surface p-5">
        <h2 className="text-sm font-black">آخر النشاطات</h2>
        {data.activity.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">مفيش نشاط لسه.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-xs">
            {data.activity.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                <span className="font-bold">{item.action}</span>
                <span className="text-muted-foreground">{item.actor_email}</span>
                <span className="text-muted-foreground">
                  {new Date(item.created_at).toLocaleString("ar-EG")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
