import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { BarcodeScanner } from "@/components/pos/BarcodeScanner";
import { CartPanel } from "@/components/pos/CartPanel";
import { CustomerSelector } from "@/components/pos/CustomerSelector";
import { InvoicePrint } from "@/components/pos/InvoicePrint";
import { PaymentModal, type PaymentSplit } from "@/components/pos/PaymentModal";
import { usePos } from "@/components/pos/PosShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/format";
import {
  posAttachBarcode,
  posCheckout,
  posCreateCustomer,
  posGetInvoice,
  posListCustomers,
  posScanBarcode,
  posSearchVariants,
} from "@/lib/pos.functions";
import { lineTotal, type PosCartLine, type PosCustomer, type PosInvoiceFull } from "@/types/pos";

export const Route = createFileRoute("/pos/")({
  head: () => ({
    meta: [
      { title: "الكاشير | تِكّة" },
      { name: "description", content: "شاشة البيع السريع: مسح الباركود، السلة، الدفع وطباعة الفاتورة." },
      { property: "og:title", content: "الكاشير | تِكّة" },
      { property: "og:description", content: "بيع سريع بالباركود مع طباعة فاتورة حرارية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CashierPage,
});

function CashierPage() {
  const pos = usePos();
  const [lines, setLines] = useState<PosCartLine[]>([]);
  const [results, setResults] = useState<Omit<PosCartLine, "qty" | "discountPct" | "barcode">[]>([]);
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [customers, setCustomers] = useState<PosCustomer[]>([]);
  const [invoiceDiscount, setInvoiceDiscount] = useState("0");
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<PosInvoiceFull | null>(null);
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);

  const subtotal = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const discount = Math.min(Number(invoiceDiscount) || 0, subtotal);
  const total = Math.round((subtotal - discount) * 100) / 100;

  const addLine = (item: Omit<PosCartLine, "qty" | "discountPct" | "barcode"> & { barcode?: string | null }) => {
    setLines((current) => {
      const existing = current.find((line) => line.variantId === item.variantId);
      if (existing) {
        return current.map((line) =>
          line.variantId === item.variantId ? { ...line, qty: line.qty + 1 } : line,
        );
      }
      return [
        ...current,
        { ...item, qty: 1, discountPct: 0, barcode: item.barcode ?? null } as PosCartLine,
      ];
    });
    setResults([]);
  };

  const handleScan = async (barcode: string) => {
    setBusy(true);
    try {
      const hit = await posScanBarcode({ data: { storeId: pos.storeId, branchId: pos.branchId, barcode } });
      if (!hit.found) {
        setPendingBarcode(hit.barcode);
        toast.error(`باركود غير معروف: ${hit.barcode} — ابحث بالاسم واربطه.`);
      } else {
        addLine(hit);
      }
    } catch {
      toast.error("مقدرناش نقرأ الباركود.");
    }
    setBusy(false);
  };

  const handleSearch = async (query: string) => {
    setBusy(true);
    try {
      const found = await posSearchVariants({ data: { storeId: pos.storeId, branchId: pos.branchId, query } });
      setResults(found);
      if (found.length === 0) toast.info("مفيش نتائج بالاسم ده.");
    } catch {
      toast.error("البحث فشل.");
    }
    setBusy(false);
  };

  const checkout = async (payments: PaymentSplit[]) => {
    if (!pos.shift) {
      toast.error("افتح وردية الأول.");
      return;
    }
    setBusy(true);
    try {
      const result = await posCheckout({
        data: {
          storeId: pos.storeId,
          branchId: pos.branchId,
          shiftId: pos.shift.id,
          customerId: customer?.id ?? null,
          discountAmount: discount,
          taxAmount: 0,
          lines: lines.map((line) => ({
            variantId: line.variantId,
            productId: line.productId,
            productName: line.productName,
            unitLabel: line.unitLabel,
            sellPrice: line.sellPrice,
            costPrice: line.costPrice ?? null,
            qty: line.qty,
            discountPct: line.discountPct,
            barcode: line.barcode ?? null,
          })),
          payments: payments.map((p) => ({ methodId: p.methodId, amount: p.amount })),
        },
      });
      const full = await posGetInvoice({ data: { invoiceId: result.invoiceId } });
      setLastInvoice(full);
      setLines([]);
      setCustomer(null);
      setInvoiceDiscount("0");
      setPayOpen(false);
      toast.success(`تم البيع — ${result.invoiceNumber} · الباقي ${formatPrice(result.change)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "الفاتورة فشلت.");
    }
    setBusy(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <section className="space-y-4">
        <h1 className="text-2xl font-extrabold">الكاشير</h1>

        <BarcodeScanner onScan={handleScan} onSearch={handleSearch} busy={busy} disabled={!pos.shift} />

        {pendingBarcode ? (
          <div className="rounded-lg border border-dashed border-border p-3 text-sm">
            باركود <span className="font-mono">{pendingBarcode}</span> غير مربوط. اختار الصنف من نتائج البحث تحت
            وهنربطه تلقائيًا.
            <Button size="sm" variant="ghost" onClick={() => setPendingBarcode(null)}>
              إلغاء
            </Button>
          </div>
        ) : null}

        {results.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {results.map((item) => (
              <li key={item.variantId}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between p-3 text-start hover:bg-muted"
                  onClick={async () => {
                    addLine(item);
                    if (pendingBarcode) {
                      try {
                        await posAttachBarcode({
                          data: { storeId: pos.storeId, variantId: item.variantId, barcode: pendingBarcode },
                        });
                        toast.success("الباركود اترابط بالصنف.");
                      } catch {
                        toast.error("مقدرناش نربط الباركود — محتاج صلاحية مخزن.");
                      }
                      setPendingBarcode(null);
                    }
                  }}
                >
                  <span className="font-medium">{item.productName}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatPrice(item.sellPrice)} · متاح {item.stock}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <CartPanel
          lines={lines}
          onQty={(variantId, qty) =>
            setLines((current) => current.map((line) => (line.variantId === variantId ? { ...line, qty } : line)))
          }
          onDiscount={(variantId, discountPct) =>
            setLines((current) =>
              current.map((line) => (line.variantId === variantId ? { ...line, discountPct } : line)),
            )
          }
          onRemove={(variantId) => setLines((current) => current.filter((line) => line.variantId !== variantId))}
        />
      </section>

      <aside className="space-y-4">
        <CustomerSelector
          selected={customer}
          customers={customers}
          busy={busy}
          onSelect={setCustomer}
          onSearch={async (query) => {
            try {
              setCustomers(await posListCustomers({ data: { storeId: pos.storeId, query: query || undefined } }));
            } catch {
              toast.error("البحث عن العملاء فشل.");
            }
          }}
          onCreate={async (input) => {
            try {
              await posCreateCustomer({ data: { storeId: pos.storeId, ...input } });
              const list = await posListCustomers({ data: { storeId: pos.storeId, query: input.name } });
              setCustomers(list);
              toast.success("العميل اتضاف.");
            } catch {
              toast.error("مقدرناش نضيف العميل.");
            }
          }}
        />

        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between text-sm">
            <span>المجموع</span>
            <span className="tabular-nums">{formatPrice(subtotal)}</span>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pos-invoice-discount">خصم على الفاتورة</Label>
            <Input
              id="pos-invoice-discount"
              value={invoiceDiscount}
              inputMode="decimal"
              onChange={(event) => setInvoiceDiscount(event.target.value)}
            />
          </div>
          <div className="flex items-center justify-between text-lg font-extrabold">
            <span>الإجمالي</span>
            <span className="tabular-nums">{formatPrice(total)}</span>
          </div>

          <Button
            className="h-14 w-full text-lg"
            disabled={lines.length === 0 || busy || !pos.shift}
            onClick={() => setPayOpen(true)}
          >
            الدفع
          </Button>
          <Button variant="ghost" className="w-full" disabled={lines.length === 0} onClick={() => setLines([])}>
            <Trash2 className="size-4" />
            تفريغ السلة
          </Button>
        </div>

        {lastInvoice ? (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">آخر فاتورة: {lastInvoice.invoiceNumber}</p>
              <Button size="sm" variant="outline" onClick={() => window.print()}>
                <Printer className="size-4" />
                طباعة
              </Button>
            </div>
            <InvoicePrint invoice={lastInvoice} storeName={pos.storeName} />
          </div>
        ) : null}
      </aside>

      <PaymentModal
        open={payOpen}
        total={total}
        methods={pos.paymentMethods}
        hasCustomer={Boolean(customer)}
        busy={busy}
        onClose={() => setPayOpen(false)}
        onConfirm={checkout}
      />
    </div>
  );
}
