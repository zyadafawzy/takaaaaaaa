import type { OrderStatus } from "@/domain/types";
import { orderStatusLabels } from "@/lib/orders";

const tones: Record<OrderStatus, string> = {
  new: "bg-accent/10 text-accent",
  awaiting_whatsapp: "bg-demo/20 text-demo-foreground",
  needs_call: "bg-destructive/10 text-destructive",
  preparing: "bg-muted text-foreground",
  out_for_delivery: "bg-primary/10 text-primary",
  delivered: "bg-primary text-primary-foreground",
  cancelled: "bg-muted text-muted-foreground line-through",
};

export function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[status]}`}>
      {orderStatusLabels[status]}
    </span>
  );
}
