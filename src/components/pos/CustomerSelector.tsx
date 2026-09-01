import { useState } from "react";
import { UserPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/format";
import type { PosCustomer } from "@/types/pos";

type Props = {
  selected: PosCustomer | null;
  customers: PosCustomer[];
  busy?: boolean;
  onSelect: (customer: PosCustomer | null) => void;
  onSearch: (query: string) => void;
  onCreate: (input: { name: string; phone?: string }) => Promise<void>;
};

export function CustomerSelector({ selected, customers, busy, onSelect, onSearch, onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
        <div>
          <p className="font-semibold">{selected.name}</p>
          <p className="text-xs text-muted-foreground">
            {selected.phone ?? "بدون رقم"} · رصيد آجل {formatPrice(selected.balance)} · {selected.points} نقطة
          </p>
        </div>
        <Button type="button" size="icon" variant="ghost" aria-label="إزالة العميل" onClick={() => onSelect(null)}>
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button type="button" variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <UserPlus className="size-4" />
        اختار عميل (اختياري)
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>عميل الفاتورة</DialogTitle>
            <DialogDescription>ابحث بالاسم أو الرقم، أو أضف عميل جديد.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={query}
                placeholder="اسم أو رقم موبايل"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onSearch(query);
                  }
                }}
              />
              <Button type="button" variant="secondary" onClick={() => onSearch(query)}>
                بحث
              </Button>
            </div>

            <ul className="max-h-56 divide-y divide-border overflow-auto rounded-lg border border-border">
              {customers.length === 0 ? (
                <li className="p-3 text-sm text-muted-foreground">مفيش نتائج.</li>
              ) : (
                customers.map((customer) => (
                  <li key={customer.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between p-3 text-start hover:bg-muted"
                      onClick={() => {
                        onSelect(customer);
                        setOpen(false);
                      }}
                    >
                      <span className="font-medium">{customer.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {customer.phone ?? "—"} · {formatPrice(customer.balance)}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>

            <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
              <p className="text-sm font-semibold">عميل جديد</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="pos-new-customer-name">الاسم</Label>
                  <Input
                    id="pos-new-customer-name"
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pos-new-customer-phone">الموبايل</Label>
                  <Input
                    id="pos-new-customer-phone"
                    value={newPhone}
                    inputMode="tel"
                    onChange={(event) => setNewPhone(event.target.value)}
                  />
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={busy || newName.trim().length < 2}
                onClick={async () => {
                  await onCreate({ name: newName.trim(), phone: newPhone.trim() || undefined });
                  setNewName("");
                  setNewPhone("");
                }}
              >
                أضف العميل
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
