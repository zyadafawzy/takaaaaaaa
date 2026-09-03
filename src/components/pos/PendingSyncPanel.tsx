import { AlertTriangle, RefreshCw, Trash2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { MAX_SYNC_ATTEMPTS, useOffline } from "@/lib/offline/offline";

const OP_LABELS: Record<string, string> = {
  adjustStock: "تعديل مخزون",
  purchase: "فاتورة مشتريات",
  damage: "هوالك/تالف",
  createCustomer: "عميل جديد",
  customerPayment: "دفعة عميل",
};

const time = (value: string) =>
  new Intl.DateTimeFormat("ar-EG", { timeZone: "Africa/Cairo", dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );

/** شاشة مراجعة كل اللي لسه متأخر على السيرفر: فواتير أوفلاين + عمليات مخزون/عملاء. */
export function PendingSyncPanel() {
  const offline = useOffline();

  if (!offline) {
    return <p className="text-muted-foreground">الوضع الأوفلاين مش مفعّل في الشاشة دي.</p>;
  }

  const { outbox, ops, syncedInvoices } = offline;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">الفواتير والعمليات المعلّقة</h1>
          <p className="text-sm text-muted-foreground">
            {outbox.length} فاتورة و{ops.length} عملية مستنية الرفع · أقصى محاولات تلقائية {MAX_SYNC_ATTEMPTS}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" disabled={offline.syncing} onClick={() => void offline.sync()}>
            <UploadCloud className="size-4" />
            ارفع الآن
          </Button>
          {syncedInvoices.length > 0 ? (
            <Button size="sm" variant="outline" onClick={() => void offline.clearSynced()}>
              تنظيف المرفوع
            </Button>
          ) : null}
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">فواتير مستنية الرفع</h2>
        {outbox.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            مفيش فواتير متأخرة — كل حاجة مرفوعة.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {outbox.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="flex-1">
                  <p className="font-semibold">
                    {item.localNumber} · {formatPrice(item.total)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {time(item.createdAt)} · محاولات {item.attempts}/{MAX_SYNC_ATTEMPTS}
                  </p>
                  {item.lastError ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle className="size-3" />
                      {item.blocked ? "اتوقف بعد محاولات كتير: " : ""}
                      {item.lastError}
                    </p>
                  ) : null}
                </div>
                <Button size="sm" variant="outline" onClick={() => void offline.retryItem(item.id)}>
                  <RefreshCw className="size-4" />
                  إعادة المحاولة
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm("حذف الفاتورة المعلّقة نهائيًا؟ مش هتترفع على السيرفر.")) {
                      void offline.removeItem(item.id);
                    }
                  }}
                >
                  <Trash2 className="size-4 text-destructive" />
                  حذف
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">عمليات متأخرة (مخزون · مشتريات · عملاء)</h2>
        {ops.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            مفيش عمليات متأخرة.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {ops.map((op) => (
              <li key={op.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="flex-1">
                  <p className="font-semibold">
                    {OP_LABELS[op.type] ?? op.type} — {op.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {time(op.createdAt)} · محاولات {op.attempts}/{MAX_SYNC_ATTEMPTS}
                  </p>
                  {op.lastError ? (
                    <p className="mt-1 text-xs text-destructive">{op.lastError}</p>
                  ) : null}
                </div>
                <Button size="sm" variant="outline" onClick={() => void offline.retryOp(op.id)}>
                  <RefreshCw className="size-4" />
                  إعادة المحاولة
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void offline.removeOp(op.id)}>
                  <Trash2 className="size-4 text-destructive" />
                  حذف
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {syncedInvoices.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">اترفعت (الرقم المحلي ← الرقم الرسمي)</h2>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {syncedInvoices.slice(-30).reverse().map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span className="font-mono">{item.localNumber}</span>
                <span aria-hidden>←</span>
                <span className="font-mono font-bold">{item.officialNumber}</span>
                <span className="text-xs text-muted-foreground">{formatPrice(item.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
