import { createFileRoute } from "@tanstack/react-router";

import { DamagedPage } from "@/routes/pos.damaged";

export const Route = createFileRoute("/s/$storeSlug/admin/pos/damaged")({
  component: DamagedPage,
});
