import { createFileRoute } from "@tanstack/react-router";

import { PosCatalogPage } from "@/routes/pos.catalog";

export const Route = createFileRoute("/s/$storeSlug/admin/pos/catalog")({
  component: PosCatalogPage,
});
