import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Flag, RefreshCw, Search, Send, Star, StarOff, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/format";
import { useAdminAuth } from "@/lib/auth/admin-auth";
import {
  adminBulkProductAction,
  adminCatalogStats,
  adminListProducts,
} from "@/lib/admin-catalog.functions";

export const Route = createFileRoute("/admin/catalog")({
  head: () => ({
    meta: [
      { title: "استوديو الكتالوج — تِكّة" },
      {
        name: "description",
        content: "إدارة الأصناف: بحث وفلاتر خادمية، مراجعة المسودات، النشر والإخفاء بشكل جماعي.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminCatalog,
});

type StatusFilter = "all" | "draft" | "published" | "archived";
type VisibilityFilter = "all" | "visible" | "hidden";
type SortKey = "newest" | "name" | "price_asc" | "price_desc";

const statusLabels: Record<string, string> = {
  draft: "مسودة",
  published: "منشور",
  archived: "مؤرشف",
};

function AdminCatalog() {
  const { allowed, ready } = useAdminAuth();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [visibility, setVisibility] = useState<VisibilityFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [needsReview, setNeedsReview] = useState(false);
  const [missingImage, setMissingImage] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const canEdit = ready && allowed("catalog.edit");

  const stats = useQuery({ 
    queryKey: ["admin-catalog-stats"], 
    queryFn: () => adminCatalogStats(),
    enabled: ready && allowed("catalog.view")
  });
  const list = useQuery({
    queryKey: ["admin-catalog", { search, status, visibility, sort, needsReview, missingImage, page }],
    queryFn: () =>
      adminListProducts({
        data: { search, status, visibility, sort, needsReview, missingImage, page },
      }),
    enabled: ready && allowed("catalog.view")
  });


  if (ready && !allowed("catalog.view")) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-sm">
        مالكش صلاحية على الكتالوج.
      </div>
    );
  }

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const pageSize = list.data?.pageSize ?? 25;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  async function runAction(action: string) {
    if (selected.length === 0) {
      toast.error("اختار أصناف الأول");
      return;
    }
    setBusy(true);
    try {
      const result = await adminBulkProductAction({
        data: { ids: selected, action: action as "publish" },
      });
      toast.success(`اتنفّذ على ${result.affected} صنف`);
      setSelected([]);
      await Promise.all([list.refetch(), stats.refetch()]);
    } catch {
      toast.error("العملية فشلت — راجع صلاحيتك");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">استوديو الكتالوج</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            كل الفلاتر والبحث بيشتغلوا على الخادم — الصفحة بتحمّل ٢٥ صنف بس، مهما كان حجم الكتالوج.
          </p>
        </div>
        <Button variant="ghost" className="gap-2" onClick={() => void list.refetch()}>
          <RefreshCw className="size-4" /> تحديث
        </Button>
      </header>

      <section className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {[
          { label: "إجمالي الأصناف", value: stats.data?.total },
          { label: "مسودات", value: stats.data?.drafts },
          { label: "منشور", value: stats.data?.published },
          { label: "ظاهر للعميل", value: stats.data?.live },
          { label: "محتاج مراجعة", value: stats.data?.needsReview },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-surface p-3">
            <p className="text-[11px] text-muted-foreground">{card.label}</p>
            <p className="price mt-1 text-lg font-bold">{card.value ?? "—"}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-surface p-3">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(0);
            setSearch(term.trim());
          }}
        >
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="ابحث بالاسم أو كود الصنف"
              className="ps-9"
              aria-label="بحث في الكتالوج"
            />
          </div>

          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as StatusFilter);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-36 text-xs" aria-label="حالة النشر">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="draft">مسودة</SelectItem>
              <SelectItem value="published">منشور</SelectItem>
              <SelectItem value="archived">مؤرشف</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={visibility}
            onValueChange={(value) => {
              setVisibility(value as VisibilityFilter);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-36 text-xs" aria-label="الظهور">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ظاهر ومخفي</SelectItem>
              <SelectItem value="visible">ظاهر للعميل</SelectItem>
              <SelectItem value="hidden">مخفي</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
            <SelectTrigger className="w-36 text-xs" aria-label="الترتيب">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">الأحدث</SelectItem>
              <SelectItem value="name">الاسم</SelectItem>
              <SelectItem value="price_asc">السعر من الأقل</SelectItem>
              <SelectItem value="price_desc">السعر من الأعلى</SelectItem>
            </SelectContent>
          </Select>

          <label className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={needsReview}
              onCheckedChange={(value) => {
                setNeedsReview(value === true);
                setPage(0);
              }}
            />
            محتاج مراجعة
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={missingImage}
              onCheckedChange={(value) => {
                setMissingImage(value === true);
                setPage(0);
              }}
            />
            بدون صورة
          </label>

          <Button type="submit" size="sm">
            ابحث
          </Button>
        </form>

        {canEdit ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">محدد: {selected.length}</span>
            <Button size="sm" disabled={busy} className="gap-1" onClick={() => void runAction("publish")}>
              <Send className="size-4" /> انشر
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              className="gap-1"
              onClick={() => void runAction("unpublish")}
            >
              <Undo2 className="size-4" /> رجّعه مسودة
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              className="gap-1"
              onClick={() => void runAction("show")}
            >
              <Eye className="size-4" /> ظاهر
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              className="gap-1"
              onClick={() => void runAction("hide")}
            >
              <EyeOff className="size-4" /> اخفيه
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              className="gap-1"
              onClick={() => void runAction("flag_review")}
            >
              <Flag className="size-4" /> علّمه للمراجعة
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              className="gap-1"
              onClick={() => void runAction("feature")}
            >
              <Star className="size-4" /> تمييز (Feature)
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              className="gap-1"
              onClick={() => void runAction("unfeature")}
            >
              <StarOff className="size-4" /> إلغاء التمييز
            </Button>
          </div>
        ) : null}
      </section>

      <section className="overflow-x-auto rounded-xl border border-border bg-surface">
        {list.isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">مفيش أصناف بالفلاتر دي.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs">
              <tr>
                <th className="p-2">
                  <Checkbox
                    aria-label="اختيار كل الصفحة"
                    checked={selected.length > 0 && selected.length === items.length}
                    onCheckedChange={(value) =>
                      setSelected(value === true ? items.map((item) => item.id) : [])
                    }
                  />
                </th>
                <th className="p-2 text-start">الصنف</th>
                <th className="p-2 text-start">القسم</th>
                <th className="p-2 text-start">السعر</th>
                <th className="p-2 text-start">المخزون</th>
                <th className="p-2 text-start">الحالة</th>
                <th className="p-2 text-start">الظهور</th>
                <th className="p-2 text-start">صور</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id} className={item.needsReview ? "bg-warning/5" : ""}>
                  <td className="p-2">
                    <Checkbox
                      aria-label={`اختيار ${item.name}`}
                      checked={selected.includes(item.id)}
                      onCheckedChange={(value) =>
                        setSelected((current) =>
                          value === true
                            ? [...current, item.id]
                            : current.filter((id) => id !== item.id),
                        )
                      }
                    />
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt=""
                          loading="lazy"
                          width={40}
                          height={40}
                          className="size-10 rounded-md object-cover"
                        />
                      ) : (
                        <span className="flex size-10 items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">
                          لا صورة
                        </span>
                      )}
                      <div>
                        <Link
                          to="/admin/catalog/$id"
                          params={{ id: item.id }}
                          className="font-medium hover:underline"
                        >
                          {item.name}
                          {item.isFeatured && (
                            <Star className="inline-block ms-1 size-3 fill-accent text-accent" />
                          )}
                        </Link>
                        <p className="price text-[11px] text-muted-foreground">{item.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">{item.categoryName || "—"}</td>
                  <td className="p-2">{item.price > 0 ? formatPrice(item.price) : "—"}</td>
                  <td className="p-2 price text-xs">{item.stock}</td>
                  <td className="p-2 text-xs">{statusLabels[item.status] ?? item.status}</td>
                  <td className="p-2 text-xs">
                    {item.visible ? (
                      <span className="text-success">ظاهر</span>
                    ) : (
                      <span className="text-muted-foreground">مخفي</span>
                    )}
                  </td>
                  <td className="p-2 price text-xs">{item.imageCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          صفحة {page + 1} من {pages} · {total} صنف
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
            السابق
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page + 1 >= pages}
            onClick={() => setPage(page + 1)}
          >
            التالي
          </Button>
        </div>
      </div>
    </div>
  );
}
