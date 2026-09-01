import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { toast } from "sonner";

import { InvoicePrint } from "@/components/pos/InvoicePrint";
import { usePos } from "@/components/pos/PosShell";
import { POS_MANAGE_ROLES, posCan } from "@/components/pos/pos-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/format";
import { posGetInvoice, posListInvoices, posVoidInvoice } from "@/lib/pos.functions";
import type { PosInvoiceFull, PosInvoiceSummary } from "@/types/pos";

export const Route = createFileRoute("/pos/invoices")({
  head: () => ({
    meta: [
      { title: "الفواتير | تِكّة" },
      { name: "description", content: "كل فواتير الكاشير: مراجعة، إعادة طباعة وإلغاء بسبب موثّق." },
      { property: "og:title", content: "الفواتير | تِكّة" },
      { property: "og:description", content: "سجل فواتير نقاط البيع مع إعادة الطباعة والإلغاء." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvoicesPage,
});

const STATUS_LABELS: Record<PosInvoiceSummary["status"], string> = {
  draft: "مسودة",
  confirmed: "مؤكدة",
  voided: "ملغاة",
  refunded: "مرتجعة",
};

export function InvoicesPage() {
  const pos = usePos();
  const [rows, setRows] = useState<PosInvoiceSummary[]>([]);
  const [selected, setSelected] = useState<PosInvoiceFull | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const canVoid = posCan(pos.role, POS_MANAGE_ROLES);

  const load = async () => {
    try {
      setRows(await posListInvoices({ data: { storeId: pos.storeId, limit: 100 } }));
    } catch {
      toast.error("مقدرناش نحمّل الفواتير.");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.storeId]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="space-y-4">
        <h1 className="text-2xl font-extrabold">الفواتير</h1>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">مفيش فواتير لسه.</li>
          ) : (
            rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-start hover:bg-muted"
                  onClick={async () => {
                    try {
                      setSelected(await posGetInvoice({ data: { invoiceId: row.id } }));
                    } catch {
                      toast.error("مقدرناش نفتح الفاتورة.");
                    }
                  }}
                >
                  <span className="font-semibold">{row.invoiceNumber}</span>
                  <span className="text-xs text-muted-foreground">
                    {row.itemsCount} صنف · {row.customerName ?? "بدون عميل"} · {STATUS_LABELS[row.status]}
                  </span>
                  <span className="font-bold tabular-nums">{formatPrice(row.total)}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      <aside className="space-y-3">
        {selected ? (
          <>
            <div className="flex items-center justify-between">
              <p className="font-semibold">{selected.invoiceNumber}</p>
              <Button size="sm" variant="outline" onClick={() => window.print()}>
                <Printer className="size-4" />
                طباعة
              </Button>
            </div>
            <InvoicePrint invoice={selected} storeName={pos.storeName} />

            {canVoid && selected.status === "confirmed" ? (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <Input
                  value={reason}
                  placeholder="سبب الإلغاء (إجباري)"
                  onChange={(event) => setReason(event.target.value)}
                />
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={busy || reason.trim().length < 3}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await posVoidInvoice({ data: { invoiceId: selected.id, reason: reason.trim() } });
                      toast.success("الفاتورة اتلغت والمخزون رجع.");
                      setReason("");
                      setSelected(null);
                      await load();
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "الإلغاء فشل.");
                    }
                    setBusy(false);
                  }}
                >
                  إلغاء الفاتورة
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            اختار فاتورة من القائمة لعرضها.
          </p>
        )}
      </aside>
    </div>
  );
}
