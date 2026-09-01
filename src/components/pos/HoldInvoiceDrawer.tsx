import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPrice } from "@/lib/format";
import type { PosHeldInvoice } from "@/types/pos";

type Props = {
  open: boolean;
  invoices: PosHeldInvoice[];
  busy?: boolean;
  onClose: () => void;
  onResume: (invoiceId: string) => void;
};

export function HoldInvoiceDrawer({ open, invoices, busy, onClose, onResume }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>الفواتير المعلّقة</DialogTitle>
          <DialogDescription>استرجع سلة معلّقة لتكمل البيع.</DialogDescription>
        </DialogHeader>

        {invoices.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">مفيش فواتير معلّقة.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-semibold">{invoice.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {invoice.itemsCount} صنف ·{" "}
                    {new Intl.DateTimeFormat("ar-EG", { timeZone: "Africa/Cairo", timeStyle: "short" }).format(
                      new Date(invoice.createdAt),
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold tabular-nums">{formatPrice(invoice.total)}</span>
                  <Button size="sm" disabled={busy} onClick={() => onResume(invoice.id)}>
                    استرجاع
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
