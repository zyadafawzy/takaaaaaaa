import { createFileRoute } from "@tanstack/react-router";

import { InvoicesPage } from "@/routes/pos.invoices";

export const Route = createFileRoute("/s/$storeSlug/admin/pos/invoices")({
  component: InvoicesPage,
});
