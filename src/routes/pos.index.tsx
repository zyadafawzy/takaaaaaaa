import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PauseCircle, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { BarcodeScanner } from "@/components/pos/BarcodeScanner";
import { CartPanel } from "@/components/pos/CartPanel";
import { CustomerSelector } from "@/components/pos/CustomerSelector";
import { HoldInvoiceDrawer } from "@/components/pos/HoldInvoiceDrawer";
import { InvoicePrint } from "@/components/pos/InvoicePrint";
import { PaymentModal, type PaymentSplit } from "@/components/pos/PaymentModal";
import { UnknownBarcodeDialog } from "@/components/pos/UnknownBarcodeDialog";
import { usePos } from "@/components/pos/PosShell";
import { useOffline } from "@/lib/offline/offline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/format";
import { isAutoPrintEnabled, printReceipt, setAutoPrintEnabled } from "@/lib/pos-print";
import {
  posHoldCart,
  posListHeldInvoices,
  posResumeHeldInvoice,
} from "@/lib/pos-ops.functions";
import {
  posAttachBarcode,
  posCheckout,
  posCreateCustomer,
  posGetInvoice,
  posListCustomers,
  posLogPrint,
  posScanBarcode,
  posSearchVariants,
} from "@/lib/pos.functions";
import {
  lineTotal,
  unknownLineTotal,
  type PosCartLine,
  type PosCustomer,
  type PosHeldInvoice,
  type PosInvoiceFull,
  type PosUnknownLine,
} from "@/types/pos";

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

