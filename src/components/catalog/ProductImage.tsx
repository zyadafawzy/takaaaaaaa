/**
 * صورة منتج بحجم مناسب للجهاز.
 * الرابط بيتسلم من /api/public/product-image/:id?w=..، فالموبايل بياخد
 * نسخة صغيرة، والصور اللي برّة الشاشة مش بتتحمّل (lazy + decoding async).
 */

type Props = {
  src: string | undefined;
  alt: string;
  sizes?: number[];
  displayWidth?: number;
  className?: string;
  priority?: boolean;
};

function withWidth(src: string, width: number): string {
  return src.includes("?") ? `${src}&w=${width}` : `${src}?w=${width}`;
}

export function ProductImage({
  src,
  alt,
  sizes = [240, 360, 480],
  displayWidth = 360,
  className = "size-full object-cover",
  priority = false,
}: Props) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-muted text-[11px] text-muted-foreground ${className}`}
        aria-hidden
      >
        بدون صورة
      </div>
    );
  }

  return (
    <img
      src={withWidth(src, displayWidth)}
      srcSet={sizes.map((width) => `${withWidth(src, width)} ${width}w`).join(", ")}
      sizes="(max-width: 768px) 45vw, 240px"
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      {...(priority ? { fetchPriority: "high" as const } : {})}
      width={displayWidth}
      height={displayWidth}
      className={className}
    />
  );
}
