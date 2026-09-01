import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { usePos } from "@/components/pos/PosShell";
import { POS_STOCK_ROLES, posCan } from "@/components/pos/pos-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/format";
import { posCreateSupplier, posListSuppliers } from "@/lib/pos.functions";

export const Route = createFileRoute("/pos/suppliers")({
  head: () => ({
    meta: [
      { title: "الموردون | تِكّة" },
      { name: "description", content: "بيانات الموردين وأرصدتهم لمتابعة مستحقات فواتير الشراء." },
      { property: "og:title", content: "الموردون | تِكّة" },
      { property: "og:description", content: "إدارة الموردين وأرصدة المستحقات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuppliersPage,
});

type Supplier = Awaited<ReturnType<typeof posListSuppliers>>[number];

function SuppliersPage() {
  const pos = usePos();
  const [rows, setRows] = useState<Supplier[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", address: "", taxNumber: "" });
  const [busy, setBusy] = useState(false);
  const canWrite = posCan(pos.role, POS_STOCK_ROLES);

  const load = async () => {
    try {
      setRows(await posListSuppliers({ data: { storeId: pos.storeId } }));
    } catch {
      toast.error("مقدرناش نحمّل الموردين.");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.storeId]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4">
        <h1 className="text-2xl font-extrabold">الموردون</h1>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">مفيش موردين.</li>
          ) : (
            rows.map((supplier) => (
              <li key={supplier.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="font-semibold">{supplier.name}</span>
                <span className="text-xs text-muted-foreground">{supplier.phone ?? "—"}</span>
                <span className="font-bold tabular-nums">{formatPrice(supplier.balance)}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      {canWrite ? (
        <section className="space-y-3 rounded-lg border border-dashed border-border p-4">
          <p className="font-semibold">مورد جديد</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="s-name">الاسم</Label>
              <Input id="s-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-phone">الموبايل</Label>
              <Input id="s-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-address">العنوان</Label>
              <Input
                id="s-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-tax">الرقم الضريبي</Label>
              <Input
                id="s-tax"
                value={form.taxNumber}
                onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
              />
            </div>
          </div>
          <Button
            disabled={busy || form.name.trim().length < 2}
            onClick={async () => {
              setBusy(true);
              try {
                await posCreateSupplier({
                  data: {
                    storeId: pos.storeId,
                    name: form.name.trim(),
                    phone: form.phone.trim() || undefined,
                    address: form.address.trim() || undefined,
                    taxNumber: form.taxNumber.trim() || undefined,
                  },
                });
                toast.success("المورد اتضاف.");
                setForm({ name: "", phone: "", address: "", taxNumber: "" });
                await load();
              } catch {
                toast.error("مقدرناش نضيف المورد.");
              }
              setBusy(false);
            }}
          >
            إضافة
          </Button>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">إضافة الموردين متاحة لأمين المخزن والمديرين.</p>
      )}
    </div>
  );
}
