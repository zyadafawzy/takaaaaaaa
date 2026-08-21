import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff, Save, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPrice } from "@/lib/format";
import { useAdminAuth } from "@/lib/auth/admin-auth";
import {
  adminBulkProductAction,
  adminGetProduct,
  adminSetImageState,
  adminUpdateProduct,
  adminUpdateVariant,
} from "@/lib/admin-catalog.functions";

export const Route = createFileRoute("/admin/catalog/$id")({
  head: () => ({
    meta: [
      { title: "تعديل صنف — تِكّة" },
      { name: "description", content: "تعديل بيانات الصنف والسعر والمخزون والصور وحالة الظهور." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProductEditor,
});

function ProductEditor() {
  const { id } = Route.useParams();
  const { allowed, ready } = useAdminAuth();
  const canEdit = ready && allowed("catalog.edit");

  const query = useQuery({ queryKey: ["admin-product", id], queryFn: () => adminGetProduct({ data: { id } }) });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [isFresh, setIsFresh] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [featuredUntil, setFeaturedUntil] = useState("");
  const [offerUntil, setOfferUntil] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const product = query.data?.product;
    if (!product) return;
    setName(product.name);
    setDescription(product.description);
    setCategoryId(product.categoryId ?? "");
    setIsFresh(product.isFresh);
    setReviewNote(product.reviewNote);
    setIsFeatured(product.isFeatured);
    setFeaturedUntil(product.featuredUntil ? product.featuredUntil.split("T")[0] : "");
    setOfferUntil(product.offerUntil ? product.offerUntil.split("T")[0] : "");
  }, [query.data?.product]);

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-52 w-full rounded-xl" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-sm">
        مقدرناش نفتح الصنف ده — يمكن اتشال أو مالكش صلاحية.
      </div>
    );
  }

  const { product, variants, images, categories, priceHistory } = query.data;

  async function saveInfo() {
    setBusy(true);
    try {
      await adminUpdateProduct({
        data: {
          id,
          name,
          description,
          categoryId: categoryId || null,
          isFresh,
          isFeatured,
          featuredUntil: featuredUntil ? new Date(featuredUntil).toISOString() : null,
          offerUntil: offerUntil ? new Date(offerUntil).toISOString() : null,
          reviewNote,
        },
      });
      toast.success("حفظنا بيانات الصنف");
      await query.refetch();
    } catch {
      toast.error("الحفظ فشل");
    } finally {
      setBusy(false);
    }
  }

  async function act(action: string) {
    setBusy(true);
    try {
      const result = await adminBulkProductAction({ data: { ids: [id], action: action as "publish" } });
      if (result.ok) {
        toast.success("اتحدّثت حالة الصنف");
      } else {
        toast.error("مينفعش تنشره", {
          description: "لازم يكون له قسم وسعر أكبر من صفر وصورة واحدة على الأقل.",
        });
      }
      await query.refetch();
    } catch {
      toast.error("العملية فشلت");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-1 gap-1 px-0">
            <Link to="/admin/catalog">
              <ArrowRight className="size-4" /> رجوع للاستوديو
            </Link>
          </Button>
          <h1 className="text-xl font-bold">{product.name}</h1>
          <p className="price text-xs text-muted-foreground">
            {product.sku} · {product.status === "published" ? "منشور" : "مسودة"} ·{" "}
            {product.visible ? "ظاهر للعميل" : "مخفي"}
          </p>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => void act("publish")}>
              انشر
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void act("unpublish")}>
              رجّعه مسودة
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              className="gap-1"
              onClick={() => void act(product.visible ? "hide" : "show")}
            >
              {product.visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              {product.visible ? "اخفيه" : "خلّيه ظاهر"}
            </Button>
          </div>
        ) : null}
      </div>

      {!product.isComplete || images.length === 0 || !product.categoryId ? (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs">
          قائمة نواقص قبل النشر:
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {!product.categoryId ? <li>مفيش قسم</li> : null}
            {images.length === 0 ? <li>مفيش صورة</li> : null}
            {variants.every((v: any) => Number(v.price) <= 0) ? <li>مفيش سعر صالح</li> : null}
          </ul>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-bold">البيانات الأساسية</h2>
          <div>
            <Label htmlFor="name">اسم الصنف</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="description">الوصف</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-1"
            />
          </div>
          <div>
            <Label>القسم</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="mt-1" aria-label="القسم">
                <SelectValue placeholder="اختار قسم" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category: any) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="fresh">منتج فريش</Label>
            <Switch id="fresh" checked={isFresh} onCheckedChange={setIsFresh} />
          </div>
          <div>
            <Label htmlFor="note">ملاحظة مراجعة داخلية</Label>
            <Input id="note" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} className="mt-1" />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="featured">تمييز المنتج (Featured)</Label>
            <Switch id="featured" checked={isFeatured} onCheckedChange={setIsFeatured} />
          </div>
          {isFeatured && (
            <div>
              <Label htmlFor="featuredUntil">ينتهي التمييز في</Label>
              <Input
                id="featuredUntil"
                type="date"
                value={featuredUntil}
                onChange={(e) => setFeaturedUntil(e.target.value)}
                className="mt-1"
              />
            </div>
          )}
          <div>
            <Label htmlFor="offerUntil">ينتهي العرض في (اختياري)</Label>
            <Input
              id="offerUntil"
              type="date"
              value={offerUntil}
              onChange={(e) => setOfferUntil(e.target.value)}
              className="mt-1"
            />
          </div>
          <Button disabled={busy || !canEdit} className="gap-2" onClick={() => void saveInfo()}>
            <Save className="size-4" /> احفظ
          </Button>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-bold">الأسعار والمخزون</h2>
          {variants.map((variant: any) => (
            <VariantRow
              key={variant.id}
              variant={variant}
              canEdit={canEdit}
              onSaved={() => void query.refetch()}
            />
          ))}
          {priceHistory.length > 0 ? (
            <div className="border-t border-border pt-2">
              <p className="mb-1 text-xs font-semibold">آخر تغييرات السعر</p>
              <ul className="space-y-1 text-[11px] text-muted-foreground">
                {priceHistory.map((row: any) => (
                  <li key={row.id}>
                    {new Date(row.created_at).toLocaleDateString("ar-EG")} —{" "}
                    {row.old_price == null ? "—" : formatPrice(Number(row.old_price))} →{" "}
                    {formatPrice(Number(row.new_price))} ({row.actor_email})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-bold">الصور</h2>
        {images.length === 0 ? (
          <p className="text-xs text-muted-foreground">مفيش صور مربوطة بالصنف ده.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {images.map((image: any) => (
              <div key={image.id} className="w-32 space-y-1">
                {image.url ? (
                  <img
                    src={image.url}
                    alt={image.altText}
                    loading="lazy"
                    className="aspect-square w-full rounded-lg border border-border object-cover"
                  />
                ) : (
                  <div className="aspect-square w-full rounded-lg bg-muted" />
                )}
                <p className="text-[11px] text-muted-foreground">
                  {image.published ? "منشورة" : "غير منشورة"}
                  {image.sortOrder === 0 ? " · رئيسية" : ""}
                </p>
                {canEdit ? (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={async () => {
                        await adminSetImageState({
                          data: { imageId: image.id, published: !image.published },
                        });
                        await query.refetch();
                      }}
                    >
                      {image.published ? "اخفيها" : "انشرها"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      aria-label="خلّيها الصورة الرئيسية"
                      onClick={async () => {
                        await adminSetImageState({ data: { imageId: image.id, makePrimary: true } });
                        await query.refetch();
                      }}
                    >
                      <Star className="size-3.5" />
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

type VariantData = {
  id: string;
  size_label: string;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  allow_backorder: boolean;
  active: boolean;
};

function VariantRow({
  variant,
  canEdit,
  onSaved,
}: {
  variant: VariantData;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [price, setPrice] = useState(String(variant.price));
  const [compare, setCompare] = useState(
    variant.compare_at_price == null ? "" : String(variant.compare_at_price),
  );
  const [stock, setStock] = useState(String(variant.stock_quantity ?? 0));
  const [size, setSize] = useState(variant.size_label);
  const [busy, setBusy] = useState(false);

  return (
    <div className="rounded-lg border border-border p-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[11px]">الحجم</Label>
          <Input value={size} onChange={(e) => setSize(e.target.value)} className="mt-1 h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[11px]">السعر</Label>
          <Input
            value={price}
            inputMode="decimal"
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1 h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px]">السعر قبل الخصم</Label>
          <Input
            value={compare}
            inputMode="decimal"
            onChange={(e) => setCompare(e.target.value)}
            className="mt-1 h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px]">المخزون</Label>
          <Input
            value={stock}
            inputMode="numeric"
            onChange={(e) => setStock(e.target.value)}
            className="mt-1 h-8 text-xs"
          />
        </div>
      </div>
      <Button
        size="sm"
        className="mt-2 h-8 text-xs"
        disabled={busy || !canEdit}
        onClick={async () => {
          const priceValue = Number(price);
          const stockValue = Number(stock);
          if (!Number.isFinite(priceValue) || priceValue < 0) {
            toast.error("السعر لازم يكون رقم صحيح");
            return;
          }
          if (!Number.isInteger(stockValue) || stockValue < 0) {
            toast.error("المخزون لازم يكون رقم صحيح");
            return;
          }
          setBusy(true);
          try {
            await adminUpdateVariant({
              data: {
                variantId: variant.id,
                sizeLabel: size,
                price: priceValue,
                compareAtPrice: compare.trim() === "" ? null : Number(compare),
                stockQuantity: stockValue,
                reason: "تعديل من استوديو الكتالوج",
              },
            });
            toast.success("حفظنا السعر والمخزون");
            onSaved();
          } catch {
            toast.error("الحفظ فشل");
          } finally {
            setBusy(false);
          }
        }}
      >
        احفظ الحجم ده
      </Button>
    </div>
  );
}
