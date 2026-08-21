import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 text-sm md:grid-cols-3 md:px-6">
        <div>
          <p className="font-bold text-primary">تِكّة</p>
          <p className="mt-1 text-xs text-muted-foreground">طلبات البيت اللي ناقصة، في كام تكة.</p>
        </div>
        <nav aria-label="روابط المتجر" className="flex flex-col gap-1">
          <Link to="/delivery" className="text-muted-foreground hover:text-foreground">
            سياسة التوصيل
          </Link>
          <Link to="/freshness" className="text-muted-foreground hover:text-foreground">
            سياسة الفريش والبديل
          </Link>
          <Link to="/privacy" className="text-muted-foreground hover:text-foreground">
            سياسة الخصوصية
          </Link>
          <Link to="/terms" className="text-muted-foreground hover:text-foreground">
            شروط الاستخدام
          </Link>
        </nav>
        <div className="flex flex-col gap-1">
          <Link to="/contact" className="text-muted-foreground hover:text-foreground">
            خدمة العملاء وواتساب
          </Link>
          <span className="text-xs text-muted-foreground">© {new Date().getFullYear()} تِكّة</span>
        </div>
      </div>
    </footer>
  );
}
