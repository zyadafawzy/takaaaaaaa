import { createFileRoute } from "@tanstack/react-router";

import { CashierPage } from "@/routes/pos.index";

export const Route = createFileRoute("/s/$storeSlug/admin/pos/")({
  component: CashierPage,
});
