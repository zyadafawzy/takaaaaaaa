import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  salesCenter,
  salesInvoiceDetail,
  postDeliveryOrder,
  cancelDeliveryInvoice,
  unpostedDeliveryOrders,
} from "@/lib/sales-center.functions";

export const Route = createFileRoute("/s/$storeSlug/admin/sales")({
  head: () => ({
    meta: [
      { title: "مركز المبيعات — تِكّة" },
      { name: "description", content: "مبيعات المكان والديليفري والكلية بفصل صارم وتحليلات قابلة للتدقيق." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "مركز المبيعات" },
      { property: "og:description", content: "تحليلات مبيعات المتجر والديليفري بتوقيت القاهرة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalesCenterPage,
});

type Source = "inplace" | "delivery" | "all";

const money = (v: number) => `${v.toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ج.م`;
const NA = "غير متاح";

function cairoToday(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(now);
}

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("ar-EG", {
    timeZone: "Africa/Cairo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

const SOURCE_LABEL: Record<"inplace" | "delivery", string> = {
  inplace: "مبيعات المكان",
  delivery: "ديليفري",
};

function SalesCenterPage() {
  const { storeSlug } = Route.useParams();
  const qc = useQueryClient();
  const [source, setSource] = useState<Source>("all");
  const [dateFrom, setDateFrom] = useState(cairoToday());
  const [dateTo, setDateTo] = useState(cairoToday());
  const [paymentStatus, setPaymentStatus] = useState<"all" | "paid" | "partial" | "unpaid">("all");
  const [paymentMethod, setPaymentMethod] = useState<string>("all");
  const [openInvoice, setOpenInvoice] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<string | null>(null);

  const filters = { storeSlug, source, dateFrom, dateTo, paymentStatus, paymentMethod };

  const query = useQuery({
    queryKey: ["sales-center", filters],
    queryFn: () => salesCenter({ data: filters }),
    retry: false,
  });

  const unposted = useQuery({
    queryKey: ["unposted-delivery", storeSlug],
    queryFn: () => unpostedDeliveryOrders({ data: { storeSlug } }),
    retry: false,
    enabled: source !== "inplace",
  });

  const post = useMutation({
    mutationFn: (orderId: string) => postDeliveryOrder({ data: { storeSlug, orderId } }),
    onSuccess: (res) => {
      toast.success(res.created ? "تم اعتماد الطلب كفاتورة" : "الطلب معتمد قبل كده — نفس الفاتورة");
      void qc.invalidateQueries({ queryKey: ["sales-center"] });
      void qc.invalidateQueries({ queryKey: ["unposted-delivery"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setPreset = (preset: "today" | "yesterday" | "week" | "month") => {
    const today = cairoToday();
    if (preset === "today") {
      setDateFrom(today);
      setDateTo(today);
    } else if (preset === "yesterday") {
      const y = cairoToday(-1);
      setDateFrom(y);
      setDateTo(y);
    } else if (preset === "week") {
      setDateFrom(cairoToday(-6));
      setDateTo(today);
    } else {
      setDateFrom(`${today.slice(0, 7)}-01`);
      setDateTo(today);
    }
  };

  const data = query.data;
  const rows = useMemo(() => {
    if (!data) return [];
    if (drilldown === "refunded") return data.invoices.filter((i) => i.refunded > 0);
    if (drilldown === "credit") return data.invoices.filter((i) => i.due > 0);
    return data.invoices;
  }, [data, drilldown]);

  const exportCsv = () => {
    if (!data) return;
    const headers = [
      "invoice_no",
      "datetime_cairo",
      "sale_source",
      "customer",
      "total",
      "paid",
      "due",
      "payment_status",
      "status",
      "refunded",
    ];
    const lines = [
      headers.join(","),
      ...rows.map((r) =>
        [
          r.invoiceNumber,
          fmtTime(r.createdAt),
          r.source,
          r.customerName ?? "",
          r.total,
          r.paid,
          r.due,
          r.paymentStatus,
          r.status,
          r.refunded,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-${source}-${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-extrabold">مركز المبيعات</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          التوقيت: Africa/Cairo
        </span>
        <Button size="sm" variant="outline" className="ms-auto" onClick={exportCsv} disabled={!data}>
          تصدير CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["inplace", "delivery", "all"] as Source[]).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={source === s ? "default" : "outline"}
            onClick={() => {
              setSource(s);
              setDrilldown(null);
            }}
          >
            {s === "inplace" ? "مبيعات المكان" : s === "delivery" ? "مبيعات الديليفري" : "المبيعات الكلية"}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-wrap gap-1 lg:col-span-2">
          {[
            ["today", "اليوم"],
            ["yesterday", "أمس"],
            ["week", "آخر ٧ أيام"],
            ["month", "هذا الشهر"],
          ].map(([key, label]) => (
            <Button key={key} size="sm" variant="outline" onClick={() => setPreset(key as never)}>
              {label}
            </Button>
          ))}
        </div>
        <div>
          <Label className="text-xs">من</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">إلى</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">حالة الدفع</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value as never)}
            >
              <option value="all">الكل</option>
              <option value="paid">مدفوع</option>
              <option value="partial">جزئي</option>
              <option value="unpaid">آجل</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">طريقة الدفع</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="all">الكل</option>
              <option value="cash">نقدي</option>
              <option value="card">بطاقة</option>
            </select>
          </div>
        </div>
      </div>

      {query.isLoading ? <Skeleton className="h-64 w-full rounded-2xl" /> : null}
      {query.isError ? <p className="text-sm text-destructive">مفيش صلاحية لمركز المبيعات.</p> : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "إجمالي المبيعات", value: money(data.totals.gross), key: null },
              { label: "صافي المبيعات", value: money(data.totals.net), key: null },
              { label: "عدد الفواتير", value: String(data.totals.invoices), key: null },
              { label: "متوسط الفاتورة", value: money(data.totals.averageInvoice), key: null },
              { label: "المدفوع نقدًا", value: money(data.totals.cash), key: null },
              { label: "الآجل", value: money(data.totals.credit), key: "credit" },
              { label: "التحصيلات", value: money(data.totals.collections), key: null },
              { label: "المرتجعات", value: money(data.totals.refunds), key: "refunded" },
              { label: "الهالك", value: data.totals.waste == null ? NA : money(data.totals.waste), key: null },
              { label: "تكلفة البضاعة", value: data.totals.cost == null ? NA : money(data.totals.cost), key: null },
              { label: "إجمالي الربح", value: data.totals.profit == null ? NA : money(data.totals.profit), key: null },
              {
                label: "الهامش",
                value: data.totals.margin == null ? NA : `${data.totals.margin}%`,
                key: null,
              },
              { label: "عدد العملاء", value: String(data.totals.customers), key: null },
            ].map((card) => (
              <button
                key={card.label}
                type="button"
                onClick={() => setDrilldown(card.key)}
                className="rounded-2xl border border-border bg-surface p-4 text-start transition hover:border-primary"
              >
                <p className="text-xs text-muted-foreground">
                  {card.label} · {source === "all" ? "الكل" : SOURCE_LABEL[source]}
                </p>
                <p className="mt-1 text-xl font-extrabold">{card.value}</p>
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-surface p-5">
              <h3 className="font-extrabold">المبيعات اليومية</h3>
              {data.daily.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">مفيش بيانات في المدة دي.</p>
              ) : (
                <div className="mt-4 flex h-36 items-end gap-1">
                  {data.daily.map((d) => {
                    const max = Math.max(1, ...data.daily.map((x) => x.total));
                    return (
                      <div
                        key={d.date}
                        className="flex-1 rounded-t bg-primary/70"
                        style={{ height: `${Math.max(4, (d.total / max) * 100)}%` }}
                        title={`${d.date}: ${money(d.total)} — ${d.invoices} فاتورة`}
                      />
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-surface p-5">
              <h3 className="font-extrabold">أكتر المنتجات مبيعًا</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {data.topProducts.slice(0, 8).map((p) => (
                  <li key={p.name} className="flex justify-between gap-3">
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0 font-bold">
                      {p.qty} — {money(p.revenue)}
                    </span>
                  </li>
                ))}
                {data.topProducts.length === 0 ? (
                  <li className="text-muted-foreground">مفيش مبيعات في المدة دي.</li>
                ) : null}
              </ul>
            </section>
          </div>

          {source !== "inplace" && (unposted.data?.length ?? 0) > 0 ? (
            <section className="rounded-2xl border border-border bg-surface p-5">
              <h3 className="font-extrabold">طلبات ديليفري بدون اعتماد مالي</h3>
              <p className="text-xs text-muted-foreground">
                الطلب ما بيتحسبش في المبيعات إلا بعد اعتماده كفاتورة. الاعتماد آمن ومش بيكرر الفاتورة.
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {unposted.data!.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-2">
                    <span className="font-bold">{o.orderNumber}</span>
                    <span className="text-muted-foreground">{fmtTime(o.createdAt)}</span>
                    <span>{money(o.total)}</span>
                    <Button
                      size="sm"
                      className="ms-auto"
                      disabled={post.isPending}
                      onClick={() => post.mutate(o.id)}
                    >
                      اعتماد كفاتورة
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold">الفواتير</h3>
              {drilldown ? (
                <Button size="sm" variant="outline" onClick={() => setDrilldown(null)}>
                  إلغاء التصفية
                </Button>
              ) : null}
              <span className="ms-auto text-xs text-muted-foreground">{rows.length} فاتورة</span>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    {["رقم", "التاريخ", "المصدر", "العميل", "الإجمالي", "المدفوع", "المتبقي", "الحالة", ""].map(
                      (h) => (
                        <th key={h} className="p-2 text-start font-medium">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-2 font-bold">{r.invoiceNumber}</td>
                      <td className="p-2">{fmtTime(r.createdAt)}</td>
                      <td className="p-2">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{SOURCE_LABEL[r.source]}</span>
                      </td>
                      <td className="p-2">{r.customerName ?? "—"}</td>
                      <td className="p-2">{money(r.total)}</td>
                      <td className="p-2">{money(r.paid)}</td>
                      <td className="p-2">{money(r.due)}</td>
                      <td className="p-2">{r.status === "voided" ? "ملغاة" : r.paymentStatus}</td>
                      <td className="p-2">
                        <Button size="sm" variant="outline" onClick={() => setOpenInvoice(r.id)}>
                          تفاصيل
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-muted-foreground">
                        مفيش فواتير مطابقة للفلاتر.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      <InvoiceDialog storeSlug={storeSlug} invoiceId={openInvoice} onClose={() => setOpenInvoice(null)} />
    </div>
  );
}

function InvoiceDialog({
  storeSlug,
  invoiceId,
  onClose,
}: {
  storeSlug: string;
  invoiceId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const detail = useQuery({
    queryKey: ["invoice-detail", storeSlug, invoiceId],
    queryFn: () => salesInvoiceDetail({ data: { storeSlug, invoiceId: invoiceId! } }),
    enabled: Boolean(invoiceId),
    retry: false,
  });

  const cancel = useMutation({
    mutationFn: () => cancelDeliveryInvoice({ data: { storeSlug, invoiceId: invoiceId!, reason } }),
    onSuccess: () => {
      toast.success("تم الإلغاء المالي وتسجيل المرتجع");
      void qc.invalidateQueries({ queryKey: ["sales-center"] });
      void qc.invalidateQueries({ queryKey: ["invoice-detail"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const d = detail.data;

  return (
    <Dialog open={Boolean(invoiceId)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تفاصيل الفاتورة</DialogTitle>
        </DialogHeader>
        {detail.isLoading ? <Skeleton className="h-64 w-full" /> : null}
        {d ? (
          <div className="space-y-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-3">
              <Info label="رقم الفاتورة" value={d.invoiceNumber} />
              <Info label="التاريخ (القاهرة)" value={fmtTime(d.createdAt)} />
              <Info label="المصدر" value={SOURCE_LABEL[d.source]} />
              <Info label="الحالة" value={d.status === "voided" ? "ملغاة" : "معتمدة"} />
              <Info label="العميل" value={d.customer ? `${d.customer.name} — ${d.customer.phone}` : "—"} />
              <Info label="مرجع الطلب" value={d.deliveryOrderId ?? "—"} />
            </div>

            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  {["الصنف", "الباركود", "الكمية", "السعر", "الخصم", "الإجمالي"]
                    .concat(d.canSeeCost ? ["التكلفة", "الربح"] : [])
                    .map((h) => (
                      <th key={h} className="p-1 text-start font-medium">
                        {h}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {d.items.map((i) => (
                  <tr key={i.id} className="border-t border-border">
                    <td className="p-1">{i.name}</td>
                    <td className="p-1">{i.barcode ?? "—"}</td>
                    <td className="p-1">
                      {i.qty} {i.unit}
                    </td>
                    <td className="p-1">{money(i.unitPrice)}</td>
                    <td className="p-1">{money(i.discount)}</td>
                    <td className="p-1">{money(i.lineTotal)}</td>
                    {d.canSeeCost ? (
                      <>
                        <td className="p-1">{i.unitCost == null ? NA : money(i.unitCost)}</td>
                        <td className="p-1">{i.lineProfit == null ? NA : money(i.lineProfit)}</td>
                      </>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid gap-2 sm:grid-cols-4">
              <Info label="الإجمالي" value={money(d.total)} />
              <Info label="المدفوع" value={money(d.paid)} />
              <Info label="المتبقي" value={money(d.due)} />
              <Info label="المرتجعات" value={money(d.refunds.reduce((s, r) => s + r.amount, 0))} />
            </div>

            <section>
              <h4 className="font-bold">التسلسل الزمني</h4>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {d.timeline.map((t, idx) => (
                  <li key={`${t.at}-${idx}`}>
                    {fmtTime(t.at)} — {t.label}
                  </li>
                ))}
              </ul>
            </section>

            {d.source === "delivery" && d.status !== "voided" ? (
              <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border p-3">
                <div className="flex-1">
                  <Label className="text-xs">سبب الإلغاء المالي</Label>
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب واضح" />
                </div>
                <Button
                  variant="destructive"
                  disabled={reason.trim().length < 3 || cancel.isPending}
                  onClick={() => cancel.mutate()}
                >
                  إلغاء مالي
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}
