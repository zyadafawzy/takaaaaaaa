import { createFileRoute } from "@tanstack/react-router";

import { SettingsPage } from "@/routes/pos.settings";

export const Route = createFileRoute("/s/$storeSlug/admin/pos/settings")({
  component: SettingsPage,
});
