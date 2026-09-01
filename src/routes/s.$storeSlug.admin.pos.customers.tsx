import { createFileRoute } from "@tanstack/react-router";

import { CustomersPage } from "@/routes/pos.customers";

export const Route = createFileRoute("/s/$storeSlug/admin/pos/customers")({
  component: CustomersPage,
});
