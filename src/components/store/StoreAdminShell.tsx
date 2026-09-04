import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  Truck,
  Package,
  Palette,
  Settings,
  LogOut,
  BarChart3,
  Megaphone,
  Users,
  Store as StoreIcon,
  ScanBarcode,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConnectionChip } from "@/components/store/ConnectionChip";

type Tab = { to: string; label: string; icon: typeof LayoutDashboard; primary?: boolean };

const tabs: Tab[] = [
  { to: "/s/$storeSlug/admin", label: "الرئيسية", icon: LayoutDashboard, primary: true },
  { to: "/s/$storeSlug/admin/orders", label: "الطلبات", icon: ShoppingBag, primary: true },
  { to: "/s/$storeSlug/admin/delivery", label: "شاشة التوصيل", icon: Truck, primary: true },
  { to: "/s/$storeSlug/admin/catalog", label: "المنتجات", icon: Package, primary: true },
  { to: "/s/$storeSlug/admin/pos", label: "الكاشير (POS)", icon: ScanBarcode, primary: true },
  { to: "/s/$storeSlug/admin/sales", label: "مركز المبيعات", icon: BarChart3, primary: true },
  { to: "/s/$storeSlug/admin/customers", label: "العملاء", icon: Users, primary: true },
  { to: "/s/$storeSlug/admin/whatsapp", label: "واتساب", icon: Megaphone },
  { to: "/s/$storeSlug/admin/reports", label: "التقارير", icon: BarChart3, primary: true },

  { to: "/s/$storeSlug/admin/announcements", label: "الإعلانات", icon: Megaphone },
  { to: "/s/$storeSlug/admin/team", label: "الفريق", icon: Users },
  { to: "/s/$storeSlug/admin/theme", label: "الشكل والثيم", icon: Palette },
  { to: "/s/$storeSlug/admin/settings", label: "الإعدادات والتوصيل", icon: Settings, primary: true },
];

/**
 * الدخول للوحة متجر معيّن لازم يتأكد من الخادم إن جلسة Supabase الحالية
 * فعلاً مسؤولة عن المتجر ده — علامة المتصفح لوحدها مش كفاية.
 */
export function useStoreSession(storeSlug: string) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { getOfflineSession } = await import("@/lib/store-offline-auth");
      const fallbackToOffline = () => {
        if (cancelled) return false;
        const session = getOfflineSession(storeSlug);
        if (!session) return false;
        setOfflineMode(true);
        setIsLoggedIn(true);
        return true;
      };

      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase.auth.getSession();
        if (!data.session) throw new Error("NO_SESSION");
        const { storeAdminSessionCheck } = await import("@/lib/store-admin.functions");
        const result = await storeAdminSessionCheck({ data: { storeSlug } });
        if (cancelled) return;
        if (result.ok) {
          window.sessionStorage.setItem(`store-admin-auth-${storeSlug}`, "true");
          setOfflineMode(false);
          setIsLoggedIn(true);
        } else if (!fallbackToOffline()) {
          window.sessionStorage.removeItem(`store-admin-auth-${storeSlug}`);
          setIsLoggedIn(false);
        }
      } catch {
        if (cancelled) return;
        // مفيش نت أو الجلسة مش موجودة: نقبل جلسة أوفلاين محفوظة على الجهاز.
        if (!fallbackToOffline()) {
          window.sessionStorage.removeItem(`store-admin-auth-${storeSlug}`);
          setIsLoggedIn(false);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeSlug]);

  return { isLoggedIn, ready, offlineMode };
}


