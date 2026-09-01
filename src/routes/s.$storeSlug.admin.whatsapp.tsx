import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { whatsappSegmentPreview, whatsappCampaignPrepare, whatsappCampaigns } from "@/lib/crm.functions";

export const Route = createFileRoute("/s/$storeSlug/admin/whatsapp")({
  head: () => ({
    meta: [
      { title: "شرائح وحملات واتساب — تِكّة" },
      { name: "description", content: "تجهيز رسائل واتساب للعملاء الموافقين فقط مع تصدير آمن." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "شرائح وحملات واتساب" },
      { property: "og:description", content: "شرائح عملاء وحملات واتساب بموافقة صريحة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WhatsappPage,
});

const SEGMENTS = [
  { key: "marketing_opt_in", label: "عملاء وافقوا على العروض" },
  { key: "purchased_today", label: "عملاء اشتروا اليوم" },
  { key: "repeat", label: "عملاء متكررون" },
  { key: "has_balance", label: "عملاء عليهم رصيد" },
] as const;

type SegmentKey = (typeof SEGMENTS)[number]["key"];

function WhatsappPage() {
  const { storeSlug } = Route.useParams();
  const qc = useQueryClient();
  const [segment, setSegment] = useState<SegmentKey>("marketing_opt_in");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("أهلاً {{name}}، عندنا عروض جديدة النهاردة في المتجر 🌟");
  const [prepared, setPrepared] = useState<
    { link: string; phone: string; text: string }[] | null
  >(null);

  const preview = useQuery({
    queryKey: ["wa-segment", storeSlug, segment],
    queryFn: () => whatsappSegmentPreview({ data: { storeSlug, segment } }),
    retry: false,
  });

  const campaigns = useQuery({
    queryKey: ["wa-campaigns", storeSlug],
    queryFn: () => whatsappCampaigns({ data: { storeSlug } }),
    retry: false,
  });

  const prepare = useMutation({
    mutationFn: () => whatsappCampaignPrepare({ data: { storeSlug, name, segment, message } }),
    onSuccess: (res) => {
      setPrepared(res.recipients);
      toast.success(`تم التجهيز: ${res.recipients.length} مستلم — الحالة "جاهزة" مش "مُرسلة"`);
      void qc.invalidateQueries({ queryKey: ["wa-campaigns"] });
    },
    onError: () => toast.error("التجهيز متاح لصاحب المتجر/المدير فقط"),
  });

  const exportCsv = () => {
    if (!prepared) return;
    const lines = [
      "phone,message",
      ...prepared.map((r) => `"${r.phone}","${r.text.replace(/"/g, '""')}"`),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `whatsapp-${segment}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-extrabold">شرائح وحملات واتساب</h2>
      <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
        مفيش WhatsApp Business API متوصل حاليًا، فالحملة بتتجهّز فقط (prepared) — مفيش أي ادعاء بالإرسال. الرسائل
        بتتبعت يدويًا من روابط فردية أو تصدير CSV، وللعملاء اللي وافقوا صراحةً بس.
      </p>

      <div className="flex flex-wrap gap-2">
        {SEGMENTS.map((s) => (
          <Button key={s.key} size="sm" variant={segment === s.key ? "default" : "outline"} onClick={() => setSegment(s.key)}>
            {s.label}
          </Button>
        ))}
      </div>

      {preview.isLoading ? <Skeleton className="h-32 w-full rounded-2xl" /> : null}
      {preview.data ? (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-bold">عدد العملاء في الشريحة: {preview.data.count}</p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
            {preview.data.recipients.map((r) => (
              <li key={r.id}>
                {r.name} — {r.phone} {r.optIn ? "" : "(غير موافق على العروض)"}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
        <div>
          <Label className="text-xs">اسم الحملة</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">نص الرسالة — {"{{name}}"} بيتبدل باسم العميل</Label>
          <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={name.trim().length < 2 || prepare.isPending} onClick={() => prepare.mutate()}>
            تجهيز الحملة
          </Button>
          <Button variant="outline" disabled={!prepared} onClick={exportCsv}>
            تصدير المستلمين CSV
          </Button>
        </div>
      </section>

      {prepared ? (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="font-extrabold">روابط فردية ({prepared.length})</h3>
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-xs">
            {prepared.map((r) => (
              <li key={r.phone}>
                <a className="text-primary underline" href={r.link} target="_blank" rel="noreferrer">
                  {r.phone}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {campaigns.data && campaigns.data.length > 0 ? (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="font-extrabold">الحملات السابقة</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {campaigns.data.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 border-t border-border py-1">
                <span className="font-bold">{c.name}</span>
                <span className="text-muted-foreground">
                  {c.status} — {c.recipients} مستلم
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
