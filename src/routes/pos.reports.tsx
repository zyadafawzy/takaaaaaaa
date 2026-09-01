import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { usePos } from "@/components/pos/PosShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCount, formatPrice } from "@/lib/format";
import { posDailyClosings, posReport, type PosReport } from "@/lib/pos-report.functions";

export const Route = createFileRoute("/pos/reports")({
  head: () => ({
    meta: [
      { title: "تقارير الكاشير | تِكّة" },
      { name: "description", content: "تقارير البيع اليومية، أعلى الأصناف، الأرباح والإغلاقات النقدية بتوقيت القاهرة." },
      { property: "og:title", content: "تقارير الكاشير | تِكّة" },
      { property: "og:description", content: "أرقام البيع والأرباح والإغلاق اليومي في مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

type Closing = Awaited<ReturnType<typeof posDailyClosings>>[number];

function todayCairo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
}

export function ReportsPage() {
  const pos = usePos();
  const today = todayCairo();
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [report, setReport] = useState<PosReport | null>(null);
  const [closings, setClosings] = useState<Closing[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const [data, closingRows] = await Promise.all([
        posReport({ data: { storeId: pos.storeId, branchId: pos.branchId, dateFrom, dateTo } }),
        posDailyClosings({ data: { storeId: pos.storeId } }),
      ]);
      setReport(data);
      setClosings(closingRows);
    } catch {
      toast.error("مقدرناش نحمّل التقارير.");
    }
    setBusy(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.storeId, pos.branchId]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">التقارير</h1>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="r-from">من</Label>
          <Input id="r-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="r-to">إلى</Label>
          <Input id="r-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <Button disabled={busy} onClick={() => void load()}>
          عرض
        </Button>
      </div>

      {report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="إجمالي البيع" value={formatPrice(report.totals.sales)} />
            <Stat label="المرتجع والملغي" value={formatPrice(report.totals.refunds)} />
            <Stat label="الصافي" value={formatPrice(report.totals.net)} />
            <Stat label="الربح التقديري" value={formatPrice(report.totals.grossProfit)} />
            <Stat label="عدد الفواتير" value={formatCount(report.totals.invoices)} />
            <Stat label="متوسط الفاتورة" value={formatPrice(report.totals.averageBasket)} />
            <Stat label="نقدي" value={formatPrice(report.totals.cash)} />
            <Stat label="شبكة/محفظة" value={formatPrice(report.totals.card)} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="البيع يوم بيوم">
              <ul className="divide-y divide-border text-sm">
                {report.daily.length === 0 ? (
                  <li className="p-3 text-muted-foreground">مفيش بيع في المدة دي.</li>
                ) : (
                  report.daily.map((day) => (
                    <li key={day.date} className="flex items-center justify-between p-2">
                      <span>{day.date}</span>
                      <span className="text-xs text-muted-foreground">{day.invoices} فاتورة</span>
                      <span className="tabular-nums">{formatPrice(day.sales)}</span>
                    </li>
                  ))
                )}
              </ul>
            </Panel>

            <Panel title="أعلى الأصناف">
              <ul className="divide-y divide-border text-sm">
                {report.topProducts.length === 0 ? (
                  <li className="p-3 text-muted-foreground">لا يوجد.</li>
                ) : (
                  report.topProducts.map((product) => (
                    <li key={product.productName} className="flex items-center justify-between p-2">
                      <span>{product.productName}</span>
                      <span className="text-xs text-muted-foreground">{product.qty}</span>
                      <span className="tabular-nums">{formatPrice(product.revenue)}</span>
                    </li>
                  ))
                )}
              </ul>
            </Panel>

            <Panel title="أرصدة العملاء الآجلة">
              <ul className="divide-y divide-border text-sm">
                {report.customerBalances.length === 0 ? (
                  <li className="p-3 text-muted-foreground">مفيش آجل.</li>
                ) : (
                  report.customerBalances.map((customer) => (
                    <li key={customer.name} className="flex items-center justify-between p-2">
                      <span>{customer.name}</span>
                      <span className="tabular-nums text-destructive">{formatPrice(customer.balance)}</span>
                    </li>
                  ))
                )}
              </ul>
            </Panel>

            <Panel title="الإغلاقات اليومية">
              <ul className="divide-y divide-border text-sm">
                {closings.length === 0 ? (
                  <li className="p-3 text-muted-foreground">مفيش إغلاقات.</li>
                ) : (
                  closings.map((closing) => (
                    <li key={closing.id} className="flex items-center justify-between p-2">
                      <span>{closing.closingDate}</span>
                      <span className="text-xs text-muted-foreground">{closing.invoicesCount} فاتورة</span>
                      <span className="tabular-nums">{formatPrice(closing.netSales)}</span>
                    </li>
                  ))
                )}
              </ul>
            </Panel>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">اختار المدة واضغط عرض.</p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-extrabold tabular-nums">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border">
      <h2 className="border-b border-border p-3 font-bold">{title}</h2>
      {children}
    </section>
  );
}
