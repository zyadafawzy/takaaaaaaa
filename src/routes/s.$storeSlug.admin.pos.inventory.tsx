import { createFileRoute } from "@tanstack/react-router";

import { InventoryPage } from "@/routes/pos.inventory";

export const Route = createFileRoute("/s/$storeSlug/admin/pos/inventory")({
  component: InventoryPage,
});