export function StoreAdminLogin({ storeSlug, storeName }: { storeSlug: string; storeName: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [canOffline, setCanOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    void import("@/lib/store-offline-auth").then(({ hasOfflineCredentials }) =>
      setCanOffline(hasOfflineCredentials(storeSlug)),
    );
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [storeSlug]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 start-1/2 size-[520px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
      />
      <form
        className="relative w-full max-w-sm rounded-3xl border border-border/70 bg-surface/80 p-7 shadow-xl backdrop-blur-xl"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");

          const offlineAuth = await import("@/lib/store-offline-auth");

          // دخول أوفلاين: لو مفيش نت خالص، نتحقق من البصمة المحفوظة على الجهاز.
          const tryOffline = async (fallbackMessage: string) => {
            const result = await offlineAuth.offlineLogin({ storeSlug, username, password });
            if (result.ok) {
              window.sessionStorage.setItem(`store-admin-auth-${storeSlug}`, "true");
              window.location.reload();
              return;
            }
            setError(
              result.reason === "no-credential"
                ? "الحساب ده مسجّلش على الجهاز ده قبل كده، لازم أول دخول يكون والنت شغّال."
                : fallbackMessage,
            );
          };

          if (!navigator.onLine) {
            await tryOffline("كلمة المرور غلط (دخول أوفلاين)");
            setBusy(false);
            return;
          }

          try {
            const { storeAdminLoginByPassword } = await import("@/lib/store-assets.functions");
            const result = await storeAdminLoginByPassword({ data: { storeSlug, username, password } });

            if (result.ok) {
              const { supabase } = await import("@/integrations/supabase/client");
              await supabase.auth.signOut();
              const { error: signInError } = await supabase.auth.signInWithPassword({
                email: result.email,
                password,
              });
              if (signInError) {
                setError("حصلت مشكلة في تجهيز الجلسة، جرّب تاني");
              } else {
                // نحفظ بصمة الدخول عشان الجهاز ده يقدر يدخل أوفلاين بعدين.
                await offlineAuth.rememberOfflineLogin({
                  storeSlug,
                  username,
                  email: result.email,
                  password,
                });
                window.sessionStorage.setItem(`store-admin-auth-${storeSlug}`, "true");
                window.location.reload();
              }
            } else {
              setError("اسم المستخدم أو كلمة المرور غلط");
            }
          } catch {
            // فشل الاتصال بالسيرفر (النت قطع في نص الطلب): نجرب الدخول الأوفلاين.
            await tryOffline("حصلت مشكلة في الدخول");
          } finally {
            setBusy(false);
          }
        }}
      >

        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="size-6" />
        </div>
        <h1 className="mt-4 text-center text-xl font-extrabold">لوحة {storeName}</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          ادخل باسم المستخدم وكلمة المرور الخاصة بحسابك.
        </p>
        {!online ? (
          <p
            className={`mt-3 rounded-xl border px-3 py-2 text-center text-[11px] font-bold ${
              canOffline
                ? "border-warning/40 bg-warning/10 text-warning"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            {canOffline
              ? "مفيش نت — الدخول هيتم أوفلاين بنفس اسم المستخدم وكلمة المرور المسجّلين على الجهاز."
              : "مفيش نت، والجهاز ده مفيهوش حساب محفوظ. لازم أول دخول يكون والنت شغّال."}
          </p>
        ) : null}


        <div className="mt-6 space-y-3">
          <div>
            <Label htmlFor="store-admin-username">اسم المستخدم</Label>
            <Input
              id="store-admin-username"
              dir="ltr"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              className="mt-1 h-11 rounded-xl"
              placeholder="مثال: owner"
              pattern="[A-Za-z0-9_-]{3,32}"
              required
            />
          </div>
          <div>
            <Label htmlFor="store-admin-password">كلمة المرور</Label>
            <Input
              id="store-admin-password"
              type="password"
              dir="ltr"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 h-11 rounded-xl"
              required
            />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <Button type="submit" className="h-11 w-full rounded-xl" disabled={busy}>
            {busy ? "بندخل..." : "دخول"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function NavItem({
  tab,
  storeSlug,
  variant,
}: {
  tab: Tab;
  storeSlug: string;
  variant: "side" | "bottom";
}) {
  const base =
    variant === "side"
      ? "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground data-[status=active]:shadow-sm"
      : "flex min-w-16 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors data-[status=active]:bg-primary/10 data-[status=active]:text-primary";

  return (
    <Link
      to={tab.to}
      params={{ storeSlug }}
      activeOptions={{ exact: tab.to === "/s/$storeSlug/admin" }}
      className={base}
    >
      <tab.icon className={variant === "side" ? "size-4" : "size-5"} />
      {tab.label}
    </Link>
  );
}

export function StoreAdminShell({
  storeSlug,
  storeName,
  email,
  children,
}: {
  storeSlug: string;
  storeName: string;
  email: string | null;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  void navigate;

  const signOut = async () => {
    window.sessionStorage.removeItem(`store-admin-auth-${storeSlug}`);
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <StoreIcon className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-extrabold leading-tight">لوحة {storeName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{email ?? "إدارة المتجر"}</p>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <ConnectionChip />
            <Button variant="outline" size="sm" className="rounded-full" asChild>
              <Link to="/s/$storeSlug" params={{ storeSlug }}>
                عرض المتجر
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 rounded-full"
              onClick={signOut}
              aria-label="خروج"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">خروج</span>
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 lg:hidden">
          {tabs.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              params={{ storeSlug }}
              activeOptions={{ exact: tab.to === "/s/$storeSlug/admin" }}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted/40 data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
            >
              <tab.icon className="size-4" />
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-24 space-y-1 rounded-2xl border border-border/70 bg-surface/70 p-2 backdrop-blur">
            {tabs.map((tab) => (
              <NavItem key={tab.to} tab={tab} storeSlug={storeSlug} variant="side" />
            ))}
          </div>
        </aside>
        <main className="min-w-0 flex-1 pb-24 lg:pb-6">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-surface/90 px-2 py-1.5 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-around">
          {tabs
            .filter((tab) => tab.primary)
            .map((tab) => (
              <NavItem key={tab.to} tab={tab} storeSlug={storeSlug} variant="bottom" />
            ))}
        </div>
      </nav>
    </div>
  );
}
