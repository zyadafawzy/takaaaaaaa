import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { StoreCheckoutView } from "@/components/store/StoreCheckoutView";

export const Route = createFileRoute("/s/$storeSlug/checkout")({
  head: () => ({
    meta: [
      { title: "إنهاء الطلب" },
      { name: "description", content: "بياناتك، عنوانك، وطريقة الاستلام في خطوات قصيرة." },
      { property: "og:title", content: "إنهاء الطلب" },
      { property: "og:description", content: "خطوات قصيرة وواضحة قبل تأكيد طلبك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StoreCheckoutPage,
});

function StoreCheckoutPage() {
  const { storeSlug } = Route.useParams();
  const { store } = useLoaderData({ from: "/s/$storeSlug" });
  if (!store) return null;

  return (
    <StoreCheckoutView
      storeSlug={storeSlug}
      settings={{
        storeName: store.name,
        pickupEnabled: store.settings.pickupEnabled,
        acceptingOrders: store.settings.acceptingOrders,
        closedMessage: store.settings.closedMessage,
      }}
    />
  );
}
