import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { usePos } from "@/components/pos/PosShell";
import { POS_STOCK_ROLES, posCan } from "@/components/pos/pos-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/format";
import { posAdjustStock, posInventory, posStockAlerts } from "@/lib/pos.functions";

export const Route = createFileRoute("/pos/inventory")({
  head: () => ({
    meta: [
      { title: "المخزون | تِكّة" },
      { name: "description", content: "أرصدة المخزون لكل فرع، تنبيهات النقص والنفاد وتسوية الكميات بسبب موثّق." },
      { property: "og:title", content: "المخزون | تِكّة" },
      { property: "og:description", content: "متابعة أرصدة الأصناف والتنبيهات وتسوية الجرد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InventoryPage,
});

type Row = Awaited<ReturnType<typeof posInventory>>[number];
type Alert = Awaited<ReturnType<typeof posStockAlerts>>[number];

export function InventoryPage() {
  const pos = usePos();
  const [rows, setRows] = useState<Row[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [query, setQuery] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const canAdjust = posCan(pos.role, POS_STOCK_ROLES);

  const load = async () => {
    try {
      const [inventory, stockAlerts] = await Promise.all([
        posInventory({ data: { storeId: pos.storeId, branchId: pos.branchId, query: query || undefined } }),
        posStockAlerts({ data: { storeId: pos.storeId } }),
      ]);
      setRows(inventory);
      setAlerts(stockAlerts);
    } catch {
      toast.error("مقدرناش نحمّل المخزون.");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.storeId, pos.branchId]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">المخزون</h1>

      {alerts.length > 0 ? (
        <div className="rounded-lg border border-border bg-muted p-3 text-sm">
          <p className="mb-1 font-semibold">تنبيهات ({alerts.length})</p>
          <ul className="flex flex-wrap gap-2">
            {alerts.slice(0, 12).map((alert) => (
              <li key={alert.id} className="rounded-md bg-card px-2 py-1">
                {alert.productName} — {alert.alertType === "out_of_stock" ? "نفد" : "قارب على النفاد"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Input
          value={query}
          placeholder="ابحث باسم الصنف"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void load();
          }}
        />
        <Button variant="secondary" onClick={() => void load()}>
          بحث
        </Button>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {rows.length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">مفيش أرصدة مسجلة.</li>
        ) : (
          rows.map((row) => (
            <li key={`${row.variantId}-${row.branchId ?? "main"}`} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-40 flex-1">
                <p className="font-semibold">{row.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatPrice(row.price)} / {row.unitLabel} · حد التنبيه {row.minStockQty}
                </p>
              </div>
              <p className={`w-24 text-center font-bold tabular-nums ${row.qtyOnHand <= 0 ? "text-destructive" : ""}`}>
                {row.qtyOnHand}
              </p>
              {canAdjust ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={edits[row.variantId] ?? ""}
                    inputMode="decimal"
                    placeholder="الرصيد الفعلي"
                    aria-label="الرصيد الفعلي"
                    className="h-9 w-32"
                    onChange={(event) => setEdits({ ...edits, [row.variantId]: event.target.value })}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || edits[row.variantId] === undefined || edits[row.variantId] === ""}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await posAdjustStock({
                          data: {
                            storeId: pos.storeId,
                            branchId: pos.branchId,
                            variantId: row.variantId,
                            qtyNew: Number(edits[row.variantId]),
                            reason: "تسوية جرد من شاشة المخزون",
                          },
                        });
                        toast.success("الرصيد اتعدّل واتسجّل في حركة المخزون.");
                        setEdits({ ...edits, [row.variantId]: "" });
                        await load();
                      } catch {
                        toast.error("التسوية فشلت.");
                      }
                      setBusy(false);
                    }}
                  >
                    تسوية
                  </Button>
                </div>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
