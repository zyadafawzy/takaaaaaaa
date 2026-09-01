import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  crmCustomers,
  crmCreateCustomer,
  crmCustomerStatement,
  crmRecordPayment,
  crmSetConsent,
  loyaltySettingsGet,
  loyaltySettingsSave,
} from "@/lib/crm.functions";

export const Route = createFileRoute("/s/$storeSlug/admin/customers")({
  head: () => ({
    meta: [
      { title: "العملاء والنوتة الرقمية — تِكّة" },
      { name: "description", content: "كشف حساب العملاء، التحصيلات، نقاط الولاء، وموافقات واتساب." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "العملاء والنوتة الرقمية" },
      { property: "og:description", content: "أرصدة العملاء وكشوف الحساب ونقاط الولاء." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomersCrmPage,
});

const money = (v: number) => `${v.toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ج.م`;
const fmt = (iso: string) =>
  new Intl.DateTimeFormat("ar-EG", { timeZone: "Africa/Cairo", dateStyle: "short", timeStyle: "short" }).format(
    new Date(iso),
  );

function CustomersCrmPage() {
  const { storeSlug } = Route.useParams();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [optIn, setOptIn] = useState(false);

  const list = useQuery({
    queryKey: ["crm-customers", storeSlug, search],
    queryFn: () => crmCustomers({ data: { storeSlug, search } }),
    retry: false,
  });

  const create = useMutation({
    mutationFn: () => crmCreateCustomer({ data: { storeSlug, phone, name, address: "", notes: "", marketingOptIn: optIn } }),
    onSuccess: (res) => {
      if (res.duplicate) {
        toast.error("الرقم موجود قبل كده — افتح العميل الموجود");
        setOpenId(res.customerId);
        return;
      }
      toast.success("تم إنشاء العميل");
      setPhone("");
      setName("");
      setOptIn(false);
      void qc.invalidateQueries({ queryKey: ["crm-customers"] });
    },
    onError: (e: Error) =>
      toast.error(e.message.includes("INVALID_PHONE") ? "رقم الهاتف غير صحيح — اكتب رقم مصري صالح" : e.message),
  });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-extrabold">العملاء والنوتة الرقمية</h2>

      <section className="grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-4">
        <div>
          <Label className="text-xs">رقم الهاتف (مطلوب)</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" />
        </div>
        <div>
          <Label className="text-xs">الاسم (اختياري)</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
          موافق على رسائل العروض
        </label>
        <Button className="self-end" disabled={create.isPending || phone.trim().length < 6} onClick={() => create.mutate()}>
          إضافة عميل
        </Button>
      </section>

      <LoyaltyCard storeSlug={storeSlug} />

      <div className="flex gap-2">
        <Input placeholder="بحث بالاسم أو الهاتف" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {list.isLoading ? <Skeleton className="h-64 w-full rounded-2xl" /> : null}
      {list.isError ? <p className="text-sm text-destructive">مفيش صلاحية لبيانات العملاء.</p> : null}

      {list.data ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                {["العميل", "الهاتف", "الرصيد", "سقف الدين", "النقاط", "واتساب", ""].map((h) => (
                  <th key={h} className="p-2 text-start font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.data.customers.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-2 font-bold">{c.name}</td>
                  <td className="p-2">{c.phone}</td>
                  <td className="p-2">{money(c.balance)}</td>
                  <td className="p-2">{money(c.creditLimit)}</td>
                  <td className="p-2">{c.points}</td>
                  <td className="p-2">{c.marketingOptIn ? "موافق" : "غير موافق"}</td>
                  <td className="p-2">
                    <Button size="sm" variant="outline" onClick={() => setOpenId(c.id)}>
                      كشف حساب
                    </Button>
                  </td>
                </tr>
              ))}
              {list.data.customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    مفيش عملاء.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      <StatementDialog storeSlug={storeSlug} customerId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function LoyaltyCard({ storeSlug }: { storeSlug: string }) {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["loyalty-settings", storeSlug],
    queryFn: () => loyaltySettingsGet({ data: { storeSlug } }),
    retry: false,
  });
  const [draft, setDraft] = useState<{ earn: string; value: string; min: string } | null>(null);

  const save = useMutation({
    mutationFn: () =>
      loyaltySettingsSave({
        data: {
          storeSlug,
          enabled: true,
          earnAmountPerPoint: Number(draft?.earn ?? 10),
          pointValue: Number(draft?.value ?? 1),
          minimumRedeemPoints: Number(draft?.min ?? 50),
          maxDiscountCap: null,
          allowRedemption: true,
        },
      }),
    onSuccess: () => {
      toast.success("تم حفظ إعدادات النقاط");
      void qc.invalidateQueries({ queryKey: ["loyalty-settings"] });
    },
    onError: () => toast.error("مسموح لصاحب المتجر/المدير فقط"),
  });

  if (!settings.data) return null;
  const s = settings.data;
  const d = draft ?? {
    earn: String(s.earnAmountPerPoint),
    value: String(s.pointValue),
    min: String(s.minimumRedeemPoints),
  };

  return (
    <section className="grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-4">
      <div className="sm:col-span-4 text-sm font-extrabold">إعدادات نقاط الولاء</div>
      <div>
        <Label className="text-xs">مبلغ مقابل نقطة</Label>
        <Input value={d.earn} disabled={!s.canManage} onChange={(e) => setDraft({ ...d, earn: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">قيمة النقطة</Label>
        <Input value={d.value} disabled={!s.canManage} onChange={(e) => setDraft({ ...d, value: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">أقل نقاط للاستبدال</Label>
        <Input value={d.min} disabled={!s.canManage} onChange={(e) => setDraft({ ...d, min: e.target.value })} />
      </div>
      <Button className="self-end" disabled={!s.canManage || save.isPending} onClick={() => save.mutate()}>
        حفظ
      </Button>
    </section>
  );
}

function StatementDialog({
  storeSlug,
  customerId,
  onClose,
}: {
  storeSlug: string;
  customerId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const statement = useQuery({
    queryKey: ["crm-statement", storeSlug, customerId],
    queryFn: () => crmCustomerStatement({ data: { storeSlug, customerId: customerId! } }),
    enabled: Boolean(customerId),
    retry: false,
  });

  const pay = useMutation({
    mutationFn: () =>
      crmRecordPayment({ data: { storeSlug, customerId: customerId!, amount: Number(amount), notes: "تحصيل" } }),
    onSuccess: () => {
      toast.success("تم تسجيل التحصيل");
      setAmount("");
      void qc.invalidateQueries({ queryKey: ["crm-statement"] });
      void qc.invalidateQueries({ queryKey: ["crm-customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const consent = useMutation({
    mutationFn: (optIn: boolean) => crmSetConsent({ data: { storeSlug, customerId: customerId!, optIn, notes: "" } }),
    onSuccess: () => {
      toast.success("تم تحديث موافقة العروض");
      void qc.invalidateQueries({ queryKey: ["crm-statement"] });
      void qc.invalidateQueries({ queryKey: ["crm-customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const d = statement.data;

  return (
    <Dialog open={Boolean(customerId)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>كشف حساب العميل</DialogTitle>
        </DialogHeader>
        {statement.isLoading ? <Skeleton className="h-64 w-full" /> : null}
        {d ? (
          <div className="space-y-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-border p-2">
                <p className="text-[11px] text-muted-foreground">العميل</p>
                <p className="font-bold">
                  {d.customer.name} — {d.customer.phone}
                </p>
              </div>
              <div className="rounded-xl border border-border p-2">
                <p className="text-[11px] text-muted-foreground">الرصيد</p>
                <p className="font-bold">{money(d.balance)}</p>
              </div>
              <div className="rounded-xl border border-border p-2">
                <p className="text-[11px] text-muted-foreground">النقاط</p>
                <p className="font-bold">{d.points}</p>
              </div>
            </div>

            {!d.balanced ? (
              <p className="rounded-xl bg-destructive/10 p-2 text-xs text-destructive">
                تنبيه: الرصيد المخزّن ({money(d.balance)}) مش مطابق لمجموع القيود ({money(d.computedBalance)}).
              </p>
            ) : null}

            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  {["التاريخ", "النوع", "مدين", "دائن", "الرصيد بعد", "ملاحظة"].map((h) => (
                    <th key={h} className="p-1 text-start font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.entries.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="p-1">{fmt(e.at)}</td>
                    <td className="p-1">{e.type}</td>
                    <td className="p-1">{e.debit ? money(e.debit) : "—"}</td>
                    <td className="p-1">{e.credit ? money(e.credit) : "—"}</td>
                    <td className="p-1">{money(e.balanceAfter)}</td>
                    <td className="p-1">{e.note}</td>
                  </tr>
                ))}
                {d.entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground">
                      مفيش قيود.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>

            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs">تسجيل تحصيل</Label>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="المبلغ" />
              </div>
              <Button disabled={!Number(amount) || pay.isPending} onClick={() => pay.mutate()}>
                تسجيل
              </Button>
              <Button variant="outline" onClick={() => consent.mutate(!d.customer.marketingOptIn)}>
                {d.customer.marketingOptIn ? "إلغاء موافقة العروض" : "تفعيل موافقة العروض"}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
