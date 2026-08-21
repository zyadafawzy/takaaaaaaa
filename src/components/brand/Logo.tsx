import { Link } from "@tanstack/react-router";
import mark from "@/assets/tikka-mark.png";

export function Logo({ withPromise = false }: { withPromise?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="تِكّة — الصفحة الرئيسية">
      <img src={mark} alt="" width={36} height={36} className="size-9 shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="text-xl font-extrabold tracking-tight text-primary">تِكّة</span>
        {withPromise ? (
          <span className="mt-0.5 text-[11px] text-muted-foreground">سوبرماركت البيت</span>
        ) : null}
      </span>
    </Link>
  );
}
