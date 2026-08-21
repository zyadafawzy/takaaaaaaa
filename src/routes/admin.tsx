import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LogOut, RefreshCw } from "lucide-react";

import { AdminAuthProvider, useAdminAuth } from "@/lib/auth/admin-auth";
import { roleLabels } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "لوحة تشغيل تِكّة" },
      { name: "description", content: "لوحة داخلية لفريق المتجر: الطلبات، المخزون، الكتالوج، والتقارير." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

const navItems = [
  { to: "/admin", label: "الرئيسية", exact: true },
  { to: "/admin/orders", label: "الطلبات", exact: false },
  { to: "/admin/catalog", label: "الكتالوج", exact: false },
  { to: "/admin/catalog-import", label: "رفع مكتبة الصور والبيانات", exact: false },
  { to: "/admin/inventory", label: "المخزون", exact: false },
  { to: "/admin/promotions", label: "العروض", exact: false },
  { to: "/admin/delivery", label: "مناطق التوصيل", exact: false },
  { to: "/admin/reports", label: "التقارير", exact: false },
  { to: "/admin/settings", label: "الإعدادات", exact: false },
] as const;

function AdminLayout() {
  return (
    <AdminAuthProvider>
      <AdminShell />
    </AdminAuthProvider>
  );
}

function AdminShell() {
  const { user, ready, signOut } = useAdminAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isLogin = pathname.startsWith("/admin/login");

  if (isLogin) return <Outlet />;

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="text-center">
          <RefreshCw className="mx-auto size-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">بنفتح اللوحة...</p>
        </div>
      </div>
    );
  }


  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-bold">اللوحة دي لفريق المتجر</h1>
          <p className="mt-2 text-sm text-muted-foreground">لازم تسجّل دخول عشان تكمّل.</p>
          <Button asChild className="mt-4">
            <Link to="/admin/login">تسجيل الدخول</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-3 md:px-6">
          <Logo />
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold">لوحة التشغيل</span>
          <div className="ms-auto flex items-center gap-2 text-xs">
            <span className="hidden sm:inline">
              {user.name} · {roleLabels[user.role]}
            </span>
            <Button variant="ghost" size="sm" onClick={() => void signOut()} className="gap-1">
              <LogOut className="size-4" /> خروج
            </Button>
          </div>
        </div>
        <nav aria-label="أقسام اللوحة" className="mx-auto max-w-6xl overflow-x-auto px-3 pb-2 md:px-6">
          <ul className="flex gap-1">
            {navItems.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={`inline-block whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-3 py-5 md:px-6">
        <Outlet />
      </main>
    </div>
  );
}
