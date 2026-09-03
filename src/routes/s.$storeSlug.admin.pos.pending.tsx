import { createFileRoute } from "@tanstack/react-router";

import { PendingPage } from "@/routes/pos.pending";

export const Route = createFileRoute("/s/$storeSlug/admin/pos/pending")({
  component: PendingPage,
});
