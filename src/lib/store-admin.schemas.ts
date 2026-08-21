import { z } from "zod";

export const storeSlugInput = z.object({ storeSlug: z.string().min(1).max(80) });

export const storeOrderStatuses = [
  "new",
  "awaiting_whatsapp",
  "needs_call",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;
