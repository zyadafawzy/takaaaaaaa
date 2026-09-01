import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { usePos } from "@/components/pos/PosShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTimeAr, formatPrice } from "@/lib/format";
import {
  posCreateCustomer,
  posCustomerLedger,
  posCustomerPayment,
  posListCustomers,
} from "@/lib/pos.functions";
import type { PosCustomer } from "@/types/pos";

export const Route = createFileRoute("/pos/customers")({
  head: () => ({
    meta: [
      { title: "العملاء والآجل | تِكّة" },
      { name: "description", content: "دفتر العملاء: الأرصدة الآجلة، التحصيل النقدي وكشف الحساب التفصيلي." },
      { property: "og:title", content: "العملاء والآجل | تِكّة" },
      { property: "og:description", content: "إدارة دفتر الحسابات والآجل لعملاء السوبرماركت." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomersPage,
});

type LedgerRow = Awaited<ReturnType<typeof posCustomerLedger>>[number];

export function CustomersPage() {
  const pos = usePos();
  const [rows, setRows] = useState<PosCustomer[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PosCustomer | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [amount, setAmount] = useState("0");
  const [form, setForm] = useState({ name: "", phone: "", address: "", creditLimit: "0" });
  const [busy, setBusy] = useState(false);

  const load = async (search?: string) => {
    try {
      setRows(await posListCustomers({ data: { storeId: pos.storeId, query: search || undefined } }));
    } catch {
      toast.error("مقدرناش نحمّل العملاء.");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.storeId]);

  const openLedger = async (customer: PosCustomer) => {
    setSelected(customer);
    try {
      setLedger(await posCustomerLedger({ data: { customerId: customer.id } }));
    } catch {
      toast.error("كشف الحساب مش متاح.");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <section className="space-y-4">
        <h1 className="text-2xl font-extrabold">العملاء والآجل</h1>

        <div className="flex gap-2">
          <Input
            value={query}
            placeholder="اسم أو رقم موبايل"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void load(query);
            }}
          />
          <Button variant="secondary" onClick={() => void load(query)}>
            بحث
          </Button>
        </div>

        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">مفيش عملاء.</li>
          ) : (
            rows.map((customer) => (
              <li key={customer.id}>
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-start hover:bg-muted"
                  onClick={() => void openLedger(customer)}
                >
                  <span className="font-semibold">{customer.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {customer.phone ?? "—"} · {customer.points} نقطة
                  </span>
                  <span className={`font-bold tabular-nums ${customer.balance > 0 ? "text-destructive" : ""}`}>
                    {formatPrice(customer.balance)}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
          <p className="font-semibold">عميل جديد</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="c-name">الاسم</Label>
              <Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-phone">الموبايل</Label>
              <Input id="c-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-address">العنوان</Label>
              <Input
                id="c-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-limit">حد الآجل</Label>
              <Input
                id="c-limit"
                value={form.creditLimit}
                inputMode="decimal"
                onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
              />
            </div>
          </div>
          <Button
            disabled={busy || form.name.trim().length < 2}
            onClick={async () => {
              setBusy(true);
              try {
                await posCreateCustomer({
                  data: {
                    storeId: pos.storeId,
                    name: form.name.trim(),
                    phone: form.phone.trim() || undefined,
                    address: form.address.trim() || undefined,
                    creditLimit: Number(form.creditLimit) || 0,
                  },
                });
                toast.success("العميل اتضاف.");
                setForm({ name: "", phone: "", address: "", creditLimit: "0" });
                await load();
              } catch {
                toast.error("مقدرناش نضيف العميل (يمكن الرقم مكرر).");
              }
              setBusy(false);
            }}
          >
            إضافة
          </Button>
        </div>
      </section>

      <aside className="space-y-3">
        {selected ? (
          <>
            <div className="rounded-lg border border-border p-4">
              <p className="font-bold">{selected.name}</p>
              <p className="text-sm text-muted-foreground">رصيد آجل: {formatPrice(selected.balance)}</p>
              <div className="mt-3 flex items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="pay-amount">تحصيل نقدي</Label>
                  <Input
                    id="pay-amount"
                    value={amount}
                    inputMode="decimal"
                    className="w-32"
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </div>
                <Button
                  disabled={busy || !(Number(amount) > 0)}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const result = await posCustomerPayment({
                        data: { customerId: selected.id, amount: Number(amount) },
                      });
                      toast.success(`تم التحصيل — الرصيد الجديد ${formatPrice(result.balance)}`);
                      setAmount("0");
                      await load(query);
                      await openLedger({ ...selected, balance: result.balance });
                    } catch {
                      toast.error("التحصيل فشل.");
                    }
                    setBusy(false);
                  }}
                >
                  تحصيل
                </Button>
              </div>
            </div>

            <ul className="divide-y divide-border rounded-lg border border-border text-sm">
              {ledger.length === 0 ? (
                <li className="p-3 text-muted-foreground">مفيش حركات.</li>
              ) : (
                ledger.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-2 p-3">
                    <span>{entry.notes ?? entry.entryType}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTimeAr(entry.createdAt)}</span>
                    <span className="tabular-nums">
                      {entry.debit > 0 ? `+${entry.debit.toFixed(2)}` : `-${entry.credit.toFixed(2)}`}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            اختار عميل لعرض كشف الحساب.
          </p>
        )}
      </aside>
    </div>
  );
}
