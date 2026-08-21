import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ordersAdapter } from "@/services/orders-adapter";
import { catalogRepository } from "@/services/catalog-repository";
import { adminStore } from "@/services/admin-store";
import { formatPrice, formatCount, formatDateTimeAr } from "@/lib/format";
import { isActionable, needsCall } from "@/lib/orders";
import { StatusPill } from "@/components/admin/StatusPill";
import { useAdminAuth } from "@/lib/auth/admin-auth";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const { user, ready } = useAdminAuth();
  const ordersQuery = useQuery({
    queryKey: ["admin", "orders", { limit: 200 }],
    queryFn: () => ordersAdapter.listOrdersForAdmin({ limit: 200 }),
    enabled: ready && !!user
  });
  
  const statsQuery = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
       const { adminCatalogStats } = await import("@/lib/admin-catalog.functions");
       return adminCatalogStats();
    },
    enabled: ready && !!user
  });

  const { orders } = ordersQuery.data ?? { orders: [], total: 0 };
  const stats = statsQuery.data;
  
  const today = new Date().toDateString();
  const todayOrders = orders.filter((order) => new Date(order.createdAt).toDateString() === today);
  const revenue = orders
    .filter((order) => order.status === "delivered")
    .reduce((sum, order) => sum + order.totals.grandTotal, 0);
    
  const queue = orders.filter((order) => isActionable(order)).slice(0, 6);

  const cards = [
    { label: "طلبات اليوم", value: formatCount(todayOrders.length), color: "text-primary" },
    { label: "بانتظار الإجراء", value: formatCount(orders.filter(isActionable).length), color: "text-accent" },
    { label: "إجمالي المبيعات", value: formatPrice(revenue), color: "text-success" },
    { label: "أصناف للمراجعة", value: formatCount(stats?.needsReview ?? 0), color: "text-destructive" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight">لوحة القيادة</h1>
        <p className="text-muted-foreground">أهلاً بك مجدداً، {user?.name}. إليك ملخص أداء متجرك.</p>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="group rounded-2xl border border-border bg-surface p-6 shadow-soft transition-all hover:shadow-lifted hover:-translate-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{card.label}</p>
            <p className={`mt-2 text-2xl font-black ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-2xl border border-border bg-surface shadow-soft overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 p-5">
            <h2 className="font-black text-lg">طابور العمل المباشر</h2>
            <Link to="/admin/orders" className="text-xs font-bold text-primary hover:underline bg-primary/10 px-3 py-1 rounded-full">
              كل الطلبات
            </Link>
          </div>
          
          <div className="min-h-[300px]">
            {ordersQuery.isLoading ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-2">
                <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium">جاري تحديث البيانات...</p>
              </div>
            ) : queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="size-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                  <span className="text-success text-2xl">✓</span>
                </div>
                <h3 className="font-bold">كل شيء تمام!</h3>
                <p className="text-sm text-muted-foreground">لا توجد طلبات معلقة تحتاج لإجراء حالياً.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {queue.map((order) => (
                  <li key={order.token} className="group flex items-center justify-between p-5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <Link
                          to="/admin/orders/$token"
                          params={{ token: order.token }}
                          className="text-lg font-black text-foreground hover:text-primary transition-colors"
                        >
                          #{order.number}
                        </Link>
                        <span className="text-xs text-muted-foreground">{formatDateTimeAr(order.createdAt)}</span>
                      </div>
                      <StatusPill status={order.status} />
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-end hidden sm:block">
                        <p className="text-sm font-bold">{order.address.zoneName}</p>
                        <p className="text-[10px] text-muted-foreground">{order.customer.firstName}</p>
                      </div>
                      <Link 
                         to="/admin/orders/$token" 
                         params={{ token: order.token }}
                         className="size-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-sm"
                      >
                         →
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft space-y-4">
            <h2 className="font-black">نظرة سريعة على المخزون</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-destructive/10">
                <span className="text-xs font-bold text-destructive">أصناف نفدت</span>
                <span className="font-black text-destructive">{formatCount(stats?.total ? 0 : 0)}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-accent/10">
                <span className="text-xs font-bold text-accent">أصناف مخفية</span>
                <span className="font-black text-accent">{formatCount(0)}</span>
              </div>
            </div>
            <Link to="/admin/inventory" className="block w-full text-center py-2.5 rounded-xl bg-foreground text-background text-xs font-bold hover:opacity-90 transition-opacity">
              إدارة المخزون
            </Link>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft space-y-4 bg-primary/5">
             <h2 className="font-black">مركز الحزم (Packages)</h2>
             <p className="text-xs text-muted-foreground leading-relaxed">
               ارفع مبيعاتك بإنشاء حزم منتجات متكاملة (مثلاً: حزمة الفطار المصري، حزمة المكرونة).
             </p>
             <Link to="/admin/bundles" className="block w-full text-center py-2.5 rounded-xl border border-primary text-primary text-xs font-bold hover:bg-primary hover:text-white transition-all">
               استكشف الحزم
             </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
