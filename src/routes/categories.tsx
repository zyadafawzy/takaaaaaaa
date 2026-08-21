import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { catalogRepository } from "@/services/catalog-repository";
import { ErrorState } from "@/components/shared/States";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CategoryImage } from "@/components/catalog/CategoryImage";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "أقسام تِكّة — خضار وفاكهة، مخبوزات، ألبان وأكتر" },
      { name: "description", content: "اتصفح أقسام تِكّة: خضار وفاكهة، مخبوزات، ألبان وبيض، تجميد، مشروبات، سناكس، وأساسيات البيت." },
      { property: "og:title", content: "أقسام تِكّة" },
      { property: "og:description", content: "كل أقسام سوبرماركت تِكّة في مكان واحد." },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["categories"],
    queryFn: () => catalogRepository.listCategories(),
  });

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 md:px-6">
      <Breadcrumbs items={[{ label: "الأقسام" }]} />
      <h1 className="mb-1 text-2xl font-extrabold">الأقسام</h1>
      <p className="mb-4 text-sm text-muted-foreground">اختار القسم اللي محتاج منه.</p>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {data?.map((category, index) => (
            <li key={category.id}>
              <Link
                to="/category/$slug"
                params={{ slug: category.slug }}
                className="group block overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-colors hover:border-primary"
              >
                <span className="relative block aspect-[4/3] w-full overflow-hidden">
                  <CategoryImage
                    slug={category.slug}
                    name={category.name}
                    eager={index < 4}
                    className="size-full transition-transform duration-300 group-hover:scale-105"
                  />
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                </span>
                <span className="block p-3">
                  <span className="block text-sm font-bold">{category.name}</span>
                  <span className="line-clamp-1 block text-xs text-muted-foreground">{category.description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
