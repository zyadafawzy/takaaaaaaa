import { createFileRoute } from "@tanstack/react-router";

import { SuppliersPage } from "@/routes/pos.suppliers";

export const Route = createFileRoute("/s/$storeSlug/admin/pos/suppliers")({
  component: SuppliersPage,
});