export function CashierPage() {
  const pos = usePos();
  const offline = useOffline();
  const [lines, setLines] = useState<PosCartLine[]>([]);
  const [unknownLines, setUnknownLines] = useState<PosUnknownLine[]>([]);
  const [results, setResults] = useState<Omit<PosCartLine, "qty" | "discountPct" | "barcode">[]>([]);
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [customers, setCustomers] = useState<PosCustomer[]>([]);
  const [invoiceDiscount, setInvoiceDiscount] = useState("0");
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<PosInvoiceFull | null>(null);
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [holdOpen, setHoldOpen] = useState(false);
  const [held, setHeld] = useState<PosHeldInvoice[]>([]);
  const [autoPrint, setAutoPrint] = useState(true);

  useEffect(() => {
    setAutoPrint(isAutoPrintEnabled());
  }, []);

  const subtotal =
    lines.reduce((sum, line) => sum + lineTotal(line), 0) +
    unknownLines.reduce((sum, line) => sum + unknownLineTotal(line), 0);
  const discount = Math.min(Number(invoiceDiscount) || 0, subtotal);
  const total = Math.round((subtotal - discount) * 100) / 100;
  const isEmpty = lines.length === 0 && unknownLines.length === 0;

  const clearCart = useCallback(() => {
    setLines([]);
    setUnknownLines([]);
    setCustomer(null);
    setInvoiceDiscount("0");
  }, []);

  /** زيادة مبلغ سريعة على الفاتورة (سطر بسعر يدوي وكمية ١). */
  const addExtraAmount = (amount: number, label: string) => {
    setUnknownLines((current) => [
      ...current,
      { barcode: EXTRA_BARCODE, name: label, sellPrice: Math.round(amount * 100) / 100, qty: 1, unitLabel: "مبلغ" },
    ]);
  };

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

  const localScan = (barcode: string) => {
    const variant = offline?.snapshot?.variants.find((item) => item.barcodes.includes(barcode));
    if (!variant) return null;
    return {
      variantId: variant.variantId,
      productId: variant.productId,
      productName: variant.productName,
      unitLabel: variant.unitLabel,
      sellPrice: variant.sellPrice,
      costPrice: variant.costPrice,
      stock: variant.stock,
    };
  };

  const handleScan = async (barcode: string) => {
    setBusy(true);
    if (offline && !offline.isOnline) {
      const local = localScan(barcode);
      if (local) addLine({ ...local, barcode });
      else {
        setPendingBarcode(barcode);
        setUnknownBarcode(barcode);
      }
      setBusy(false);
      return;
    }
    try {
      const hit = await posScanBarcode({ data: { storeId: pos.storeId, branchId: pos.branchId, barcode } });
      if (!hit.found) {
        setPendingBarcode(hit.barcode);
        setUnknownBarcode(hit.barcode);
      } else {
        addLine(hit);
      }
    } catch {
      const local = localScan(barcode);
      if (local) {
        addLine({ ...local, barcode });
        toast.info("اتقرأ من النسخة المحلية (النت مقطوع).");
      } else {
        toast.error("مقدرناش نقرأ الباركود.");
      }
    }
    setBusy(false);
  };

  const localSearch = (query: string) => {
    const needle = query.trim();
    return (offline?.snapshot?.variants ?? [])
      .filter((item) => item.productName.includes(needle))
      .slice(0, 20)
      .map((item) => ({
        variantId: item.variantId,
        productId: item.productId,
        productName: item.productName,
        unitLabel: item.unitLabel,
        sellPrice: item.sellPrice,
        costPrice: item.costPrice,
        stock: item.stock,
      }));
  };

  const handleSearch = async (query: string) => {
    setBusy(true);
    if (offline && !offline.isOnline) {
      const found = localSearch(query);
      setResults(found);
      if (found.length === 0) toast.info("مفيش نتائج في النسخة المحلية.");
      setBusy(false);
      return;
    }
    try {
      const found = await posSearchVariants({ data: { storeId: pos.storeId, branchId: pos.branchId, query } });
      setResults(found);
      if (found.length === 0) toast.info("مفيش نتائج بالاسم ده.");
    } catch {
      const found = localSearch(query);
      setResults(found);
      if (found.length === 0) toast.error("البحث فشل.");
    }
    setBusy(false);
  };

  const refreshHeld = useCallback(async () => {
    try {
      setHeld(await posListHeldInvoices({ data: { storeId: pos.storeId } }));
    } catch {
      setHeld([]);
    }
  }, [pos.storeId]);

  useEffect(() => {
    void refreshHeld();
  }, [refreshHeld]);

  const holdCart = useCallback(async () => {
    if (isEmpty || !pos.shift) return;
    setBusy(true);
    try {
      const result = await posHoldCart({
        data: {
          storeId: pos.storeId,
          branchId: pos.branchId,
          shiftId: pos.shift.id,
          customerId: customer?.id ?? null,
          discountAmount: discount,
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
          unknownLines,
        },
      });
      clearCart();
      await refreshHeld();
      toast.success(`السلة اتعلّقت — ${result.invoiceNumber}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "التعليق فشل.");
    }
    setBusy(false);
  }, [clearCart, customer?.id, discount, isEmpty, lines, pos.branchId, pos.shift, pos.storeId, refreshHeld, unknownLines]);

  const resumeInvoice = async (invoiceId: string) => {
    setBusy(true);
    try {
      const resumed = await posResumeHeldInvoice({ data: { invoiceId } });
      setLines(resumed.lines);
      setUnknownLines(resumed.unknownLines);
      setInvoiceDiscount(String(resumed.discountAmount ?? 0));
      setHoldOpen(false);
      await refreshHeld();
      toast.success("السلة رجعت.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "الاسترجاع فشل.");
    }
    setBusy(false);
  };

  const buildLocalInvoice = (payments: PaymentSplit[], localNumber: string): PosInvoiceFull => {
    const paid = payments.reduce((sum, p) => sum + p.amount, 0);
    return {
      id: localNumber,
      invoiceNumber: localNumber,
      total,
      paidAmount: paid,
      status: "confirmed",
      createdAt: new Date().toISOString(),
      customerName: customer?.name ?? null,
      itemsCount: lines.length + unknownLines.length,
      storeId: pos.storeId,
      branchName: pos.branches.find((b) => b.id === pos.branchId)?.name ?? null,
      subtotal,
      discountAmount: discount,
      taxAmount: 0,
      changeAmount: Math.max(0, Math.round((paid - total) * 100) / 100),
      voidReason: null,
      items: [
        ...lines.map((line, index) => ({
          id: `l${index}`,
          productName: line.productName,
          unitLabel: line.unitLabel,
          sellPrice: line.sellPrice,
          qty: line.qty,
          discountPct: line.discountPct,
          lineTotal: lineTotal(line),
        })),
        ...unknownLines.map((line, index) => ({
          id: `u${index}`,
          productName: line.name,
          unitLabel: line.unitLabel,
          sellPrice: line.sellPrice,
          qty: line.qty,
          discountPct: 0,
          lineTotal: unknownLineTotal(line),
        })),
      ],
      payments: payments.map((p, index) => ({
        id: `p${index}`,
        methodName: pos.paymentMethods.find((m) => m.id === p.methodId)?.name ?? "دفع",
        amount: p.amount,
      })),
    };
  };

  const checkout = async (payments: PaymentSplit[]) => {
    const localShift = offline?.localShift ?? null;
    if (!pos.shift && !localShift) {
      toast.error("افتح وردية الأول.");
      return;
    }
    setBusy(true);

    const clientInvoiceId = `${pos.storeId.slice(0, 8)}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const basePayload = {
      storeId: pos.storeId,
      branchId: pos.branchId,
      shiftId: pos.shift?.id ?? null,
      clientInvoiceId,
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
      unknownLines,
      payments: payments.map((p) => ({ methodId: p.methodId, amount: p.amount })),
    };

    const offlinePayload = {
      ...basePayload,
      isOffline: true,
      ...(localShift
        ? {
            offlineShift: {
              clientShiftId: localShift.clientShiftId,
              openedAt: localShift.openedAt,
              openingAmount: localShift.openingAmount,
            },
          }
        : {}),
    };

    const queueOffline = async (reason: string) => {
      if (!offline) {
        toast.error(reason);
        return;
      }
      const localNumber = `OFF-${Date.now().toString(36).toUpperCase()}`;
      await offline.queueInvoice({
        storeId: pos.storeId,
        localNumber,
        clientInvoiceId,
        total,
        payload: offlinePayload as unknown as Record<string, unknown>,
      });
      const localInvoice = buildLocalInvoice(payments, localNumber);
      setLastInvoice(localInvoice);
      clearCart();
      setPayOpen(false);
      toast.success(`تم البيع أوفلاين — ${localNumber} · هترفع تلقائي أول ما النت يرجع`);
      if (isAutoPrintEnabled()) window.setTimeout(() => void printInvoice(null), 250);
    };

    if ((offline && !offline.isOnline) || (!pos.shift && localShift)) {
      await queueOffline("مفيش اتصال.");
      setBusy(false);
      return;
    }

    try {
      const result = await posCheckout({ data: basePayload as never });
      const full = await posGetInvoice({ data: { invoiceId: result.invoiceId } });
      setLastInvoice(full);
      clearCart();
      setPayOpen(false);
      toast.success(`تم البيع — ${result.invoiceNumber} · الباقي ${formatPrice(result.change)}`);
      if (result.priceConflicts.length > 0) {
        toast.warning(`في ${result.priceConflicts.length} صنف سعره اتغيّر على السيرفر — راجع الأسعار.`);
      }
      if (isAutoPrintEnabled()) {
        window.setTimeout(() => void printInvoice(result.invoiceId), 250);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "الفاتورة فشلت.";
      const networkIssue = !window.navigator.onLine || /fetch|network|Failed/i.test(message);
      if (networkIssue && offline) await queueOffline(message);
      else toast.error(message);
    }
    setBusy(false);
  };


  const printInvoice = async (invoiceId: string | null) => {
    const ok = printReceipt();
    if (!ok) window.print();
    try {
      await posLogPrint({ data: { storeId: pos.storeId, invoiceId, documentType: "invoice_80mm" } });
    } catch {
      /* الطباعة نفسها نجحت — السجل مش حاجز. */
    }
  };


  // اختصارات الكاشير: F2 دفع · F4 تعليق · F6 استرجاع · F8 تفريغ
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "F2" && !isEmpty && (pos.shift || offline?.localShift)) {
        event.preventDefault();
        setPayOpen(true);
      } else if (event.key === "F4" && !isEmpty) {
        event.preventDefault();
        void holdCart();
      } else if (event.key === "F6") {
        event.preventDefault();
        setHoldOpen(true);
      } else if (event.key === "F8" && !isEmpty) {
        event.preventDefault();
        clearCart();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearCart, holdCart, isEmpty, offline?.localShift, pos.shift]);

  // استبدال الرقم المحلي بالرقم الرسمي بعد ما الفاتورة ترتفع.
  useEffect(() => {
    if (!lastInvoice || !offline) return;
    if (!lastInvoice.invoiceNumber.startsWith("OFF-")) return;
    const synced = offline.syncedInvoices.find((item) => item.localNumber === lastInvoice.invoiceNumber);
    if (synced?.officialNumber) {
      setLastInvoice((current) =>
        current ? { ...current, invoiceNumber: synced.officialNumber!, id: synced.officialInvoiceId ?? current.id } : current,
      );
      toast.info(`الفاتورة ${synced.localNumber} اترفعت برقم رسمي ${synced.officialNumber}.`);
    }
  }, [lastInvoice, offline]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-extrabold">الكاشير</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={isEmpty || busy} onClick={() => void holdCart()}>
              <PauseCircle className="size-4" />
              تعليق (F4)
            </Button>
            <Button variant="outline" size="sm" onClick={() => setHoldOpen(true)}>
              معلّقة ({held.length})
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setUnknownBarcode(MANUAL_BARCODE)}>
              صنف يدوي
            </Button>
          </div>
        </div>

        {/* زيادة مبلغ على الفاتورة (خدمة، كيس، فرق سعر…) */}
        <form
          className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            const value = Number(extraAmount);
            if (!Number.isFinite(value) || value <= 0) {
              toast.error("اكتب مبلغ صحيح.");
              return;
            }
            addExtraAmount(value, extraLabel.trim() || "زيادة على الفاتورة");
            setExtraAmount("");
            setExtraLabel("");
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="extra-amount">زيادة مبلغ (جنيه)</Label>
            <Input
              id="extra-amount"
              value={extraAmount}
              inputMode="decimal"
              placeholder="5"
              className="h-11 w-28 text-center"
              onChange={(event) => setExtraAmount(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="extra-label">السبب</Label>
            <Input
              id="extra-label"
              value={extraLabel}
              placeholder="كيس / خدمة / فرق سعر"
              className="h-11 w-52"
              onChange={(event) => setExtraLabel(event.target.value)}
            />
          </div>
          <Button type="submit" size="sm" variant="outline">
            <Plus className="size-4" />
            زوّد
          </Button>
        </form>

        <BarcodeScanner onScan={handleScan} onSearch={handleSearch} busy={busy} disabled={!pos.shift && !offline?.localShift} />

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
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {results.map((item) => {
              const image = (item as { imageUrl?: string | null }).imageUrl ?? null;
              return (
              <li key={item.variantId}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 p-3 text-start transition-colors hover:bg-muted active:bg-muted/70"
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
                  <span className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {image ? (
                      <img
                        src={`${image}?w=120`}
                        alt=""
                        width={48}
                        height={48}
                        loading="lazy"
                        decoding="async"
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center text-[9px] text-muted-foreground">
                        بدون صورة
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{item.productName}</span>
                    <span className="block text-[11px] text-muted-foreground">{item.unitLabel}</span>
                  </span>
                  <span className="shrink-0 text-end">
                    <span className="block font-black text-primary">{formatPrice(item.sellPrice)}</span>
                    <span
                      className={`block text-[11px] font-bold ${item.stock > 0 ? "text-success" : "text-destructive"}`}
                    >
                      متاح {item.stock}
                    </span>
                  </span>
                </button>
              </li>
              );
            })}
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

        {unknownLines.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-dashed border-border">
            {unknownLines.map((line, index) => (
              <li key={`${line.barcode}-${index}`} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-semibold">{line.name} · صنف غير مسجل</p>
                  <p className="text-xs text-muted-foreground font-mono">{line.barcode}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm tabular-nums">
                    {line.qty} {line.unitLabel} · {formatPrice(unknownLineTotal(line))}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="حذف الصنف غير المسجل"
                    onClick={() => setUnknownLines((current) => current.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
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
            disabled={isEmpty || busy || !pos.shift}
            onClick={() => setPayOpen(true)}
          >
            الدفع (F2)
          </Button>
          <Button variant="ghost" className="w-full" disabled={isEmpty} onClick={clearCart}>
            <Trash2 className="size-4" />
            تفريغ السلة (F8)
          </Button>
        </div>

        <label className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
          <span className="font-semibold">طباعة الفاتورة تلقائيًا بعد الدفع</span>
          <input
            type="checkbox"
            className="size-4 accent-primary"
            defaultChecked={autoPrint}
            onChange={(event) => {
              setAutoPrintEnabled(event.target.checked);
              setAutoPrint(event.target.checked);
            }}
          />
        </label>

        {lastInvoice ? (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">آخر فاتورة: {lastInvoice.invoiceNumber}</p>
              <Button size="sm" variant="outline" onClick={() => void printInvoice(lastInvoice.id)}>
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

      <UnknownBarcodeDialog
        open={Boolean(unknownBarcode)}
        barcode={unknownBarcode ?? ""}
        busy={busy}
        onClose={() => setUnknownBarcode(null)}
        onSellManual={(line) => {
          setUnknownLines((current) => [...current, line]);
          setUnknownBarcode(null);
          setPendingBarcode(null);
          toast.success("الصنف اتضاف بسعر يدوي وهيتسجّل في تقرير المجهولات.");
        }}
      />

      <HoldInvoiceDrawer
        open={holdOpen}
        invoices={held}
        busy={busy}
        onClose={() => setHoldOpen(false)}
        onResume={(invoiceId) => void resumeInvoice(invoiceId)}
      />
    </div>
  );
}
