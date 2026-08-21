import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Clock, MapPin } from "lucide-react";
import { StaticPage } from "@/components/layout/StaticPage";
import { catalogRepository } from "@/services/catalog-repository";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "تواصل معنا — تِكّة" },
      { name: "description", content: "واتساب خدمة العملاء، أوقات العمل، وعنوان الفرع." },
      { property: "og:title", content: "تواصل مع تِكّة" },
      { property: "og:description", content: "واتساب خدمة العملاء وأوقات العمل." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: () => catalogRepository.getSettings() });

  return (
    <StaticPage title="تواصل معنا" intro="لو محتاج مساعدة في طلب أو استفسار، إحنا موجودين.">
      {isLoading || !data ? (
        <Skeleton className="h-32 w-full rounded-lg" />
      ) : (
        <div className="space-y-3">
          <p className="flex items-center gap-2">
            <Clock className="size-4 text-primary" aria-hidden /> {data.openingHours}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="size-4 text-primary" aria-hidden /> {data.branchAddress}
          </p>
          <Button asChild className="gap-2">
            <a
              href={`https://wa.me/${data.whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="size-4" /> كلمنا على واتساب
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">
            فتح واتساب بيجهّز الرسالة بس؛ الإرسال بيتم منك.
          </p>
        </div>
      )}
    </StaticPage>
  );
}
