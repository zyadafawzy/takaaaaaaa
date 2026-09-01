import { formatPrice } from "@/lib/format";
import type { PosInvoiceFull } from "@/types/pos";

type Props = {
  invoice: PosInvoiceFull;
  storeName: string;
  storePhone?: string;
};

/**
 * قالب طباعة الفاتورة — الأساس 80mm thermal، ويطبع على A4/A5 كذلك.
 * الأنماط داخل @media print عشان الشاشة تفضل نظيفة.
 */
export function InvoicePrint({ invoice, storeName, storePhone }: Props) {
  const cairo = new Intl.DateTimeFormat("ar-EG", {
    timeZone: "Africa/Cairo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(invoice.createdAt));

  return (
    <div id="pos-print-root" className="pos-print mx-auto w-full max-w-[80mm] bg-card p-3 text-card-foreground">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #pos-print-root, #pos-print-root * { visibility: visible !important; }
          #pos-print-root {
            position: absolute; inset-inline-start: 0; top: 0;
            width: 80mm; max-width: 80mm; padding: 4mm;
            color: #000; background: #fff;
          }
          @page { size: 80mm auto; margin: 0; }
        }
      `}</style>

      <header className="text-center">
        <p className="text-lg font-extrabold">{storeName}</p>
        {storePhone ? <p className="text-xs">{storePhone}</p> : null}
        <p className="mt-1 text-xs">فاتورة رقم: {invoice.invoiceNumber}</p>
        <p className="text-xs">{cairo}</p>
        {invoice.branchName ? <p className="text-xs">فرع: {invoice.branchName}</p> : null}
        {invoice.customerName ? <p className="text-xs">العميل: {invoice.customerName}</p> : null}
      </header>

      <hr className="my-2 border-dashed" />

      <table className="w-full text-xs">
        <thead>
          <tr className="text-start">
            <th className="text-start">الصنف</th>
            <th className="text-center">كمية</th>
            <th className="text-end">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item) => (
            <tr key={item.id}>
              <td className="py-0.5">{item.productName}</td>
              <td className="py-0.5 text-center tabular-nums">
                {item.qty} {item.unitLabel}
              </td>
              <td className="py-0.5 text-end tabular-nums">{item.lineTotal.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr className="my-2 border-dashed" />

      <dl className="space-y-1 text-xs">
        <Row label="المجموع" value={formatPrice(invoice.subtotal)} />
        {invoice.discountAmount > 0 ? <Row label="خصم" value={`- ${formatPrice(invoice.discountAmount)}`} /> : null}
        {invoice.taxAmount > 0 ? <Row label="ضريبة" value={formatPrice(invoice.taxAmount)} /> : null}
        <Row label="الإجمالي" value={formatPrice(invoice.total)} strong />
        <Row label="المدفوع" value={formatPrice(invoice.paidAmount)} />
        {invoice.changeAmount > 0 ? <Row label="الباقي" value={formatPrice(invoice.changeAmount)} /> : null}
        {invoice.total - invoice.paidAmount > 0 ? (
          <Row label="آجل على العميل" value={formatPrice(invoice.total - invoice.paidAmount)} />
        ) : null}
      </dl>

      {invoice.payments.length > 0 ? (
        <p className="mt-2 text-center text-xs">
          طريقة الدفع: {invoice.payments.map((p) => p.methodName).join(" + ")}
        </p>
      ) : null}

      <p className="mt-3 text-center text-xs font-semibold">شكرًا لزيارتك — تِكّة</p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? "text-sm font-extrabold" : ""}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
