import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { UnknownBarcodeDialog } from "@/components/pos/UnknownBarcodeDialog";
import { usePos } from "@/components/pos/PosShell";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { posListUnknownScans, posResolveUnknownBarcode } from "@/lib/pos-ops.functions";
import type { PosUnknownGroup } from "@/types/pos";

export const Route = createFileRoute("/pos/unknown")({
  head: () => ({
    meta: [
      { title: "أصناف مجهولة | كاشير تِكّة" },
      { name: "description", content: "الباركودات اللي اتمسحت ومش مسجّلة، مع تسجيلها منتجات فورًا." },
      { property: "og:title", content: "أصناف مجهولة | كاشير تِكّة" },
      { property: "og:description", content: "راجع الباركودات المجهولة وسجّلها منتجات بسعر ورصيد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UnknownScansPage,
});

export function UnknownScansPage() {
  const pos = usePos();
  const [groups, setGroups] = useState<PosUnknownGroup[]>([]);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<PosUnknownGroup | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setGroups(await posListUnknownScans({ data: { storeId: pos.storeId } }));
    } catch {
      toast.error("مقدرناش نجيب الأصناف المجهولة.");
    }
    setBusy(false);
  }, [pos.storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">أصناف مجهولة</h1>
          <p className="text-sm text-muted-foreground">
            كل باركود اتمسح ومش موجود في الكتالوج — سجّله منتج مرة واحدة وميظهرش تاني.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={busy}>
          تحديث
        </Button>
      </header>

      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          مفيش باركودات مجهولة — تمام كده.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {groups.map((group) => (
            <li key={group.barcode} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-48">
                <p className="font-mono font-semibold">{group.barcode}</p>
                <p className="text-xs text-muted-foreground">
                  {group.names.slice(0, 2).join(" · ")} — اتمسح {group.times} مرة · كمية {group.totalQty}
                </p>
              </div>
              <div className="text-sm">
                <p className="tabular-nums">قيمة مباعة: {formatPrice(group.totalValue)}</p>
                {group.lastPrice != null ? (
                  <p className="text-xs text-muted-foreground tabular-nums">آخر سعر: {formatPrice(group.lastPrice)}</p>
                ) : null}
              </div>
              <Button size="sm" onClick={() => setTarget(group)}>
                سجّله منتج
              </Button>
            </li>
          ))}
        </ul>
      )}

      <UnknownBarcodeDialog
        open={Boolean(target)}
        barcode={target?.barcode ?? ""}
        busy={busy}
        onClose={() => setTarget(null)}
        onSellManual={() => setTarget(null)}
        onRegister={async (input) => {
          if (!target) return;
          setBusy(true);
          try {
            await posResolveUnknownBarcode({
              data: {
                storeId: pos.storeId,
                branchId: pos.branchId,
                barcode: target.barcode,
                name: input.name,
                sellPrice: input.sellPrice,
                unitLabel: input.unitLabel,
                initialQty: input.initialQty,
              },
            });
            toast.success("الصنف اتسجّل وربطناه بالباركود.");
            setTarget(null);
            await load();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "التسجيل فشل.");
          }
          setBusy(false);
        }}
      />
    </section>
  );
}
