import { Link } from "@tanstack/react-router";
import { Moon, Search, ShoppingBasket, Sun } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { ZonePicker } from "./ZonePicker";
import { AnnouncementBar } from "./AnnouncementBar";

export function SiteHeader() {
  const { count, subtotal } = useCart();
  const { theme, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.03] bg-background/60 backdrop-blur-2xl transition-colors duration-300">
      <AnnouncementBar />

      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 md:px-6">

        <Logo withPromise />

        <nav aria-label="أقسام الموقع" className="mx-4 hidden items-center gap-1 md:flex">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/categories">الأقسام</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/search" search={{ q: "" }}>البحث</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/category/$slug" params={{ slug: "offers" }}>
              عروض حقيقية
            </Link>
          </Button>
        </nav>

        <div className="ms-auto flex items-center gap-1.5">
          <div className="hidden sm:block">
            <ZonePicker />
          </div>

          <Button variant="ghost" size="icon" asChild className="md:hidden">
            <Link to="/search" search={{ q: "" }} aria-label="البحث">
              <Search className="size-5" />
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl size-10 hover:bg-white/5"
            onClick={toggle}
            aria-label={theme === "dark" ? "التبديل للوضع الفاتح" : "التبديل للوضع الداكن"}
          >
            {theme === "dark" ? <Sun className="size-5 text-primary" /> : <Moon className="size-5 text-primary" />}
          </Button>

          <Button variant="secondary" size="sm" asChild className="h-10 gap-2.5 rounded-xl border border-white/5 bg-card/50 px-3 shadow-inner group">
            <Link to="/cart" aria-label={`السلة، ${count} عنصر`}>
              <ShoppingBasket className="size-5 text-primary transition-transform group-active:scale-90" />
              <span className="hidden text-xs font-black sm:inline price tracking-wide">{formatPrice(subtotal)}</span>
              <span className="flex h-6 min-w-6 items-center justify-center rounded-lg bg-primary px-1.5 text-[11px] font-black text-primary-foreground shadow-lg shadow-primary/20">
                {count}
              </span>
            </Link>
          </Button>

        </div>
      </div>
    </header>
  );
}
