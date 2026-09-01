import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { supabase } from "@/integrations/supabase/client";
import { posBootstrap, posCloseShift, posOpenShift, posSetupStore } from "@/lib/pos.functions";
import { formatPrice } from "@/lib/format";
import { POS_ROLE_LABELS, type PosBootstrapContext } from "@/components/pos/pos-context";

const PosContext = createContext<PosBootstrapContext | null>(null);

export function usePos(): PosBootstrapContext {
  const value = useContext(PosContext);
  if (!value) throw new Error("usePos لازم يكون جوّه PosShell");
  return value;
}

const NAV = [
  { to: "/pos", label: "الكاشير", exact: true },
  { to: "/pos/invoices", label: "الفواتير", exact: false },
  { to: "/pos/customers", label: "العملاء", exact: false },
  { to: "/pos/suppliers", label: "الموردون", exact: false },
  { to: "/pos/purchases", label: "المشتريات", exact: false },
  { to: "/pos/inventory", label: "المخزون", exact: false },
  { to: "/pos/unknown", label: "أصناف مجهولة", exact: false },
  { to: "/pos/damaged", label: "هوالك وتالف", exact: false },
  { to: "/pos/reports", label: "التقارير", exact: false },
  { to: "/pos/settings", label: "الإعدادات", exact: false },
] as const;

export function PosShell({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [boot, setBoot] = useState<Awaited<ReturnType<typeof posBootstrap>> | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (nextStoreId?: string | null) => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setSignedIn(false);
        setReady(true);
        return;
      }
      setSignedIn(true);
      try {
        const result = await posBootstrap({ data: nextStoreId ? { storeId: nextStoreId } : {} });
        setBoot(result);
        const active = nextStoreId ?? result.memberships[0]?.storeId ?? null;
        setStoreId(active);
        setBranchId((current) => {
          if (current && result.branches.some((b) => b.id === current)) return current;
          return result.openShift?.branchId ?? result.branches[0]?.id ?? null;
        });
      } catch {
        toast.error("مقدرناش نحمّل بيانات نقاط البيع.");
      }
      setReady(true);
    },
    [],
  );

  useEffect(() => {
    void load();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void load();
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const value = useMemo<PosBootstrapContext | null>(() => {
    if (!boot || !storeId) return null;
    const membership = boot.memberships.find((m) => m.storeId === storeId) ?? boot.memberships[0]!;
    return {
      storeId,
      storeName: membership.storeName,
      role: membership.role,
      branchId,
      branches: boot.branches,
      paymentMethods: boot.paymentMethods,
      shift: boot.openShift,
      memberships: boot.memberships,
      setBranchId,
      setStoreId: (next: string) => void load(next),
      refresh: () => load(storeId),
    };
  }, [boot, storeId, branchId, load]);

  if (!ready) {
    return <div className="p-10 text-center text-muted-foreground">بنحمّل…</div>;
  }

  if (!signedIn) return <PosSignIn />;

  if (!boot || boot.memberships.length === 0) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-10 text-center">
        <Logo />
        <h1 className="text-2xl font-extrabold">مفيش صلاحية على نقاط البيع</h1>
        <p className="text-muted-foreground">
          حسابك مسجّل، لكنه مش مضاف لأي متجر في نظام الكاشير. اطلب من صاحب المتجر يضيفك من صفحة الإعدادات.
        </p>
        <Button variant="outline" onClick={() => void supabase.auth.signOut()}>
          <LogOut className="size-4" />
          خروج
        </Button>
      </div>
    );
  }

  if (!value) return <div className="p-10 text-center text-muted-foreground">بنحمّل…</div>;

  return (
    <PosContext.Provider value={value}>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
            <Logo />
            <div className="flex-1">
              <p className="text-sm font-bold">{value.storeName}</p>
              <p className="text-xs text-muted-foreground">{POS_ROLE_LABELS[value.role]}</p>
            </div>

            {value.memberships.length > 1 ? (
              <select
                aria-label="اختيار المتجر"
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={value.storeId}
                onChange={(event) => value.setStoreId(event.target.value)}
              >
                {value.memberships.map((m) => (
                  <option key={m.storeId} value={m.storeId}>
                    {m.storeName}
                  </option>
                ))}
              </select>
            ) : null}

            {value.branches.length > 0 ? (
              <select
                aria-label="اختيار الفرع"
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={value.branchId ?? ""}
                onChange={(event) => value.setBranchId(event.target.value || null)}
              >
                {value.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            ) : null}

            <Button size="sm" variant="outline" onClick={() => void value.refresh()}>
              <RefreshCw className="size-4" />
              تحديث
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void supabase.auth.signOut()}>
              <LogOut className="size-4" />
              خروج
            </Button>
          </div>

          <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2">
            {NAV.map((item) => (
              <PosNavLink key={item.to} to={item.to} label={item.label} exact={item.exact} />
            ))}
          </nav>
        </header>

        {value.branches.length === 0 ? <PosSetupBanner storeId={value.storeId} onDone={value.refresh} /> : null}

        <ShiftBar busy={busy} setBusy={setBusy} />

        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </div>
    </PosContext.Provider>
  );
}

