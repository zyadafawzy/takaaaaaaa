import { Link, useRouterState } from "@tanstack/react-router";
import { Home, LayoutGrid, Search, ShoppingBasket } from "lucide-react";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "الرئيسية", icon: Home, exact: true },
  { to: "/categories", label: "الأقسام", icon: LayoutGrid, exact: false },
  { to: "/search", label: "البحث", icon: Search, exact: false },
  { to: "/cart", label: "السلة", icon: ShoppingBasket, exact: false },
] as const;

export function BottomNav() {
  const { count } = useCart();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <nav
      aria-label="التنقل الأساسي"
      className="fixed inset-x-5 bottom-6 z-50 rounded-3xl border border-white/10 bg-card/70 shadow-premium backdrop-blur-2xl md:hidden lg:inset-x-auto lg:start-1/2 lg:-translate-x-1/2 lg:w-[420px]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >

      <ul className="flex h-16 items-stretch">
        {items.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1.5 transition-all active:scale-90",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <Icon 
                    className={cn("size-6 transition-transform", active && "scale-110")} 
                    aria-hidden 
                    strokeWidth={active ? 2.5 : 2}
                  />
                  {item.to === "/cart" && count > 0 ? (
                    <span className="absolute -top-1.5 -end-2.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground ring-2 ring-card shadow-lg">
                      {count}
                    </span>
                  ) : null}
                  {active && (
                    <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
                  )}
                </span>
                <span className={cn("text-[10px] font-bold", active && "text-primary")}>
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>

  );
}
