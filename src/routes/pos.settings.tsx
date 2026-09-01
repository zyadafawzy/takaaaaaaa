import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { usePos } from "@/components/pos/PosShell";
import { POS_ROLE_LABELS, POS_STOCK_ROLES, posCan } from "@/components/pos/pos-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTimeAr } from "@/lib/format";
import { posAttachBarcode, posSearchVariants, posUnknownScans } from "@/lib/pos.functions";

export const Route = createFileRoute("/pos/settings")({
  head: () => ({
    meta: [
      { title: "إعدادات نقاط البيع | تِكّة" },
      { name: "description", content: "الفروع، طرق الدفع، ربط الباركودات غير المعروفة وصلاحيات فريق الكاشير." },
      { property: "og:title", content: "إعدادات نقاط البيع | تِكّة" },
      { property: "og:description", content: "ضبط الفروع وطرق الدفع وربط الباركودات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

type UnknownScan = Awaited<ReturnType<typeof posUnknownScans>>[number];

export function SettingsPage() {
  const pos = usePos();
  const [scans, setScans] = useState<UnknownScan[]>([]);
  const [activeBarcode, setActiveBarcode] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof posSearchVariants>>>([]);
  const [busy, setBusy] = useState(false);
  const canLink = posCan(pos.role, POS_STOCK_ROLES);

  const load = async () => {
    try {
      setScans(await posUnknownScans({ data: { storeId: pos.storeId } }));
    } catch {
      toast.error("مقدرناش نحمّل الباركودات غير المعروفة.");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.storeId]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-extrabold">إعدادات نقاط البيع</h1>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border">
          <h2 className="border-b border-border p-3 font-bold">الفروع</h2>
          <ul className="divide-y divide-border text-sm">
            {pos.branches.length === 0 ? (
              <li className="p-3 text-muted-foreground">مفيش فروع.</li>
            ) : (
              pos.branches.map((branch) => (
                <li key={branch.id} className="flex items-center justify-between p-3">
                  <span className="font-medium">{branch.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {branch.allowNegativeStock ? "يسمح بالمخزون السالب" : "لا يسمح بالمخزون السالب"}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-lg border border-border">
          <h2 className="border-b border-border p-3 font-bold">طرق الدفع</h2>
          <ul className="divide-y divide-border text-sm">
            {pos.paymentMethods.length === 0 ? (
              <li className="p-3 text-muted-foreground">مفيش طرق دفع.</li>
            ) : (
              pos.paymentMethods.map((method) => (
                <li key={method.id} className="flex items-center justify-between p-3">
                  <span className="font-medium">{method.name}</span>
                  <span className="text-xs text-muted-foreground">{method.type}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section className="rounded-lg border border-border p-4">
        <h2 className="font-bold">صلاحيتك</h2>
        <p className="text-sm text-muted-foreground">
          {POS_ROLE_LABELS[pos.role]} في «{pos.storeName}». إضافة أعضاء جدد لنقاط البيع تتم من لوحة إدارة المتجر.
        </p>
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="font-bold">باركودات غير معروفة ({scans.length})</h2>
        {scans.length === 0 ? (
          <p className="text-sm text-muted-foreground">مفيش باركودات مجهولة — تمام.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {scans.map((scan) => (
              <li key={scan.id} className="flex flex-wrap items-center justify-between gap-2 p-2">
                <span className="font-mono">{scan.barcode}</span>
                <span className="text-xs text-muted-foreground">{formatDateTimeAr(scan.scannedAt)}</span>
                {canLink ? (
                  <Button
                    size="sm"
                    variant={activeBarcode === scan.barcode ? "default" : "outline"}
                    onClick={() => setActiveBarcode(scan.barcode)}
                  >
                    اربطه بصنف
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {activeBarcode && canLink ? (
          <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
            <Label htmlFor="link-query">اختار الصنف للباركود {activeBarcode}</Label>
            <div className="flex gap-2">
              <Input
                id="link-query"
                value={query}
                placeholder="اسم الصنف"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={async (event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  try {
                    setResults(await posSearchVariants({ data: { storeId: pos.storeId, query: query.trim() } }));
                  } catch {
                    toast.error("البحث فشل.");
                  }
                }}
              />
            </div>
            <ul className="max-h-40 divide-y divide-border overflow-auto rounded-md border border-border text-sm">
              {results.map((item) => (
                <li key={item.variantId}>
                  <button
                    type="button"
                    className="w-full p-2 text-start hover:bg-muted"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await posAttachBarcode({
                          data: { storeId: pos.storeId, variantId: item.variantId, barcode: activeBarcode },
                        });
                        toast.success("الباركود اترابط.");
                        setActiveBarcode(null);
                        setResults([]);
                        setQuery("");
                        await load();
                      } catch {
                        toast.error("الربط فشل.");
                      }
                      setBusy(false);
                    }}
                  >
                    {item.productName}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