function PosNavLink({ to, label, exact }: { to: string; label: string; exact: boolean }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const active = exact ? pathname === to : pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {label}
    </Link>
  );
}

function PosSetupBanner({ storeId, onDone }: { storeId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="border-b border-border bg-muted px-4 py-3 text-center text-sm">
      المتجر ده لسه مش مهيّأ لنقاط البيع (مفيش فروع ولا طرق دفع).{" "}
      <Button
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await posSetupStore({ data: { storeId, branchName: "الفرع الرئيسي" } });
            toast.success("تمت التهيئة: فرع رئيسي + طرق دفع.");
            onDone();
          } catch {
            toast.error("مقدرناش نهيّئ المتجر — محتاج صلاحية صاحب متجر.");
          }
          setBusy(false);
        }}
      >
        هيّئ المتجر الآن
      </Button>
    </div>
  );
}

function ShiftBar({ busy, setBusy }: { busy: boolean; setBusy: (value: boolean) => void }) {
  const pos = usePos();
  const [opening, setOpening] = useState("0");
  const [closing, setClosing] = useState("0");

  if (!pos.shift) {
    return (
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="pos-opening">رصيد بداية الوردية</Label>
            <Input
              id="pos-opening"
              value={opening}
              inputMode="decimal"
              className="h-9 w-32"
              onChange={(event) => setOpening(event.target.value)}
            />
          </div>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await posOpenShift({
                  data: {
                    storeId: pos.storeId,
                    branchId: pos.branchId,
                    openingAmount: Number(opening) || 0,
                  },
                });
                toast.success("الوردية اتفتحت.");
                pos.refresh();
              } catch {
                toast.error("مقدرناش نفتح الوردية.");
              }
              setBusy(false);
            }}
          >
            افتح وردية
          </Button>
          <p className="text-sm text-muted-foreground">لازم تفتح وردية قبل أي فاتورة.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border bg-card px-4 py-3">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end gap-3">
        <p className="flex-1 text-sm">
          وردية مفتوحة من{" "}
          {new Intl.DateTimeFormat("ar-EG", { timeZone: "Africa/Cairo", timeStyle: "short" }).format(
            new Date(pos.shift.openedAt),
          )}{" "}
          · رصيد البداية {formatPrice(pos.shift.openingAmount)}
        </p>
        <div className="space-y-1">
          <Label htmlFor="pos-closing">النقدية في الدرج</Label>
          <Input
            id="pos-closing"
            value={closing}
            inputMode="decimal"
            className="h-9 w-32"
            onChange={(event) => setClosing(event.target.value)}
          />
        </div>
        <Button
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await posCloseShift({
                data: { shiftId: pos.shift!.id, closingAmount: Number(closing) || 0 },
              });
              toast.success(
                `الوردية اتقفلت — المتوقع ${formatPrice(result.expected)} · الفرق ${formatPrice(result.difference)}`,
              );
              pos.refresh();
            } catch {
              toast.error("مقدرناش نقفل الوردية.");
            }
            setBusy(false);
          }}
        >
          اقفل الوردية
        </Button>
      </div>
    </div>
  );
}

function PosSignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <Logo />
      <h1 className="text-2xl font-extrabold">دخول نقاط البيع</h1>
      <p className="text-sm text-muted-foreground">الشاشة دي لفريق المتجر فقط.</p>
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          const { error } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
          });
          if (error) toast.error("بيانات الدخول مش صحيحة.");
          setBusy(false);
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="pos-email">البريد</Label>
          <Input
            id="pos-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pos-password">كلمة المرور</Label>
          <Input
            id="pos-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "بندخل…" : "دخول"}
        </Button>
      </form>
    </div>
  );
}
