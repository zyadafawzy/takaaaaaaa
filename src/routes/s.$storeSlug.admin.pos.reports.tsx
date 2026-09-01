import { createFileRoute } from "@tanstack/react-router";

import { ReportsPage } from "@/routes/pos.reports";

export const Route = createFileRoute("/s/$storeSlug/admin/pos/reports")({
  component: ReportsPage,
});
