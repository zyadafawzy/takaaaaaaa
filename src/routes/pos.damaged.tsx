import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { usePos } from "@/components/pos/PosShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/format";
import { posListDamaged, posRecordDamage } from "@/lib/pos-ops.functions";
import { posSearchVariants } from "@/lib/pos.functions";

export const Route = createFileRoute("/pos/damaged")({
  head: () => ({
    meta: [
      { title: "هوالك وتالف | كاشير تِكّة" },
      { name: "description", content: "تسجيل التالف والمنتهي الصلاحية وخصمه من المخزون بتكلفته." },
      { property: "og:title", content: "هوالك وتالف | كاشير تِكّة" },
      { property: "og:description", content: "سجّل الهالك والمنتهي وشوف تكلفته على المتجر." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DamagedPage,
});

type Row = Awaited<ReturnType<typeof posListDamaged>>[number];
type Found = Awaited<ReturnType<typeof posSearchVariants>>[number];

function DamagedPage() {
  const pos = usePos();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  const [picked, setPicked] = useState<Found | null>(null);
  const [qty, setQty] = useState("1");
  const [kind, setKind] = useState<"damage" | "expiry">("damage");
  const [reason, setReason] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const load = useCallback(async () => {
    try {
      setRows(await posListDamaged({ data: { storeId: pos.storeId } }));
    } catch {
      toast.error("مقدرناش نجيب سجل الهوالك.");
    }
  }, [pos.storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!picked) return;
    const quantity = Number(qty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("اكتب كمية صحيحة.");
      return;
    }
    setBusy(true);
    try {
      const result = await posRecordDamage({
        data: {
          storeId: pos.storeId,
          branchId: pos.branchId,
          variantId: picked.variantId,
          qty: quantity,
          kind,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
          ...(kind === "expiry" && expiryDate ? { expiryDate } : {}),
        },
      });
      toast.success(`اتسجّل — تكلفة ${formatPrice(Number(result.cost_value) || 0)}`);
      setPicked(null);
      setResults([]);
      setQuery("");
      setQty("1");
      setReason("");
      setExpiryDate("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "التسجيل فشل.");
    }
    setBusy(false);
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">هوالك وتالف</h1>
        <p className="text-sm text-muted-foreground">
          خصم التالف أو المنتهي من المخزون مع حساب تكلفته على المتجر.
        </p>
      </header>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="space-y-1">
          <Label htmlFor="dmg-search">ابحث بالصنف</Label>
          <div className="flex gap-2">
            <Input
              id="dmg-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="اسم المنتج"
            />
            <Button
              variant="outline"
              disabled={busy || query.trim().length < 2}
              onClick={async () => {
                setBusy(true);
                try {
                  const found = await posSearchVariants({
                    data: { storeId: pos.storeId, branchId: pos.branchId, query: query.trim() },
                  });
                  setResults(found);
                  if (found.length === 0) toast.info("مفيش نتائج.");
                } catch {
                  toast.error("البحث فشل.");
                }
                setBusy(false);
              }}
            >
              بحث
            </Button>
          </div>
        </div>

        {results.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {results.map((item) => (
              <li key={item.variantId}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between p-2 text-start hover:bg-muted"
                  onClick={() => {
                    setPicked(item);
                    setResults([]);
                  }}
                >
                  <span>{item.productName}</span>
                  <span className="text-xs text-muted-foreground">متاح {item.stock}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {picked ? (
          <div className="space-y-3 rounded-lg bg-muted p-3">
            <p className="font-semibold">{picked.productName}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="dmg-qty">الكمية</Label>
                <Input id="dmg-qty" value={qty} inputMode="decimal" onChange={(event) => setQty(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dmg-kind">النوع</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={kind === "damage" ? "default" : "outline"}
                    onClick={() => setKind("damage")}
                  >
                    تالف
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={kind === "expiry" ? "default" : "outline"}
                    onClick={() => setKind("expiry")}
                  >
                    منتهي
                  </Button>
                </div>
              </div>
              {kind === "expiry" ? (
                <div className="space-y-1">
                  <Label htmlFor="dmg-exp">تاريخ الانتهاء</Label>
                  <Input
                    id="dmg-exp"
                    type="date"
                    value={expiryDate}
                    onChange={(event) => setExpiryDate(event.target.value)}
                  />
                </div>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="dmg-reason">السبب</Label>
              <Input id="dmg-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>
            <Button disabled={busy} onClick={() => void submit()}>
              سجّل الخصم
            </Button>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-bold">آخر السجلات</h2>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            مفيش سجلات.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {rows.map((row) => (
              <li key={`${row.kind}-${row.id}`} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div>
                  <p className="font-semibold">{row.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.kind === "damage" ? "تالف" : "منتهي"} · {row.reason ?? "—"}
                  </p>
                </div>
                <p className="text-sm tabular-nums">
                  {row.qty} · {formatPrice(row.costValue)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
