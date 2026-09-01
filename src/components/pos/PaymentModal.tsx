import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/format";
import type { PosPaymentMethod } from "@/types/pos";

export type PaymentSplit = { methodId: string; amount: number };

type Props = {
  open: boolean;
  total: number;
  methods: PosPaymentMethod[];
  hasCustomer: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (payments: PaymentSplit[]) => void;
};

export function PaymentModal({ open, total, methods, hasCustomer, busy, onClose, onConfirm }: Props) {
  const cashMethod = useMemo(() => methods.find((m) => m.type === "cash") ?? methods[0], [methods]);
  const [methodId, setMethodId] = useState<string>(cashMethod?.id ?? "");
  const [amount, setAmount] = useState<string>(total.toFixed(2));

  useEffect(() => {
    if (!open) return;
    setMethodId(cashMethod?.id ?? "");
    setAmount(total.toFixed(2));
  }, [open, total, cashMethod?.id]);

  const paid = Number(amount) || 0;
  const method = methods.find((m) => m.id === methodId);
  const isCredit = method?.type === "credit";
  const remaining = Math.round((total - paid) * 100) / 100;
  const change = Math.round((paid - total) * 100) / 100;
  const canConfirm =
    methods.length > 0 && (isCredit ? hasCustomer : paid >= total || (remaining > 0 && hasCustomer));

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>تحصيل {formatPrice(total)}</DialogTitle>
          <DialogDescription>اختار طريقة الدفع واكتب المبلغ المستلم.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {methods.map((m) => (
              <Button
                key={m.id}
                type="button"
                variant={m.id === methodId ? "default" : "outline"}
                onClick={() => {
                  setMethodId(m.id);
                  if (m.type === "credit") setAmount("0");
                }}
              >
                {m.name}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pos-paid">المبلغ المستلم</Label>
            <Input
              id="pos-paid"
              value={amount}
              inputMode="decimal"
              className="h-12 text-lg"
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm">
            {change >= 0 ? (
              <p className="font-semibold">الباقي للعميل: {formatPrice(change)}</p>
            ) : (
              <p className="font-semibold text-destructive">
                متبقّي على العميل: {formatPrice(Math.abs(change))} — لازم عميل مسجّل للبيع الآجل.
              </p>
            )}
          </div>

          {isCredit && !hasCustomer ? (
            <p className="text-sm text-destructive">البيع الآجل محتاج تختار عميل الأول.</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            رجوع
          </Button>
          <Button
            type="button"
            disabled={!canConfirm || busy}
            onClick={() => onConfirm(paid > 0 && methodId ? [{ methodId, amount: paid }] : [])}
          >
            {busy ? "بنأكد…" : "أكّد البيع"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
