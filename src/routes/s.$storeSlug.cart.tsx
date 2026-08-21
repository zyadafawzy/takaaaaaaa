import { createFileRoute } from "@tanstack/react-router";
import { StoreCartView } from "@/components/store/StoreCartView";

export const Route = createFileRoute("/s/$storeSlug/cart")({
  head: () => ({
    meta: [
      { title: "سلة الطلب" },
      { name: "description", content: "راجع منتجاتك والكميات ورسوم التوصيل قبل تأكيد الطلب." },
      { property: "og:title", content: "سلة الطلب" },
      { property: "og:description", content: "ملخص شفاف لطلبك قبل التأكيد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StoreCartPage,
});

function StoreCartPage() {
  const { storeSlug } = Route.useParams();
  return <StoreCartView storeSlug={storeSlug} />;
}
