import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Store, PlusCircle, LogOut, RefreshCw, ShieldAlert } from "lucide-react";

import { AdminAuthProvider, useAdminAuth } from "@/lib/auth/admin-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/developer")({
  head: () => ({
    meta: [
      { title: "مركز تحكم تِكّة للمطوّر" },
      {
        name: "description",
        content: "إنشاء وإدارة سوبرماركتات مستقلة بهوية خاصة فوق محرّك تِكّة التجاري.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DeveloperLayout,
});

const navItems = [
  { to: "/developer", label: "نظرة عامة", icon: LayoutDashboard, exact: true },
  { to: "/developer/stores", label: "السوبرماركتات", icon: Store, exact: false },
  { to: "/developer/new", label: "إنشاء سوبرماركت", icon: PlusCircle, exact: false },
] as const;

function DeveloperLayout() {
  return (
    <AdminAuthProvider>
      <DeveloperShell />
    </AdminAuthProvider>
  );
}

function DeveloperShell() {
  const { user, ready, signOut } = useAdminAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <RefreshCw className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== "super_admin") {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="max-w-sm">
          <ShieldAlert className="mx-auto size-10 text-destructive" />
          <h1 className="mt-3 text-xl font-bold">المركز ده لمالك المنصّة</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            محتاج تسجّل دخول بحساب مدير النظام عشان تدخل.
          </p>
          <Button asChild className="mt-4">
            <Link to="/admin/login">تسجيل الدخول</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:px-6">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-sm font-black text-primary-foreground">
            T
          </span>
          <div className="leading-tight">
            <p className="text-sm font-black">مركز تحكم المطوّر</p>
            <p className="text-[11px] text-muted-foreground">محرّك تِكّة متعدد المتاجر</p>
          </div>
          <div className="ms-auto flex items-center gap-2 text-xs">
            <span className="hidden sm:inline text-muted-foreground">{user.name}</span>
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => void signOut()}>
              <LogOut className="size-4" /> خروج
            </Button>
          </div>
        </div>

        <nav aria-label="أقسام المركز" className="mx-auto max-w-7xl overflow-x-auto px-4 pb-2 md:px-6">
          <ul className="flex gap-1">
            {navItems.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <Outlet />
      </main>
    </div>
  );
}
