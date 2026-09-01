import { createFileRoute } from "@tanstack/react-router";

import { PurchasesPage } from "@/routes/pos.purchases";

export const Route = createFileRoute("/s/$storeSlug/admin/pos/purchases")({
  component: PurchasesPage,
});
