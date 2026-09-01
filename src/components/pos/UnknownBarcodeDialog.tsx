import { useEffect, useState } from "react";

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
import type { PosUnknownLine } from "@/types/pos";

type Props = {
  open: boolean;
  barcode: string;
  busy?: boolean;
  onClose: () => void;
  /** بيع سريع بسعر يدوي — الصنف بيتسجّل في تقرير المجهولات. */
  onSellManual: (line: PosUnknownLine) => void;
  /** تسجيل الصنف كمنتج حقيقي بالباركود ده. */
  onRegister?: (input: { name: string; sellPrice: number; unitLabel: string; initialQty: number }) => void;
};

export function UnknownBarcodeDialog({ open, barcode, busy, onClose, onSellManual, onRegister }: Props) {
  const [name, setName] = useState("منتج غير مسجل");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [unitLabel, setUnitLabel] = useState("قطعة");
  const [initialQty, setInitialQty] = useState("0");

  useEffect(() => {
    if (!open) return;
    setName("منتج غير مسجل");
    setPrice("");
    setQty("1");
    setUnitLabel("قطعة");
    setInitialQty("0");
  }, [open, barcode]);

  const sellPrice = Number(price) || 0;
  const quantity = Number(qty) || 0;
  const valid = sellPrice > 0 && quantity > 0 && name.trim().length > 1;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>باركود غير معروف</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{barcode}</span> — بيعه فورًا بسعر يدوي أو سجّله منتج جديد.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="unk-name">اسم مؤقت للصنف</Label>
            <Input id="unk-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label htmlFor="unk-price">السعر</Label>
              <Input
                id="unk-price"
                autoFocus
                value={price}
                inputMode="decimal"
                className="h-12 text-lg"
                onChange={(event) => setPrice(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="unk-qty">الكمية</Label>
              <Input id="unk-qty" value={qty} inputMode="decimal" className="h-12" onChange={(event) => setQty(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="unk-unit">الوحدة</Label>
              <Input id="unk-unit" value={unitLabel} className="h-12" onChange={(event) => setUnitLabel(event.target.value)} />
            </div>
          </div>

          {onRegister ? (
            <div className="space-y-1 rounded-lg border border-dashed border-border p-3">
              <Label htmlFor="unk-stock">رصيد ابتدائي عند التسجيل (اختياري)</Label>
              <Input
                id="unk-stock"
                value={initialQty}
                inputMode="decimal"
                onChange={(event) => setInitialQty(event.target.value)}
              />
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
          {onRegister ? (
            <Button
              type="button"
              variant="secondary"
              disabled={!valid || busy}
              onClick={() =>
                onRegister({
                  name: name.trim(),
                  sellPrice,
                  unitLabel: unitLabel.trim() || "قطعة",
                  initialQty: Number(initialQty) || 0,
                })
              }
            >
              سجّله منتج
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={!valid || busy}
            onClick={() =>
              onSellManual({
                barcode,
                name: name.trim(),
                sellPrice,
                qty: quantity,
                unitLabel: unitLabel.trim() || "قطعة",
              })
            }
          >
            بيع بسعر يدوي
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
