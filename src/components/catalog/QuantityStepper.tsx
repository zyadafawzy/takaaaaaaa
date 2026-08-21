import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";


export function QuantityStepper({
  quantity,
  max,
  onChange,
  label,
}: {
  quantity: number;
  max: number;
  onChange: (next: number) => void;
  label: string;
}) {
  const atMax = quantity >= max;
  return (
    <div className="flex h-11 items-center gap-0.5 rounded-xl border border-white/5 bg-muted/10 p-0.5 shadow-inner backdrop-blur-sm">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 rounded-lg hover:bg-primary/10 hover:text-primary transition-all active:scale-90"
        onClick={() => onChange(quantity + 1)}
        disabled={atMax}
        aria-label={`زيادة كمية ${label}`}
      >

        <Plus className={cn("size-4.5", atMax ? "opacity-30" : "text-primary")} strokeWidth={3} />
      </Button>
      <span className="min-w-8 text-center text-base font-black tabular-nums text-foreground/90" aria-live="polite">
        {quantity}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
        onClick={() => onChange(quantity - 1)}
        aria-label={quantity <= 1 ? `حذف ${label}` : `تقليل كمية ${label}`}
      >
        {quantity <= 1 ? (
          <Trash2 className="size-4.5 text-destructive" strokeWidth={2.5} />
        ) : (
          <Minus className="size-4.5 text-primary" strokeWidth={3} />
        )}
      </Button>
    </div>


  );
}
