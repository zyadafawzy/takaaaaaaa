import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { usePos } from "@/components/pos/PosShell";
import { POS_STOCK_ROLES, posCan } from "@/components/pos/pos-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/format";
import { posCreatePurchase, posListPurchases, posListSuppliers, posSearchVariants } from "@/lib/pos.functions";

export const Route = createFileRoute("/pos/purchases")({
  head: () => ({
    meta: [
      { title: "المشتريات | تِكّة" },
      { name: "description", content: "تسجيل فواتير الشراء من الموردين وتحديث المخزون والتكلفة تلقائيًا." },
      { property: "og:title", content: "المشتريات | تِكّة" },
      { property: "og:description", content: "فواتير شراء ترفع المخزون وتحدّث سعر التكلفة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PurchasesPage,
});

type Purchase = Awaited<ReturnType<typeof posListPurchases>>[number];
type Supplier = Awaited<ReturnType<typeof posListSuppliers>>[number];
type Line = { variantId: string; productName: string; costPrice: string; qty: string; expiryDate: string };

function todayCairo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
}

export function PurchasesPage() {
  const pos = usePos();
  const [rows, setRows] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayCairo());
  const [paidAmount, setPaidAmount] = useState("0");
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof posSearchVariants>>>([]);
  const [busy, setBusy] = useState(false);
  const canWrite = posCan(pos.role, POS_STOCK_ROLES);

  const load = async () => {
    try {
      const [purchases, supplierList] = await Promise.all([
        posListPurchases({ data: { storeId: pos.storeId } }),
        posListSuppliers({ data: { storeId: pos.storeId } }),
      ]);
      setRows(purchases);
      setSuppliers(supplierList);
      setSupplierId((current) => current || supplierList[0]?.id || "");
    } catch {
      toast.error("مقدرناش نحمّل المشتريات.");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.storeId]);

  const total = lines.reduce((sum, line) => sum + (Number(line.costPrice) || 0) * (Number(line.qty) || 0), 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <section className="space-y-4">
        <h1 className="text-2xl font-extrabold">فواتير الشراء</h1>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">مفيش فواتير شراء.</li>
          ) : (
            rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="font-semibold">{row.supplierName}</span>
                <span className="text-xs text-muted-foreground">
                  {row.invoiceNumber ?? "—"} · {row.invoiceDate} · {row.status === "confirmed" ? "مؤكدة" : "مسودة"}
                </span>
                <span className="font-bold tabular-nums">{formatPrice(row.total)}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      {canWrite ? (
        <section className="space-y-4 rounded-lg border border-dashed border-border p-4">
          <p className="font-semibold">فاتورة شراء جديدة</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="p-supplier">المورد</Label>
              <select
                id="p-supplier"
                className="h-10 w-full rounded-md border border-input bg-background px-2"
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
              >
                <option value="">اختار مورد</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-number">رقم فاتورة المورد</Label>
              <Input id="p-number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-date">التاريخ</Label>
              <Input id="p-date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-paid">المدفوع</Label>
              <Input
                id="p-paid"
                value={paidAmount}
                inputMode="decimal"
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              value={query}
              placeholder="ابحث عن صنف بالاسم"
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

          {results.length > 0 ? (
            <ul className="max-h-40 divide-y divide-border overflow-auto rounded-lg border border-border text-sm">
              {results.map((item) => (
                <li key={item.variantId}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between p-2 text-start hover:bg-muted"
                    onClick={() => {
                      setLines((current) => [
                        ...current,
                        {
                          variantId: item.variantId,
                          productName: item.productName,
                          costPrice: String(item.costPrice ?? 0),
                          qty: "1",
                          expiryDate: "",
                        },
                      ]);
                      setResults([]);
                      setQuery("");
                    }}
                  >
                    <span>{item.productName}</span>
                    <Plus className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <ul className="space-y-2">
            {lines.map((line, index) => (
              <li key={`${line.variantId}-${index}`} className="flex flex-wrap items-center gap-2">
                <span className="min-w-32 flex-1 text-sm font-medium">{line.productName}</span>
                <Input
                  value={line.costPrice}
                  inputMode="decimal"
                  aria-label="التكلفة"
                  className="h-9 w-24"
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((l, i) => (i === index ? { ...l, costPrice: event.target.value } : l)),
                    )
                  }
                />
                <Input
                  value={line.qty}
                  inputMode="decimal"
                  aria-label="الكمية"
                  className="h-9 w-20"
                  onChange={(event) =>
                    setLines((current) => current.map((l, i) => (i === index ? { ...l, qty: event.target.value } : l)))
                  }
                />
                <Input
                  value={line.expiryDate}
                  type="date"
                  aria-label="تاريخ الانتهاء"
                  className="h-9 w-40"
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((l, i) => (i === index ? { ...l, expiryDate: event.target.value } : l)),
                    )
                  }
                />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="حذف السطر"
                  onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between font-bold">
            <span>إجمالي الفاتورة</span>
            <span className="tabular-nums">{formatPrice(total)}</span>
          </div>

          <Button
            className="w-full"
            disabled={busy || !supplierId || lines.length === 0}
            onClick={async () => {
              setBusy(true);
              try {
                await posCreatePurchase({
                  data: {
                    storeId: pos.storeId,
                    branchId: pos.branchId,
                    supplierId,
                    invoiceNumber: invoiceNumber.trim() || undefined,
                    invoiceDate,
                    paidAmount: Number(paidAmount) || 0,
                    confirm: true,
                    items: lines.map((line) => ({
                      variantId: line.variantId,
                      productName: line.productName,
                      costPrice: Number(line.costPrice) || 0,
                      qty: Number(line.qty) || 0,
                      expiryDate: line.expiryDate || null,
                    })),
                  },
                });
                toast.success("فاتورة الشراء اتأكدت والمخزون اتحدّث.");
                setLines([]);
                setInvoiceNumber("");
                setPaidAmount("0");
                await load();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "الفاتورة فشلت.");
              }
              setBusy(false);
            }}
          >
            تأكيد الفاتورة
          </Button>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">تسجيل المشتريات متاح لأمين المخزن والمديرين.</p>
      )}
    </div>
  );
}
