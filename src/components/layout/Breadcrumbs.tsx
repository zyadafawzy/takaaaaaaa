import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export type Crumb = { label: string; to?: string; params?: Record<string, string> };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="مسار التصفح" className="mb-5 overflow-x-auto no-scrollbar py-1">
      <ol className="flex whitespace-nowrap items-center gap-1.5 text-[11px] text-muted-foreground/60 font-medium">
        <li>
          <Link to="/" className="hover:text-primary transition-colors flex items-center gap-1">
            الرئيسية
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-1.5">
            <ChevronLeft className="size-3 opacity-30" aria-hidden />
            {item.to ? (
              <Link
                to={item.to as "/categories"}
                params={item.params as never}
                className="hover:text-primary transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="font-bold text-foreground/80">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>

  );
}
