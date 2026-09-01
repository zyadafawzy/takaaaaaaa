import { Minus, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/format";
import { lineTotal, type PosCartLine } from "@/types/pos";

type Props = {
  lines: PosCartLine[];
  onQty: (variantId: string, qty: number) => void;
  onDiscount: (variantId: string, discountPct: number) => void;
  onRemove: (variantId: string) => void;
};

export function CartPanel({ lines, onQty, onDiscount, onRemove }: Props) {
  if (lines.length === 0) {
    return (
      <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
        <p className="font-semibold">السلة فاضية</p>
        <p className="text-sm text-muted-foreground">امسح باركود أول صنف للبدء.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {lines.map((line) => (
        <li key={line.variantId} className="flex flex-wrap items-center gap-3 p-3">
          <div className="min-w-40 flex-1">
            <p className="font-semibold leading-tight">{line.productName}</p>
            <p className="text-xs text-muted-foreground">
              {formatPrice(line.sellPrice)} / {line.unitLabel}
              {line.stock <= 0 ? " · مخزون صفر" : ` · متاح ${line.stock}`}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="تقليل"
              onClick={() => onQty(line.variantId, Math.max(0.001, line.qty - 1))}
            >
              <Minus className="size-4" />
            </Button>
            <Input
              value={String(line.qty)}
              inputMode="decimal"
              aria-label="الكمية"
              className="h-9 w-20 text-center"
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next) && next > 0) onQty(line.variantId, next);
              }}
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="زيادة"
              onClick={() => onQty(line.variantId, line.qty + 1)}
            >
              <Plus className="size-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Input
              value={String(line.discountPct)}
              inputMode="decimal"
              aria-label="خصم %"
              className="h-9 w-16 text-center"
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next) && next >= 0 && next <= 100) onDiscount(line.variantId, next);
              }}
            />
            <span className="text-xs text-muted-foreground">% خصم</span>
          </div>

          <p className="w-28 text-end font-bold tabular-nums">{formatPrice(lineTotal(line))}</p>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="حذف الصنف"
            onClick={() => onRemove(line.variantId)}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
