import { CategoryIcon } from "@/components/catalog/CategoryIcon";

/** صور الأقسام مولّدة بالـ AI ومحسّنة (WebP 384px) لتحميل سريع على الموبايل. */
export function categoryImageUrl(slug: string): string {
  // الأقسام الحقيقية وليست العروض تستخدم مسار ثابت
  if (slug === 'offers') return '/assets/categories/offers.webp';
  return `/assets/categories/${slug}.webp`;
}

export function CategoryImage({
  slug,
  name,
  className,
  eager = false,
}: {
  slug: string;
  name: string;
  className?: string;
  eager?: boolean;
}) {
  const src = categoryImageUrl(slug);

  return (
    <div className={`relative bg-muted ${className ?? ""}`}>
      <img
        src={src}
        alt={name}
        width={384}
        height={384}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "low"}
        decoding="async"
        className="size-full object-cover"
        onError={(e) => {
           // Fallback if image fails
           e.currentTarget.style.display = 'none';
           e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
        }}
      />
      <div className="fallback-icon hidden absolute inset-0 flex items-center justify-center">
         <CategoryIcon slug={slug} className="size-7 text-primary" />
      </div>
    </div>
  );
}
