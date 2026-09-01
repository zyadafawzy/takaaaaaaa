import { createFileRoute } from "@tanstack/react-router";

import { UnknownScansPage } from "@/routes/pos.unknown";

export const Route = createFileRoute("/s/$storeSlug/admin/pos/unknown")({
  component: UnknownScansPage,
});
